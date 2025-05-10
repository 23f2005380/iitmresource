"use client"

import type React from "react"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  serverTimestamp,
  getDocs,
  limit,
  startAfter,
} from "firebase/firestore"
import {
  Send,
  MessageSquare,
  Users,
  ChevronRight,
  Menu,
  Loader2,
  Sparkles,
  ArrowUp,
  Trash2,
  MoreVertical,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { deleteDoc, doc as firestoreDoc } from "firebase/firestore"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Message {
  id: string
  content: string
  sender: string
  senderName: string
  timestamp: any
  subjectId?: string | null
  photoURL?: string | null
}

interface Subject {
  id: string
  name: string
  level: string
}

interface LocalStorageMessages {
  generalMessages: Message[]
  subjectMessages: { [subjectId: string]: Message[] }
  lastUpdated: number
}

// Number of messages to load initially and when loading more
const MESSAGES_PER_PAGE = 15

export default function ChatPage() {
  // Message input state
  const [messageInput, setMessageInput] = useState("")
  const [wordCount, setWordCount] = useState(0)

  // Messages state - separate states for general and subject chats
  const [generalMessages, setGeneralMessages] = useState<Message[]>([])
  const [subjectMessages, setSubjectMessages] = useState<{ [subjectId: string]: Message[] }>({})

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isMobileSubjectListOpen, setIsMobileSubjectListOpen] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState<{ [key: string]: boolean }>({
    general: true,
  })

  // Last document references for pagination
  const [lastDocRefs, setLastDocRefs] = useState<{ [key: string]: any }>({})

  // Track if listeners are set up
  const [generalListenerActive, setGeneralListenerActive] = useState(false)
  const [subjectListeners, setSubjectListeners] = useState<{ [subjectId: string]: boolean }>({})

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesStartRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Memoized function for word counting to improve performance
  const countWords = useCallback((text: string) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }, [])

  // Update word count only when needed, not on every render
  useEffect(() => {
    setWordCount(countWords(messageInput))
  }, [messageInput, countWords])

  // Check authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to access the chat",
          variant: "destructive",
        })
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [router, toast])

  // Load cached messages from local storage on initial load
  useEffect(() => {
    const loadCachedMessages = () => {
      try {
        const cachedData = localStorage.getItem("chatMessages")
        if (cachedData) {
          const parsedData: LocalStorageMessages = JSON.parse(cachedData)

          // Only use cached data if it's less than 1 hour old
          const oneHourAgo = Date.now() - 60 * 60 * 1000
          if (parsedData.lastUpdated > oneHourAgo) {
            setGeneralMessages(parsedData.generalMessages)
            setSubjectMessages(parsedData.subjectMessages)

            // Set loading to false since we have cached data
            setLoading(false)

            // Scroll to bottom after loading cached messages
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
            }, 100)

            // Still fetch latest messages in the background
            if (activeTab === "general") {
              setupGeneralChatListener(true)
            } else if (activeTab === "subjects" && activeSubject) {
              setupSubjectChatListener(activeSubject, true)
            }

            return true
          }
        }
        return false
      } catch (error) {
        console.error("Error loading cached messages:", error)
        return false
      }
    }

    // Try to load from cache first
    const loadedFromCache = loadCachedMessages()

    // If no cache or cache is old, load from server
    if (!loadedFromCache) {
      if (activeTab === "general") {
        setupGeneralChatListener()
      } else if (activeTab === "subjects" && activeSubject) {
        setupSubjectChatListener(activeSubject)
      }
    }
  }, [])

  // Save messages to local storage whenever they change, but throttled
  useEffect(() => {
    const saveToLocalStorage = () => {
      if (generalMessages.length > 0 || Object.keys(subjectMessages).length > 0) {
        const dataToCache: LocalStorageMessages = {
          generalMessages,
          subjectMessages,
          lastUpdated: Date.now(),
        }
        localStorage.setItem("chatMessages", JSON.stringify(dataToCache))
      }
    }

    // Use a timeout to throttle saving to localStorage
    const timeoutId = setTimeout(saveToLocalStorage, 1000)
    return () => clearTimeout(timeoutId)
  }, [generalMessages, subjectMessages])

  // Fetch subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsCollection = collection(db, "subjects")
        const subjectsSnapshot = await getDocs(subjectsCollection)
        const subjectsList = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          level: doc.data().level,
        }))
        setSubjects(subjectsList)

        // Initialize hasMoreMessages for each subject
        const newHasMore = { ...hasMoreMessages }
        subjectsList.forEach((subject) => {
          newHasMore[subject.id] = true
        })
        setHasMoreMessages(newHasMore)

        // Set first subject as active by default if on subjects tab
        if (subjectsList.length > 0 && !activeSubject && activeTab === "subjects") {
          setActiveSubject(subjectsList[0].id)
        }
      } catch (error) {
        console.error("Error fetching subjects:", error)
      }
    }

    fetchSubjects()
  }, [])

  // Set up message listeners based on active tab
  useEffect(() => {
    if (!auth.currentUser) return

    // Only set up listeners if they're not already active
    if (activeTab === "general" && !generalListenerActive) {
      setLoading(true)
      setupGeneralChatListener()
    } else if (activeTab === "subjects" && activeSubject && !subjectListeners[activeSubject]) {
      setLoading(true)
      setupSubjectChatListener(activeSubject)
    } else {
      setLoading(false)
      // Scroll to bottom when switching tabs
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      }, 100)
    }

    // Clear input when switching tabs
    setMessageInput("")
    setWordCount(0)
  }, [activeTab, activeSubject])

  // Setup general chat listener
  const setupGeneralChatListener = useCallback((appendOnly = false) => {
    const messagesQuery = query(
      collection(db, "chats"),
      where("subjectId", "==", null),
      orderBy("timestamp", "desc"),
      limit(MESSAGES_PER_PAGE),
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) {
        setHasMoreMessages((prev) => ({ ...prev, general: false }))
        setLoading(false)
        setGeneralListenerActive(true)
        return
      }

      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // Save the last document for pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1]
      setLastDocRefs((prev) => ({ ...prev, general: lastDoc }))

      // Sort messages by timestamp (oldest first)
      messagesList.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0)
        const timeB = b.timestamp?.toDate?.() || new Date(0)
        return timeA.getTime() - timeB.getTime()
      })

      if (appendOnly) {
        // Only append new messages that aren't already in the list
        setGeneralMessages((prevMessages) => {
          const existingIds = new Set(prevMessages.map((msg) => msg.id))
          const newMessages = messagesList.filter((msg) => !existingIds.has(msg.id))

          if (newMessages.length === 0) return prevMessages

          // Combine and sort
          const combined = [...prevMessages, ...newMessages]
          combined.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(0)
            const timeB = b.timestamp?.toDate?.() || new Date(0)
            return timeA.getTime() - timeB.getTime()
          })

          // Scroll to bottom if new messages were added
          if (newMessages.length > 0) {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 100)
          }

          return combined
        })
      } else {
        setGeneralMessages(messagesList)

        // Scroll to bottom after initial load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        }, 100)
      }

      setGeneralListenerActive(true)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Setup subject chat listener
  const setupSubjectChatListener = useCallback((subjectId: string, appendOnly = false) => {
    const messagesQuery = query(
      collection(db, "chats"),
      where("subjectId", "==", subjectId),
      orderBy("timestamp", "desc"),
      limit(MESSAGES_PER_PAGE),
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) {
        setHasMoreMessages((prev) => ({ ...prev, [subjectId]: false }))
        setLoading(false)
        setSubjectListeners((prev) => ({ ...prev, [subjectId]: true }))
        return
      }

      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // Save the last document for pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1]
      setLastDocRefs((prev) => ({ ...prev, [subjectId]: lastDoc }))

      // Sort messages by timestamp (oldest first)
      messagesList.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0)
        const timeB = b.timestamp?.toDate?.() || new Date(0)
        return timeA.getTime() - timeB.getTime()
      })

      if (appendOnly) {
        // Only append new messages that aren't already in the list
        setSubjectMessages((prev) => {
          const existingMessages = prev[subjectId] || []
          const existingIds = new Set(existingMessages.map((msg) => msg.id))
          const newMessages = messagesList.filter((msg) => !existingIds.has(msg.id))

          if (newMessages.length === 0) return prev

          // Combine and sort
          const combined = [...existingMessages, ...newMessages]
          combined.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(0)
            const timeB = b.timestamp?.toDate?.() || new Date(0)
            return timeA.getTime() - timeB.getTime()
          })

          // Scroll to bottom if new messages were added
          if (newMessages.length > 0) {
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            }, 100)
          }

          return {
            ...prev,
            [subjectId]: combined,
          }
        })
      } else {
        setSubjectMessages((prev) => ({
          ...prev,
          [subjectId]: messagesList,
        }))

        // Scroll to bottom after initial load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        }, 100)
      }

      setSubjectListeners((prev) => ({
        ...prev,
        [subjectId]: true,
      }))

      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Load more messages when scrolling up
  const loadMoreMessages = async () => {
    if (loadingMore) return

    setLoadingMore(true)

    try {
      const key = activeTab === "general" ? "general" : activeSubject
      if (!key) {
        setLoadingMore(false)
        return
      }

      const lastDoc = lastDocRefs[key]
      if (!lastDoc) {
        setHasMoreMessages((prev) => ({ ...prev, [key]: false }))
        setLoadingMore(false)
        return
      }

      let messagesQuery
      if (activeTab === "general") {
        messagesQuery = query(
          collection(db, "chats"),
          where("subjectId", "==", null),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      } else {
        messagesQuery = query(
          collection(db, "chats"),
          where("subjectId", "==", key),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      }

      const snapshot = await getDocs(messagesQuery)

      if (snapshot.empty) {
        setHasMoreMessages((prev) => ({ ...prev, [key]: false }))
        setLoadingMore(false)
        return
      }

      // Save the last document for pagination
      const newLastDoc = snapshot.docs[snapshot.docs.length - 1]
      setLastDocRefs((prev) => ({ ...prev, [key]: newLastDoc }))

      const olderMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // Sort messages by timestamp (oldest first)
      olderMessages.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0)
        const timeB = b.timestamp?.toDate?.() || new Date(0)
        return timeA.getTime() - timeB.getTime()
      })

      // Remember scroll position and height
      const scrollArea = scrollAreaRef.current
      const scrollPosition = scrollArea?.scrollTop || 0
      const scrollHeight = scrollArea?.scrollHeight || 0

      if (activeTab === "general") {
        setGeneralMessages((prev) => {
          // Add older messages at the beginning of the array
          return [...olderMessages, ...prev]
        })
      } else if (activeSubject) {
        setSubjectMessages((prev) => {
          const existingMessages = prev[activeSubject] || []
          // Add older messages at the beginning of the array
          return {
            ...prev,
            [activeSubject]: [...olderMessages, ...existingMessages],
          }
        })
      }

      // After state update, restore scroll position
      setTimeout(() => {
        if (scrollArea) {
          // Calculate new position to maintain the same view
          const newScrollHeight = scrollArea.scrollHeight
          const heightDifference = newScrollHeight - scrollHeight
          scrollArea.scrollTop = scrollPosition + heightDifference
        }
      }, 100)
    } catch (error) {
      console.error("Error loading more messages:", error)
      toast({
        title: "Error",
        description: "Failed to load more messages",
        variant: "destructive",
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // Handle scroll to detect when user reaches the top
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget

    // If scrolled to top (with a small threshold), load more messages
    if (scrollTop < 50) {
      const key = activeTab === "general" ? "general" : activeSubject
      if (key && hasMoreMessages[key] && !loadingMore) {
        loadMoreMessages()
      }
    }
  }

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!auth.currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to send messages",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    if (!messageInput.trim()) return

    // Check word count
    if (wordCount > 100) {
      toast({
        title: "Message too long",
        description: "Messages are limited to 100 words",
        variant: "destructive",
      })
      return
    }

    try {
      const messageData = {
        content: messageInput,
        sender: auth.currentUser.email,
        senderName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        timestamp: serverTimestamp(),
        subjectId: activeTab === "general" ? null : activeSubject,
        photoURL: auth.currentUser.photoURL,
      }

      await addDoc(collection(db, "chats"), messageData)
      setMessageInput("")
      setWordCount(0)

      // Scroll to bottom after sending a message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error sending message",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === "subjects" && subjects.length > 0 && !activeSubject) {
      setActiveSubject(subjects[0].id)
    }
  }

  // Handle subject selection
  const handleSubjectSelect = (subjectId: string) => {
    setActiveSubject(subjectId)
    setIsMobileSubjectListOpen(false) // Close mobile drawer after selection
  }

  // Get initials for avatar - memoized to improve performance
  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }, [])

  // Format timestamp - memoized to improve performance
  const formatTimestamp = useCallback((timestamp: any) => {
    if (!timestamp) return ""

    try {
      const date = timestamp.toDate()
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch (error) {
      return ""
    }
  }, [])

  // Check if message is from current user - memoized to improve performance
  const isCurrentUser = useCallback(
    (sender: string) => {
      return sender === auth.currentUser?.email
    },
    [auth.currentUser?.email],
  )

  // Get active subject name - memoized to improve performance
  const getActiveSubjectName = useMemo(() => {
    if (!activeSubject) return "Subject Chat"
    const subject = subjects.find((s) => s.id === activeSubject)
    return subject ? subject.name : "Subject Chat"
  }, [activeSubject, subjects])

  // Handle input change with performance optimization
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value)
  }, [])

  const handleDeleteMessage = async (messageId: string) => {
    if (!auth.currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to delete messages",
        variant: "destructive",
      })
      return
    }

    try {
      await deleteDoc(firestoreDoc(db, "chats", messageId))

      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      })
    } catch (error) {
      console.error("Error deleting message:", error)
      toast({
        title: "Error deleting message",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-pink-200/30 to-purple-300/20 dark:from-blue-900/20 dark:to-indigo-800/10 blur-xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-200/20 to-cyan-300/15 dark:from-blue-800/15 dark:to-cyan-700/10 blur-xl animate-float-medium"></div>

      <main className="flex-1 container py-4 md:py-8 px-2 md:px-4 relative z-10 flex items-center justify-center">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 h-[calc(100vh-8rem)] w-full max-w-6xl flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full w-full">
            <div className="border-b px-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto rounded-lg bg-gray-100/80 dark:bg-gray-700/80 p-1">
                <TabsTrigger value="general" className="flex items-center gap-2 rounded-md text-base">
                  <MessageSquare className="h-4 w-4" />
                  General Chat
                </TabsTrigger>
                <TabsTrigger value="subjects" className="flex items-center gap-2 rounded-md text-base">
                  <Users className="h-4 w-4" />
                  Subject Chats
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden w-full relative">
              {/* General chat */}
              <TabsContent
                value="general"
                className="h-full m-0 p-0 w-full flex flex-col absolute inset-0 data-[state=inactive]:hidden"
              >
                <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h3 className="font-medium text-base">General Chat</h3>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="h-3 w-3 mr-1" /> Live
                  </Badge>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar" onScroll={handleScroll} ref={scrollAreaRef}>
                  {hasMoreMessages.general && (
                    <div className="flex justify-center mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 rounded-full"
                        onClick={loadMoreMessages}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <ArrowUp className="h-3.5 w-3.5" />
                            Load older messages
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <div ref={messagesStartRef} />

                  <AnimatePresence initial={false}>
                    {loading && !generalListenerActive ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                        <p className="text-muted-foreground text-base">Loading messages...</p>
                      </div>
                    ) : generalMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                          <MessageSquare className="h-10 w-10 text-primary" />
                        </div>
                        <p className="text-muted-foreground text-center text-base">No messages yet.</p>
                        <p className="text-muted-foreground text-center text-base">Start the conversation!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {generalMessages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isCurrentUser(msg.sender) ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`flex gap-2 max-w-[90%] ${isCurrentUser(msg.sender) ? "flex-row-reverse" : "flex-row"}`}
                            >
                              <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-800 shadow-sm">
                                {msg.photoURL ? (
                                  <AvatarImage src={msg.photoURL || "/placeholder.svg"} alt={msg.senderName} />
                                ) : (
                                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
                                    {getInitials(msg.senderName)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <div
                                  className={`flex items-center gap-2 mb-1 ${isCurrentUser(msg.sender) ? "justify-end" : "justify-start"}`}
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(msg.timestamp)}
                                  </span>
                                  <span className="text-sm font-medium">{msg.senderName}</span>
                                  {isCurrentUser(msg.sender) && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                          <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() => handleDeleteMessage(msg.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                                <div
                                  className={`rounded-2xl p-3 shadow-sm ${
                                    isCurrentUser(msg.sender)
                                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                                      : "bg-gray-100 dark:bg-gray-700 rounded-tl-none"
                                  }`}
                                >
                                  <p className="text-base whitespace-pre-wrap break-words leading-relaxed">
                                    {msg.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </AnimatePresence>
                </div>
                <Separator />
                <form onSubmit={handleSendMessage} className="p-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                  <div className="flex flex-col gap-2 bg-white dark:bg-gray-900 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={messageInput}
                        onChange={handleInputChange}
                        className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="rounded-full px-4 text-base"
                        disabled={!messageInput.trim() || wordCount > 100}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    </div>
                    <div className="text-xs text-right text-muted-foreground px-2">
                      {wordCount}/100 words
                      {wordCount > 100 && <span className="text-destructive ml-2">Message too long</span>}
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* Subject chat */}
              <TabsContent
                value="subjects"
                className="h-full m-0 p-0 w-full flex flex-col absolute inset-0 data-[state=inactive]:hidden"
              >
                <div className="flex h-full w-full">
                  {/* Desktop sidebar */}
                  <div className="hidden md:flex w-64 border-r h-full overflow-hidden flex flex-col bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                    <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70">
                      <h3 className="font-medium flex items-center gap-2 text-base">
                        <Users className="h-4 w-4 text-primary" />
                        Subjects
                      </h3>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                      <div className="p-2 space-y-1">
                        {subjects.map((subject) => (
                          <Button
                            key={subject.id}
                            variant={activeSubject === subject.id ? "secondary" : "ghost"}
                            className={`w-full justify-start text-left rounded-lg text-base ${
                              activeSubject === subject.id ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
                            }`}
                            onClick={() => handleSubjectSelect(subject.id)}
                          >
                            <span className="truncate">{subject.name}</span>
                            <ChevronRight className="ml-auto h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mobile and desktop chat area */}
                  <div className="flex-1 flex flex-col h-full">
                    {/* Mobile header with subject selector */}
                    <div className="md:hidden flex items-center justify-between p-3 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-base">{getActiveSubjectName}</h3>
                      </div>
                      <Sheet open={isMobileSubjectListOpen} onOpenChange={setIsMobileSubjectListOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="sm" className="flex items-center gap-1 text-base">
                            <Menu className="h-4 w-4" />
                            Select Subject
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0">
                          <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70">
                            <h3 className="font-medium flex items-center gap-2 text-base">
                              <Users className="h-4 w-4 text-primary" />
                              Subjects
                            </h3>
                          </div>
                          <div className="overflow-auto h-full custom-scrollbar">
                            <div className="p-2 space-y-1">
                              {subjects.map((subject) => (
                                <Button
                                  key={subject.id}
                                  variant={activeSubject === subject.id ? "secondary" : "ghost"}
                                  className={`w-full justify-start text-left rounded-lg text-base ${
                                    activeSubject === subject.id ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
                                  }`}
                                  onClick={() => handleSubjectSelect(subject.id)}
                                >
                                  <span className="truncate">{subject.name}</span>
                                  <ChevronRight className="ml-auto h-4 w-4" />
                                </Button>
                              ))}
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>

                    {/* Desktop header */}
                    <div className="hidden md:flex items-center justify-between p-3 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-base">{getActiveSubjectName}</h3>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        <Sparkles className="h-3 w-3 mr-1" /> Live
                      </Badge>
                    </div>

                    {/* Chat messages area */}
                    <div
                      className="flex-1 overflow-auto p-4 custom-scrollbar"
                      onScroll={handleScroll}
                      ref={scrollAreaRef}
                    >
                      {activeSubject && hasMoreMessages[activeSubject] && (
                        <div className="flex justify-center mb-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 rounded-full"
                            onClick={loadMoreMessages}
                            disabled={loadingMore}
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <ArrowUp className="h-3.5 w-3.5" />
                                Load older messages
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      <div ref={messagesStartRef} />

                      <AnimatePresence initial={false}>
                        {loading && (!activeSubject || !subjectListeners[activeSubject]) ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                            <p className="text-muted-foreground text-base">Loading messages...</p>
                          </div>
                        ) : !activeSubject ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                              <Users className="h-10 w-10 text-primary" />
                            </div>
                            <p className="text-muted-foreground text-center text-base">Please select a subject</p>
                          </div>
                        ) : (subjectMessages[activeSubject]?.length || 0) === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                              <MessageSquare className="h-10 w-10 text-primary" />
                            </div>
                            <p className="text-muted-foreground text-center text-base">No messages yet.</p>
                            <p className="text-muted-foreground text-center text-base">Start the conversation!</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(subjectMessages[activeSubject] || []).map((msg) => (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${isCurrentUser(msg.sender) ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`flex gap-2 max-w-[90%] ${isCurrentUser(msg.sender) ? "flex-row-reverse" : "flex-row"}`}
                                >
                                  <Avatar className="h-8 w-8 border-2 border-white dark:border-gray-800 shadow-sm">
                                    {msg.photoURL ? (
                                      <AvatarImage src={msg.photoURL || "/placeholder.svg"} alt={msg.senderName} />
                                    ) : (
                                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
                                        {getInitials(msg.senderName)}
                                      </AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div>
                                    <div
                                      className={`flex items-center gap-2 mb-1 ${isCurrentUser(msg.sender) ? "justify-end" : "justify-start"}`}
                                    >
                                      <span className="text-xs text-muted-foreground">
                                        {formatTimestamp(msg.timestamp)}
                                      </span>
                                      <span className="text-sm font-medium">{msg.senderName}</span>
                                      {isCurrentUser(msg.sender) && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                              <MoreVertical className="h-3.5 w-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => handleDeleteMessage(msg.id)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </div>
                                    <div
                                      className={`rounded-2xl p-3 shadow-sm ${
                                        isCurrentUser(msg.sender)
                                          ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                                          : "bg-gray-100 dark:bg-gray-700 rounded-tl-none"
                                      }`}
                                    >
                                      <p className="text-base whitespace-pre-wrap break-words leading-relaxed">
                                        {msg.content}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Message input */}
                    <Separator />
                    <form onSubmit={handleSendMessage} className="p-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <div className="flex flex-col gap-2 bg-white dark:bg-gray-900 rounded-xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Type your message..."
                            value={messageInput}
                            onChange={handleInputChange}
                            className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-base"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            className="rounded-full px-4 text-base"
                            disabled={!messageInput.trim() || !activeSubject || wordCount > 100}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        </div>
                        <div className="text-xs text-right text-muted-foreground px-2">
                          {wordCount}/100 words
                          {wordCount > 100 && <span className="text-destructive ml-2">Message too long</span>}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
