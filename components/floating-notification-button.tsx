"use client"

import { useState, useEffect, useRef } from "react"
import { getDatabase, ref, onValue, off, push, update } from "firebase/database"
import { doc, getDoc } from "firebase/firestore"
import { Bell, X, MessageSquare, Check, Send } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { db, auth } from "@/app/firebase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function FloatingNotificationButton() {
  const [notifications, setNotifications] = useState([])
  const [notificationReplies, setNotificationReplies] = useState({})
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [replyContent, setReplyContent] = useState("")
  const [replyingTo, setReplyingTo] = useState(null)
  const [replySending, setReplySending] = useState(false)
  const [expandedNotifications, setExpandedNotifications] = useState({})
  const [loading, setLoading] = useState(true)
  const notificationRef = useRef(null)
  const { toast } = useToast()
  const notificationsOpenedRef = useRef(false)

  // Count words in a string
  const countWords = (text) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }

  // Validate reply content
  const validateReplyContent = (text) => {
    const wordCount = countWords(text)
    return wordCount <= 50
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadNotifications(user)
      } else {
        setNotifications([])
        setUnreadCount(0)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Effect to mark notifications as read when panel is opened
  useEffect(() => {
    if (showNotifications && unreadCount > 0 && !notificationsOpenedRef.current) {
      markAllAsRead()
      notificationsOpenedRef.current = true
    } else if (!showNotifications) {
      notificationsOpenedRef.current = false
    }
  }, [showNotifications, unreadCount])

  const loadNotifications = (user) => {
    try {
      setLoading(true)
      console.log("Loading notifications for user:", user.email)

      const rtdb = getDatabase()
      const userEmail = user.email?.replace(/\./g, ",") || "anonymous"
      const rtdbNotificationsRef = ref(rtdb, `notifications/${userEmail}`)

      console.log("RTDB path:", `notifications/${userEmail}`)

      // Set up real-time listener for RTDB
      const handleNotifications = (snapshot) => {
        try {
          console.log("RTDB notification snapshot:", snapshot.exists() ? "exists" : "does not exist")

          if (snapshot.exists()) {
            const rtdbNotifications = snapshot.val()
            console.log("RTDB notifications data:", rtdbNotifications)

            const notificationsArray = []
            let unread = 0

            for (const id in rtdbNotifications) {
              const notification = {
                id,
                ...rtdbNotifications[id],
                source: "rtdb",
              }

              notificationsArray.push(notification)
              if (!notification.read) unread++

              // Fetch replies for this notification
              if (notification.allowReply) {
                fetchRepliesForNotification(id)
              }
            }

            // Sort by timestamp (newest first)
            notificationsArray.sort((a, b) => b.timestamp - a.timestamp)

            console.log("Processed notifications:", notificationsArray)
            setNotifications(notificationsArray)
            setUnreadCount(unread)
          } else {
            console.log("No notifications found in RTDB")
            setNotifications([])
            setUnreadCount(0)
          }

          setLoading(false)
        } catch (error) {
          console.error("Error processing notifications:", error)
          setLoading(false)
        }
      }

      onValue(rtdbNotificationsRef, handleNotifications, (error) => {
        console.error("Error loading notifications from RTDB:", error)
        setLoading(false)
        toast({
          title: "Error loading notifications",
          description: "There was a problem loading your notifications.",
          variant: "destructive",
        })
      })

      return () => {
        off(rtdbNotificationsRef, "value", handleNotifications)
      }
    } catch (error) {
      console.error("Error in notification loading:", error)
      setLoading(false)
      toast({
        title: "Error loading notifications",
        description: "There was a problem loading your notifications.",
        variant: "destructive",
      })
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      const user = auth.currentUser
      if (!user) return

      console.log("Marking notification as read:", notificationId)

      const rtdb = getDatabase()
      const userEmail = user.email?.replace(/\./g, ",") || "anonymous"
      const notificationRef = ref(rtdb, `notifications/${userEmail}/${notificationId}`)

      // Update in RTDB
      await update(notificationRef, {
        read: true,
      })

      console.log("Notification marked as read in database")

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error marking notification as read:", error)
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      const user = auth.currentUser
      if (!user) return

      console.log("Marking all notifications as read")
      const rtdb = getDatabase()
      const userEmail = user.email?.replace(/\./g, ",") || "anonymous"

      // Get unread notifications
      const unreadNotifications = notifications.filter((notification) => !notification.read)

      // Update each notification
      for (const notification of unreadNotifications) {
        const notificationRef = ref(rtdb, `notifications/${userEmail}/${notification.id}`)
        await update(notificationRef, {
          read: true,
        })
      }

      // Update local state
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
      setUnreadCount(0)

      console.log("All notifications marked as read")
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
      toast({
        title: "Error",
        description: "Failed to mark notifications as read.",
        variant: "destructive",
      })
    }
  }

  const fetchRepliesForNotification = async (notificationId) => {
    try {
      const rtdb = getDatabase()
      const repliesRef = ref(rtdb, `notificationReplies/${notificationId}`)

      onValue(repliesRef, (snapshot) => {
        if (!snapshot.exists()) {
          setNotificationReplies((prev) => ({
            ...prev,
            [notificationId]: [],
          }))
          return
        }

        const repliesData = snapshot.val()
        const repliesArray = []

        for (const id in repliesData) {
          repliesArray.push({
            id,
            ...repliesData[id],
          })
        }

        // Sort by timestamp (newest first)
        repliesArray.sort((a, b) => b.timestamp - a.timestamp)

        setNotificationReplies((prev) => ({
          ...prev,
          [notificationId]: repliesArray,
        }))
      })
    } catch (error) {
      console.error("Error fetching replies:", error)
      toast({
        title: "Error",
        description: "Failed to load notification replies.",
        variant: "destructive",
      })
    }
  }

  const toggleNotificationExpansion = (notificationId) => {
    setExpandedNotifications((prev) => {
      const newState = {
        ...prev,
        [notificationId]: !prev[notificationId],
      }

      // If expanding, fetch replies
      if (newState[notificationId]) {
        fetchRepliesForNotification(notificationId)
      }

      return newState
    })
  }

  const handleReply = async (notificationId) => {
    if (!replyContent.trim()) return

    // Check word count
    if (!validateReplyContent(replyContent)) {
      toast({
        title: "Reply too long",
        description: "Replies are limited to 50 words",
        variant: "destructive",
      })
      return
    }

    setReplySending(true)

    try {
      const user = auth.currentUser
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to reply",
          variant: "destructive",
        })
        return
      }

      // Get user's display name from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const displayName = userDoc.exists() ? userDoc.data().displayName : user.email?.split("@")[0] || "User"

      const rtdb = getDatabase()
      const repliesRef = ref(rtdb, `notificationReplies/${notificationId}`)

      const newReply = {
        content: replyContent,
        sender: user.email,
        senderName: displayName,
        timestamp: Date.now(),
        read: false,
      }

      await push(repliesRef, newReply)

      toast({
        title: "Reply sent",
        description: "Your reply has been sent successfully",
      })

      setReplyContent("")
      setReplyingTo(null)

      // Expand the notification to show the new reply
      setExpandedNotifications((prev) => ({
        ...prev,
        [notificationId]: true,
      }))

      // Fetch the updated replies
      fetchRepliesForNotification(notificationId)
    } catch (error) {
      console.error("Error sending reply:", error)
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      })
    } finally {
      setReplySending(false)
    }
  }

  const toggleReply = (notificationId) => {
    if (replyingTo === notificationId) {
      setReplyingTo(null)
      setReplyContent("")
    } else {
      setReplyingTo(notificationId)
      setReplyContent("")
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown date"

    // Handle Firestore timestamp
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000)
      return formatRelativeTime(date)
    }

    // Handle regular JS timestamp
    const date = new Date(timestamp)
    return formatRelativeTime(date)
  }

  const formatRelativeTime = (date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) {
      return "Just now"
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`
    }

    return date.toLocaleDateString()
  }

  // Fix the getInitials function to handle undefined or empty names
  const getInitials = (name) => {
    if (!name) return "UN" // Return "UN" for undefined or empty names

    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Only show the button if user is logged in
  if (!auth.currentUser) return null

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={notificationRef}>
      <Button
        variant="default"
        size="icon"
        className="relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        onClick={() => setShowNotifications(!showNotifications)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center p-0 animate-pulse">
            {unreadCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 bottom-16 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-90"
          >
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNotifications(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[70vh] max-h-[500px]">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-sm text-muted-foreground">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="flex justify-center mb-3">
                    <Bell className="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                  <p>No notifications yet</p>
                  <p className="text-sm mt-1">You'll see notifications here when you receive them</p>
                </div>
              ) : (
                <div>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b hover:bg-muted/30 transition-colors ${notification.read ? "" : "bg-primary/5"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-primary"
                                onClick={() => markAsRead(notification.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>{formatTimestamp(notification.timestamp)}</span>
                            {notification.allowReply && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs hover:bg-primary/10"
                                onClick={() => toggleReply(notification.id)}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {replyingTo === notification.id ? "Cancel" : "Reply"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {replyingTo === notification.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 ml-0"
                        >
                          <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              className="min-h-[80px] text-sm resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                {countWords(replyContent)}/50 words
                                {countWords(replyContent) > 50 && (
                                  <span className="text-destructive ml-2">Reply too long</span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleReply(notification.id)}
                                disabled={!replyContent.trim() || replySending || !validateReplyContent(replyContent)}
                                className="h-8"
                              >
                                {replySending ? (
                                  <>
                                    <span className="mr-1">Sending</span>
                                    <span className="animate-spin">...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-3.5 w-3.5 mr-1" />
                                    Send
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* View previous replies button */}
                      {notification.allowReply && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs mt-2 hover:bg-muted/50"
                          onClick={() => toggleNotificationExpansion(notification.id)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {expandedNotifications[notification.id] ? "Hide Replies" : "View Replies"}
                        </Button>
                      )}

                      {/* Replies section */}
                      {expandedNotifications[notification.id] && notificationReplies[notification.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 ml-2 border-l-2 pl-3 border-primary/20 dark:border-primary/10"
                        >
                          {notificationReplies[notification.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No replies yet</p>
                          ) : (
                            notificationReplies[notification.id].map((reply) => (
                              <div key={reply.id} className="mb-3 bg-muted/20 p-2 rounded-md">
                                <div className="flex items-center gap-1 mb-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px] bg-primary/20">
                                      {getInitials(reply.senderName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium">{reply.senderName}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {formatTimestamp(reply.timestamp)}
                                  </span>
                                </div>
                                <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
                              </div>
                            ))
                          )}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
