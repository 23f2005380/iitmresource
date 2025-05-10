"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/firebase" // Fixed import path
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore"
import { Avatar } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/app/auth-context"

export default function FloatingNotificationButton() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({})
  const [replying, setReplying] = useState<{ [key: string]: boolean }>({})
  const notificationRef = useRef<HTMLDivElement>(null)

  // Load notifications
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    console.log("Loading notifications for user:", user.email)

    try {
      // First try to fetch notifications to check if the query works
      const fetchInitialNotifications = async () => {
        const q = query(
          collection(db, "notifications"),
          where("recipientEmail", "==", user.email),
          orderBy("createdAt", "desc"),
        )

        const snapshot = await getDocs(q)
        console.log("Initial fetch returned:", snapshot.docs.length, "notifications")
      }

      fetchInitialNotifications().catch((err) => {
        console.error("Initial fetch error:", err)
      })

      // Set up real-time listener
      const q = query(
        collection(db, "notifications"),
        where("recipientEmail", "==", user.email),
        orderBy("createdAt", "desc"),
      )

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          console.log("Notification snapshot received, docs:", snapshot.docs.length)
          const notifs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))

          setNotifications(notifs)

          // Count unread notifications
          const unread = notifs.filter((notif: any) => !notif.read).length
          setUnreadCount(unread)

          setLoading(false)
        },
        (error) => {
          console.error("Error in notification listener:", error)
          setLoading(false)
        },
      )

      return () => {
        console.log("Cleaning up notification listener")
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      }
    } catch (error) {
      console.error("Error setting up notification listener:", error)
      setLoading(false)
    }
  }, [user])

  // Rest of the component remains the same...

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node) && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, {
        read: true,
      })

      // Update local state immediately
      setNotifications((prev) => prev.map((notif) => (notif.id === notificationId ? { ...notif, read: true } : notif)))

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  // Handle reply to notification
  const handleReply = async (notificationId: string) => {
    if (!user || !replyText[notificationId]?.trim()) return

    try {
      setReplying({ ...replying, [notificationId]: true })

      // Get the notification to reply to
      const notificationDoc = await getDoc(doc(db, "notifications", notificationId))
      const notification = notificationDoc.data()

      if (!notification) {
        console.error("Notification not found")
        setReplying({ ...replying, [notificationId]: false })
        return
      }

      // Create a reply notification
      await addDoc(collection(db, "notifications"), {
        type: "reply",
        content: replyText[notificationId],
        createdAt: serverTimestamp(),
        read: false,
        recipientEmail: notification.senderEmail,
        senderEmail: user.email,
        senderName: user.displayName || user.email,
        originalNotificationId: notificationId,
        originalContent: notification.content,
      })

      // Clear the reply text
      setReplyText({ ...replyText, [notificationId]: "" })
      setReplying({ ...replying, [notificationId]: false })
    } catch (error) {
      console.error("Error sending reply:", error)
      setReplying({ ...replying, [notificationId]: false })
    }
  }

  // Toggle notification panel
  const toggleNotifications = () => {
    setIsOpen(!isOpen)
  }

  if (!user) return null

  return (
    <div className="fixed bottom-24 right-4 z-50" ref={notificationRef}>
      {/* Notification Button */}
      <Button
        onClick={toggleNotifications}
        className="rounded-full h-12 w-12 shadow-lg flex items-center justify-center relative"
        variant="default"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 px-2 py-1 text-xs" variant="destructive">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Panel */}
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 max-h-96 overflow-y-auto shadow-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Notifications</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No notifications</p>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg ${notification.read ? "bg-muted/50" : "bg-muted"}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <Avatar className="h-8 w-8">
                      <div className="bg-primary text-primary-foreground rounded-full h-full w-full flex items-center justify-center text-xs font-medium">
                        {notification.senderName?.charAt(0) || "U"}
                      </div>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{notification.senderName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.createdAt instanceof Timestamp
                          ? notification.createdAt.toDate().toLocaleString()
                          : "Just now"}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm mb-2">{notification.content}</p>

                  {/* Original message if this is a reply */}
                  {notification.originalContent && (
                    <div className="ml-4 pl-2 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground mb-2">
                      <p>Re: {notification.originalContent}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  <div className="mt-2">
                    <Textarea
                      placeholder="Reply to this notification..."
                      className="text-xs min-h-[60px] mb-2"
                      value={replyText[notification.id] || ""}
                      onChange={(e) => setReplyText({ ...replyText, [notification.id]: e.target.value })}
                      onClick={(e) => e.stopPropagation()} // Prevent triggering markAsRead
                    />
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation() // Prevent triggering markAsRead
                        handleReply(notification.id)
                      }}
                      disabled={replying[notification.id] || !replyText[notification.id]?.trim()}
                    >
                      {replying[notification.id] ? "Sending..." : "Reply"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
