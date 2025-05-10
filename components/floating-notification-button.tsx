"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, type Timestamp } from "firebase/firestore"
import { useAuth } from "@/app/auth-context"
import { Textarea } from "@/components/ui/textarea"
import { addDoc, serverTimestamp } from "firebase/firestore"

interface Notification {
  id: string
  title: string
  message: string
  createdAt: Timestamp
  recipientId: string
  read: boolean
  type: string
  resourceId?: string
  senderId?: string
  senderName?: string
  replied?: boolean
}

export default function FloatingNotificationButton() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)
    setError(null)

    console.log("Setting up notification listener for user:", user.uid)

    try {
      const q = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        orderBy("createdAt", "desc"),
      )

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notificationData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Notification[]

          console.log("Notifications fetched:", notificationData.length)
          setNotifications(notificationData)
          setUnreadCount(notificationData.filter((n) => !n.read).length)
          setLoading(false)
        },
        (err) => {
          console.error("Error fetching notifications:", err)
          setError(`Error fetching notifications: ${err.message}`)
          setLoading(false)
        },
      )

      return () => {
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      }
    } catch (err: any) {
      console.error("Error setting up notification listener:", err)
      setError(`Error setting up notification listener: ${err.message}`)
      setLoading(false)
    }
  }, [user?.uid])

  const markAsRead = async (notificationId: string) => {
    if (!user?.uid) return

    try {
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, {
        read: true,
      })
      console.log("Marked notification as read:", notificationId)
    } catch (err) {
      console.error("Error marking notification as read:", err)
    }
  }

  const handleReply = async (notificationId: string) => {
    if (!user?.uid || !replyText[notificationId]) return

    try {
      const notification = notifications.find((n) => n.id === notificationId)
      if (!notification || !notification.senderId) return

      // Create a new notification as a reply
      const notificationsRef = collection(db, "notifications")
      await addDoc(notificationsRef, {
        title: "Reply to your notification",
        message: replyText[notificationId],
        createdAt: serverTimestamp(),
        recipientId: notification.senderId,
        senderId: user.uid,
        senderName: user.displayName || "User",
        read: false,
        type: "reply",
        originalNotificationId: notificationId,
      })

      // Mark the original notification as replied
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, {
        replied: true,
      })

      // Clear the reply text
      setReplyText((prev) => ({
        ...prev,
        [notificationId]: "",
      }))

      console.log("Sent reply to notification:", notificationId)
    } catch (err) {
      console.error("Error sending reply:", err)
    }
  }

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "Unknown date"

    const date = timestamp.toDate()
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  if (!user) return null

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="rounded-full shadow-lg bg-primary hover:bg-primary/90 relative"
            onClick={() => {
              console.log("Notification button clicked")
            }}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 text-white">{unreadCount}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4">
              {error}
              <Button className="mt-2 w-full" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No notifications yet</div>
          ) : (
            <div className="space-y-4 mt-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${notification.read ? "bg-background" : "bg-muted"}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</div>
                  </div>

                  <div className="mt-2 text-sm">{notification.message}</div>

                  {notification.type === "resource_comment" && notification.resourceId && (
                    <Button
                      variant="link"
                      className="p-0 h-auto mt-2 text-xs"
                      onClick={() => {
                        window.location.href = `/resource/${notification.resourceId}`
                        setOpen(false)
                      }}
                    >
                      View Resource
                    </Button>
                  )}

                  {notification.senderId && !notification.replied && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Write a reply..."
                        className="text-sm"
                        value={replyText[notification.id] || ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({
                            ...prev,
                            [notification.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!replyText[notification.id]}
                        onClick={() => handleReply(notification.id)}
                      >
                        Reply
                      </Button>
                    </div>
                  )}

                  {notification.replied && (
                    <div className="mt-2 text-xs text-green-600">You replied to this notification</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
