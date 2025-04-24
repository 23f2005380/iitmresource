"use client"

import { useState, useEffect } from "react"
import { getDatabase, ref, onValue, update } from "firebase/database"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, CheckCheck, Filter, Loader2, MessageSquare, RefreshCw, Search } from "lucide-react"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Notification {
  id: string
  title: string
  message: string
  timestamp: number
  sender: string
  recipients: string[] | "all"
  allowReply?: boolean
}

interface Reply {
  id: string
  content: string
  sender: string
  senderName: string
  timestamp: number
  read: boolean
}

interface NotificationWithReplies extends Notification {
  replies: Reply[]
}

export default function NotificationRepliesPage() {
  const [notifications, setNotifications] = useState<NotificationWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [filter, setFilter] = useState<"all" | "with-replies" | "unread">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = auth.currentUser
        if (!user) {
          router.push("/login")
          return
        }

        const userRef = collection(db, "users")
        const q = query(userRef, where("email", "==", user.email))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          router.push("/")
          return
        }

        const userData = querySnapshot.docs[0].data()
        if (userData.role !== "admin") {
          toast({
            title: "Access denied",
            description: "You don't have permission to access this page",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        setIsAdmin(true)
        fetchNotifications()
      } catch (error) {
        console.error("Error checking admin status:", error)
        router.push("/")
      }
    }

    checkAdmin()
  }, [router, toast])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const rtdb = getDatabase()
      const notificationsRef = ref(rtdb, "notifications")

      onValue(
        notificationsRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            setNotifications([])
            setLoading(false)
            return
          }

          const notificationsData = snapshot.val()
          const allNotifications: NotificationWithReplies[] = []

          // Get all notifications from all users
          for (const userEmail in notificationsData) {
            const userNotifications = notificationsData[userEmail]

            for (const notificationId in userNotifications) {
              const notification = userNotifications[notificationId]

              // Check if this notification is already in our list
              const existingIndex = allNotifications.findIndex((n) => n.id === notificationId)

              if (existingIndex === -1) {
                // Add new notification
                allNotifications.push({
                  id: notificationId,
                  ...notification,
                  replies: [],
                })
              }
            }
          }

          // Fetch replies for each notification
          const repliesRef = ref(rtdb, "notificationReplies")
          const repliesSnapshot = await new Promise<any>((resolve) => {
            onValue(repliesRef, resolve, { onlyOnce: true })
          })

          if (repliesSnapshot.exists()) {
            const repliesData = repliesSnapshot.val()

            for (const notificationId in repliesData) {
              const notificationIndex = allNotifications.findIndex((n) => n.id === notificationId)

              if (notificationIndex !== -1) {
                const replyList: Reply[] = []

                for (const replyId in repliesData[notificationId]) {
                  replyList.push({
                    id: replyId,
                    ...repliesData[notificationId][replyId],
                  })
                }

                // Sort replies by timestamp (newest first)
                replyList.sort((a, b) => b.timestamp - a.timestamp)

                allNotifications[notificationIndex].replies = replyList
              }
            }
          }

          // Sort notifications by timestamp (newest first)
          allNotifications.sort((a, b) => b.timestamp - a.timestamp)

          setNotifications(allNotifications)
          setLoading(false)
        },
        { onlyOnce: true },
      )
    } catch (error) {
      console.error("Error fetching notifications:", error)
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const refreshData = () => {
    setRefreshing(true)
    fetchNotifications().finally(() => {
      setRefreshing(false)
      toast({
        title: "Refreshed",
        description: "Notification data has been refreshed",
      })
    })
  }

  const markReplyAsRead = async (notificationId: string, replyId: string) => {
    try {
      const rtdb = getDatabase()
      const replyRef = ref(rtdb, `notificationReplies/${notificationId}/${replyId}`)

      await update(replyRef, { read: true })

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => {
          if (notification.id === notificationId) {
            return {
              ...notification,
              replies: notification.replies.map((reply) => (reply.id === replyId ? { ...reply, read: true } : reply)),
            }
          }
          return notification
        }),
      )

      toast({
        title: "Marked as read",
        description: "Reply has been marked as read",
      })
    } catch (error) {
      console.error("Error marking reply as read:", error)
      toast({
        title: "Error",
        description: "Failed to mark reply as read",
        variant: "destructive",
      })
    }
  }

  const markAllRepliesAsRead = async (notificationId: string) => {
    try {
      const rtdb = getDatabase()
      const notification = notifications.find((n) => n.id === notificationId)

      if (!notification) return

      const updates: Record<string, any> = {}

      notification.replies.forEach((reply) => {
        if (!reply.read) {
          updates[`notificationReplies/${notificationId}/${reply.id}/read`] = true
        }
      })

      if (Object.keys(updates).length === 0) return

      await update(ref(rtdb), updates)

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => {
          if (notification.id === notificationId) {
            return {
              ...notification,
              replies: notification.replies.map((reply) => ({ ...reply, read: true })),
            }
          }
          return notification
        }),
      )

      toast({
        title: "All marked as read",
        description: "All replies have been marked as read",
      })
    } catch (error) {
      console.error("Error marking all replies as read:", error)
      toast({
        title: "Error",
        description: "Failed to mark all replies as read",
        variant: "destructive",
      })
    }
  }

  const getFilteredNotifications = () => {
    let filtered = [...notifications]

    // Apply filter
    if (filter === "with-replies") {
      filtered = filtered.filter((notification) => notification.replies.length > 0)
    } else if (filter === "unread") {
      filtered = filtered.filter((notification) => notification.replies.some((reply) => !reply.read))
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (notification) =>
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query) ||
          notification.replies.some(
            (reply) => reply.content.toLowerCase().includes(query) || reply.senderName.toLowerCase().includes(query),
          ),
      )
    }

    return filtered
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Fix the getInitials function to handle undefined or empty names
  const getInitials = (name: string | undefined) => {
    if (!name) return "UN" // Return "UN" for undefined or empty names

    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  const getUnreadRepliesCount = (notification: NotificationWithReplies) => {
    return notification.replies.filter((reply) => !reply.read).length
  }

  const getTotalUnreadReplies = () => {
    return notifications.reduce((total, notification) => {
      return total + getUnreadRepliesCount(notification)
    }, 0)
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Checking permissions...</CardTitle>
              <CardDescription>Please wait while we verify your access</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-4 md:py-8 px-2 md:px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.push("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Notification Replies</h1>
            {getTotalUnreadReplies() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getTotalUnreadReplies()} unread
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>

        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Tabs defaultValue="all" onValueChange={(value) => setFilter(value as any)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="with-replies">With Replies</TabsTrigger>
                    <TabsTrigger value="unread">Unread</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading notifications...</p>
              </div>
            ) : getFilteredNotifications().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-medium mb-1">No notifications found</h3>
                <p className="text-muted-foreground">
                  {filter !== "all"
                    ? `Try changing your filter or search query`
                    : `No notifications have been sent yet`}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                <div className="space-y-4">
                  {getFilteredNotifications().map((notification) => (
                    <Card key={notification.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/30 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{notification.title}</CardTitle>
                            <CardDescription className="mt-1">
                              Sent by {notification.sender} • {formatTimestamp(notification.timestamp)}
                            </CardDescription>
                          </div>
                          {notification.replies.length > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {notification.replies.length} {notification.replies.length === 1 ? "reply" : "replies"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm">{notification.message}</p>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {notification.replies.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">No replies yet</p>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Replies</h4>
                              {getUnreadRepliesCount(notification) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => markAllRepliesAsRead(notification.id)}
                                >
                                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                                  Mark all as read
                                </Button>
                              )}
                            </div>
                            <div className="space-y-3">
                              {notification.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className={`p-3 rounded-lg border ${!reply.read ? "bg-primary/5 border-primary/20" : ""}`}
                                >
                                  <div className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {getInitials(reply.senderName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{reply.senderName}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {formatTimestamp(reply.timestamp)}
                                            </span>
                                          </div>
                                          <p className="mt-1 text-sm">{reply.content}</p>
                                        </div>
                                        {!reply.read && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => markReplyAsRead(notification.id, reply.id)}
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
