"use client"

import { useState, useEffect, useRef } from "react"
import { getDatabase, ref, onValue, push, update } from "firebase/database"
import { doc, getDoc } from "firebase/firestore"
import { Bell } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { db, auth } from "../app/firebase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"

export function NotificationSystem() {
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [replyContent, setReplyContent] = useState("")
  const [replyingTo, setReplyingTo] = useState(null)
  const [replySending, setReplySending] = useState(false)
  const [loading, setLoading] = useState(true)
  const notificationRef = useRef(null)

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

  // Load notifications from both Firestore and Realtime Database
  useEffect(() => {
    const user = auth.currentUser
    if (!user) {
      setLoading(false)
      return
    }

    const loadNotifications = async () => {
      try {
        setLoading(true)
        console.log("Loading notifications for user:", user.email)

        // First try to get notifications from Realtime Database
        const rtdb = getDatabase()
        const userEmail = user.email?.replace(/\./g, ",") || "anonymous"
        const rtdbNotificationsRef = ref(rtdb, `notifications/${userEmail}`)

        console.log("RTDB path:", `notifications/${userEmail}`)

        // Set up real-time listener for RTDB
        const unsubscribe = onValue(
          rtdbNotificationsRef,
          (snapshot) => {
            console.log("RTDB notification snapshot:", snapshot.exists() ? "exists" : "does not exist")

            if (snapshot.exists()) {
              const rtdbNotifications = snapshot.val()
              console.log("RTDB notifications data:", rtdbNotifications)

              const notificationsArray = []
              let unreadCount = 0

              for (const id in rtdbNotifications) {
                const notification = {
                  id,
                  ...rtdbNotifications[id],
                  source: "rtdb",
                }

                notificationsArray.push(notification)
                if (!notification.read) unreadCount++
              }

              // Sort by timestamp (newest first)
              notificationsArray.sort((a, b) => b.timestamp - a.timestamp)

              console.log("Processed notifications:", notificationsArray)
              setNotifications(notificationsArray)
              setUnreadCount(unreadCount)
            } else {
              console.log("No notifications found in RTDB")
              setNotifications([])
              setUnreadCount(0)
            }

            setLoading(false)
          },
          (error) => {
            console.error("Error loading notifications from RTDB:", error)
            setLoading(false)
          },
        )

        return () => unsubscribe()
      } catch (error) {
        console.error("Error in notification loading:", error)
        setLoading(false)
      }
    }

    loadNotifications()
  }, [])

  const markAsRead = async (notificationId, source = "rtdb") => {
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
    }
  }

  const handleReply = async (notificationId) => {
    if (!replyContent.trim()) return

    // Check word count
    if (!validateReplyContent(replyContent)) {
      alert("Replies are limited to 50 words")
      return
    }

    setReplySending(true)

    try {
      const user = auth.currentUser
      if (!user) {
        alert("Please sign in to reply")
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

      alert("Reply sent successfully")

      setReplyContent("")
      setReplyingTo(null)
    } catch (error) {
      console.error("Error sending reply:", error)
      alert("Error sending reply. Please try again.")
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
      return date.toLocaleString()
    }

    // Handle regular JS timestamp
    const date = new Date(timestamp)
    return date.toLocaleString()
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

  return (
    <div className="relative z-50" ref={notificationRef}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border overflow-hidden"
          >
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-medium">Notifications</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNotifications(false)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </div>

            <div className="custom-scrollbar" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {loading ? (
                <div className="p-4 text-center">
                  <div className="loading-spinner-sm mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="flex justify-center mb-2">
                    <Bell className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div>
                  {notifications.map((notification) => (
                    <div key={notification.id} className={`p-3 border-b ${notification.read ? "" : "bg-primary/5"}`}>
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(notification.sender)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => markAsRead(notification.id, notification.source)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notification.message}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatTimestamp(notification.timestamp)}</span>
                            {notification.allowReply && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => toggleReply(notification.id)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="mr-1"
                                >
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                {replyingTo === notification.id ? "Cancel" : "Reply"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {replyingTo === notification.id && (
                        <div className="mt-3 ml-11">
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Type your reply..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              className="min-h-[80px] text-sm"
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
                              >
                                {replySending ? (
                                  <>
                                    <span className="mr-1">Sending</span>
                                    <span className="animate-spin">...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="mr-1"
                                    >
                                      <line x1="22" y1="2" x2="11" y2="13"></line>
                                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                    Send
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
