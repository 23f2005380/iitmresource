"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
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
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  updateDoc,
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
  X,
  Maximize2,
  Minimize2,
  LinkIcon,
  Copy,
  UserPlus,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { db, auth } from "@/app/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface Message {
  id: string
  content: string
  sender: string
  senderName: string
  timestamp: any
  subjectId?: string | null
  photoURL?: string | null
  chatRoomId?: string | null
}

interface Subject {
  id: string
  name: string
  level: string
}

interface ChatRoom {
  id: string
  name: string
  createdBy: string
  createdAt: any
  participants: string[]
}

interface LocalStorageMessages {
  generalMessages: Message[]
  subjectMessages: { [subjectId: string]: Message[] }
  privateMessages: { [chatRoomId: string]: Message[] }
  lastUpdated: number
}

// Number of messages to load initially and when loading more
const MESSAGES_PER_PAGE = 15

export function FloatingChat() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Chat state
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Message input state
  const [messageInput, setMessageInput] = useState("")
  const [wordCount, setWordCount] = useState(0)

  // Messages state - separate states for general, subject, and private chats
  const [generalMessages, setGeneralMessages] = useState<Message[]>([])
  const [subjectMessages, setSubjectMessages] = useState<{ [subjectId: string]: Message[] }>({})
  const [privateMessages, setPrivateMessages] = useState<{ [chatRoomId: string]: Message[] }>({})

  // Chat rooms state
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeChatRoom, setActiveChatRoom] = useState<string | null>(null)
  const [newChatRoomName, setNewChatRoomName] = useState("")
  const [joinChatRoomId, setJoinChatRoomId] = useState("")
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isMobileSubjectListOpen, setIsMobileSubjectListOpen] = useState(false)
  const [isMobileChatRoomListOpen, setIsMobileChatRoomListOpen] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState<{ [key: string]: boolean }>({
    general: true,
  })

  // Last document references for pagination
  const [lastDocRefs, setLastDocRefs] = useState<{ [key: string]: any }>({})

  // Track if listeners are set up
  const [generalListenerActive, setGeneralListenerActive] = useState(false)
  const [subjectListeners, setSubjectListeners] = useState<{ [subjectId: string]: boolean }>({})
  const [privateListeners, setPrivateListeners] = useState<{ [chatRoomId: string]: boolean }>({})

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesStartRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Check for chat room in URL
  useEffect(() => {
    const chatRoomId = searchParams.get("chatRoom")
    if (chatRoomId && isAuthenticated) {
      handleJoinChatRoom(chatRoomId)
    }
  }, [searchParams, isAuthenticated])

  // Check authentication
  useEffect(() => {
    console.log("Checking auth state")
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log("Auth state changed:", !!user)
      setIsAuthenticated(!!user)
      setCurrentUser(user)

      // Close chat if user logs out
      if (!user && isOpen) {
        setIsOpen(false)
      }
    })

    return () => unsubscribe()
  }, [isOpen])

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

  // Handle click outside to close the chat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        // Don't close if it's just expanded mode toggle
        if (isExpanded) return
        setIsOpen(false)
      }
    }

    if (isOpen && !isExpanded) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, isExpanded])

  // Load cached messages from local storage on initial load
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return

    let unsubscribeFunction: (() => void) | undefined

    const loadCachedMessages = () => {
      try {
        const cachedData = localStorage.getItem("chatMessages")
        if (cachedData) {
          const parsedData: LocalStorageMessages = JSON.parse(cachedData)

          // Only use cached data if it's less than 1 hour old
          const oneHourAgo = Date.now() - 60 * 60 * 1000
          if (parsedData.lastUpdated > oneHourAgo) {
            setGeneralMessages(parsedData.generalMessages || [])
            setSubjectMessages(parsedData.subjectMessages || {})
            setPrivateMessages(parsedData.privateMessages || {})

            // Set loading to false since we have cached data
            setLoading(false)

            // Still fetch latest messages in the background
            if (activeTab === "general") {
              unsubscribeFunction = setupGeneralChatListener(true)
            } else if (activeTab === "subjects" && activeSubject) {
              unsubscribeFunction = setupSubjectChatListener(activeSubject, true)
            } else if (activeTab === "private" && activeChatRoom) {
              unsubscribeFunction = setupPrivateChatListener(activeChatRoom, true)
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
        unsubscribeFunction = setupGeneralChatListener()
      } else if (activeTab === "subjects" && activeSubject) {
        unsubscribeFunction = setupSubjectChatListener(activeSubject)
      } else if (activeTab === "private" && activeChatRoom) {
        unsubscribeFunction = setupPrivateChatListener(activeChatRoom)
      }
    }

    return () => {
      if (typeof unsubscribeFunction === "function") {
        unsubscribeFunction()
      }
    }
  }, [isOpen, isAuthenticated, activeTab, activeSubject, activeChatRoom])

  // Save messages to local storage whenever they change, but throttled
  useEffect(() => {
    if (!isAuthenticated) return

    const saveToLocalStorage = () => {
      if (
        generalMessages.length > 0 ||
        Object.keys(subjectMessages).length > 0 ||
        Object.keys(privateMessages).length > 0
      ) {
        const dataToCache: LocalStorageMessages = {
          generalMessages,
          subjectMessages,
          privateMessages,
          lastUpdated: Date.now(),
        }
        localStorage.setItem("chatMessages", JSON.stringify(dataToCache))
      }
    }

    // Use a timeout to throttle saving to localStorage
    const timeoutId = setTimeout(saveToLocalStorage, 1000)
    return () => clearTimeout(timeoutId)
  }, [generalMessages, subjectMessages, privateMessages, isAuthenticated])

  // Fetch subjects
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return

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
  }, [isOpen, isAuthenticated])

  // Fetch chat rooms
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !currentUser) return

    let unsubscribeFunction: (() => void) | undefined

    const fetchChatRooms = async () => {
      try {
        const chatRoomsQuery = query(
          collection(db, "chatRooms"),
          where("participants", "array-contains", currentUser.email),
        )

        const unsubscribe = onSnapshot(chatRoomsQuery, (snapshot) => {
          const roomsList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ChatRoom[]

          // Sort by creation date (newest first)
          roomsList.sort((a, b) => {
            const timeA = a.createdAt?.toDate?.() || new Date(0)
            const timeB = b.createdAt?.toDate?.() || new Date(0)
            return timeB.getTime() - timeA.getTime()
          })

          setChatRooms(roomsList)

          // Initialize hasMoreMessages for each chat room
          const newHasMore = { ...hasMoreMessages }
          roomsList.forEach((room) => {
            newHasMore[`private_${room.id}`] = true
          })
          setHasMoreMessages(newHasMore)

          // Set first chat room as active by default if on private tab
          if (roomsList.length > 0 && !activeChatRoom && activeTab === "private") {
            setActiveChatRoom(roomsList[0].id)
          }
        })

        unsubscribeFunction = unsubscribe
      } catch (error) {
        console.error("Error fetching chat rooms:", error)
      }
    }

    fetchChatRooms()

    return () => {
      if (typeof unsubscribeFunction === "function") {
        unsubscribeFunction()
      }
    }
  }, [isOpen, isAuthenticated, currentUser])

  // Set up message listeners based on active tab
  useEffect(() => {
    if (!auth.currentUser || !isOpen || !isAuthenticated) return

    let unsubscribeFunction: (() => void) | undefined

    // Only set up listeners if they're not already active
    if (activeTab === "general" && !generalListenerActive) {
      setLoading(true)
      unsubscribeFunction = setupGeneralChatListener()
    } else if (activeTab === "subjects" && activeSubject && !subjectListeners[activeSubject]) {
      setLoading(true)
      unsubscribeFunction = setupSubjectChatListener(activeSubject)
    } else if (activeTab === "private" && activeChatRoom && !privateListeners[activeChatRoom]) {
      setLoading(true)
      unsubscribeFunction = setupPrivateChatListener(activeChatRoom)
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

    return () => {
      if (typeof unsubscribeFunction === "function") {
        unsubscribeFunction()
      }
    }
  }, [activeTab, activeSubject, activeChatRoom, isOpen, isAuthenticated])

  // Setup general chat listener
  const setupGeneralChatListener = useCallback((appendOnly = false) => {
    const messagesQuery = query(
      collection(db, "chats"),
      where("subjectId", "==", null),
      where("chatRoomId", "==", null),
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
      where("chatRoomId", "==", null),
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

  // Setup private chat listener
  const setupPrivateChatListener = useCallback((chatRoomId: string, appendOnly = false) => {
    const messagesQuery = query(
      collection(db, "chats"),
      where("chatRoomId", "==", chatRoomId),
      orderBy("timestamp", "desc"),
      limit(MESSAGES_PER_PAGE),
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) {
        setHasMoreMessages((prev) => ({ ...prev, [`private_${chatRoomId}`]: false }))
        setLoading(false)
        setPrivateListeners((prev) => ({ ...prev, [chatRoomId]: true }))
        return
      }

      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // Save the last document for pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1]
      setLastDocRefs((prev) => ({ ...prev, [`private_${chatRoomId}`]: lastDoc }))

      // Sort messages by timestamp (oldest first)
      messagesList.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0)
        const timeB = b.timestamp?.toDate?.() || new Date(0)
        return timeA.getTime() - timeB.getTime()
      })

      if (appendOnly) {
        // Only append new messages that aren't already in the list
        setPrivateMessages((prev) => {
          const existingMessages = prev[chatRoomId] || []
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
            [chatRoomId]: combined,
          }
        })
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [chatRoomId]: messagesList,
        }))

        // Scroll to bottom after initial load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        }, 100)
      }

      setPrivateListeners((prev) => ({
        ...prev,
        [chatRoomId]: true,
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
      let key: string
      if (activeTab === "general") {
        key = "general"
      } else if (activeTab === "subjects" && activeSubject) {
        key = activeSubject
      } else if (activeTab === "private" && activeChatRoom) {
        key = `private_${activeChatRoom}`
      } else {
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
          where("chatRoomId", "==", null),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      } else if (activeTab === "subjects" && activeSubject) {
        messagesQuery = query(
          collection(db, "chats"),
          where("subjectId", "==", activeSubject),
          where("chatRoomId", "==", null),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      } else if (activeTab === "private" && activeChatRoom) {
        messagesQuery = query(
          collection(db, "chats"),
          where("chatRoomId", "==", activeChatRoom),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      } else {
        setLoadingMore(false)
        return
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
      } else if (activeTab === "subjects" && activeSubject) {
        setSubjectMessages((prev) => {
          const existingMessages = prev[activeSubject] || []
          // Add older messages at the beginning of the array
          return {
            ...prev,
            [activeSubject]: [...olderMessages, ...existingMessages],
          }
        })
      } else if (activeTab === "private" && activeChatRoom) {
        setPrivateMessages((prev) => {
          const existingMessages = prev[activeChatRoom] || []
          // Add older messages at the beginning of the array
          return {
            ...prev,
            [activeChatRoom]: [...olderMessages, ...existingMessages],
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
    e.stopPropagation() // Prevent scroll propagation to parent elements

    const { scrollTop } = e.currentTarget

    // If scrolled to top (with a small threshold), load more messages
    if (scrollTop < 50) {
      let key: string
      if (activeTab === "general") {
        key = "general"
      } else if (activeTab === "subjects" && activeSubject) {
        key = activeSubject
      } else if (activeTab === "private" && activeChatRoom) {
        key = `private_${activeChatRoom}`
      } else {
        return
      }

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
        subjectId: activeTab === "subjects" ? activeSubject : null,
        chatRoomId: activeTab === "private" ? activeChatRoom : null,
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
    } else if (value === "private" && chatRooms.length > 0 && !activeChatRoom) {
      setActiveChatRoom(chatRooms[0].id)
    }
  }

  // Handle subject selection
  const handleSubjectSelect = (subjectId: string) => {
    setActiveSubject(subjectId)
    setIsMobileSubjectListOpen(false) // Close mobile drawer after selection
  }

  // Handle chat room selection
  const handleChatRoomSelect = (chatRoomId: string) => {
    setActiveChatRoom(chatRoomId)
    setIsMobileChatRoomListOpen(false) // Close mobile drawer after selection
  }

  // Create a new chat room
  const handleCreateChatRoom = async () => {
    if (!auth.currentUser) return
    if (!newChatRoomName.trim()) {
      toast({
        title: "Room name required",
        description: "Please enter a name for your chat room",
        variant: "destructive",
      })
      return
    }

    setIsCreatingRoom(true)

    try {
      const chatRoomData = {
        name: newChatRoomName.trim(),
        createdBy: auth.currentUser.email,
        createdAt: serverTimestamp(),
        participants: [auth.currentUser.email],
      }

      const docRef = await addDoc(collection(db, "chatRooms"), chatRoomData)

      toast({
        title: "Chat room created",
        description: "Your chat room has been created successfully",
      })

      setNewChatRoomName("")
      setActiveChatRoom(docRef.id)
      setActiveTab("private")
    } catch (error) {
      console.error("Error creating chat room:", error)
      toast({
        title: "Error creating chat room",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsCreatingRoom(false)
    }
  }

  // Join a chat room by ID
  const handleJoinChatRoom = async (roomId: string) => {
    if (!auth.currentUser) return

    const roomIdToJoin = roomId || joinChatRoomId.trim()
    if (!roomIdToJoin) {
      toast({
        title: "Room ID required",
        description: "Please enter a chat room ID to join",
        variant: "destructive",
      })
      return
    }

    setIsJoiningRoom(true)

    try {
      // Check if room exists
      const roomRef = firestoreDoc(db, "chatRooms", roomIdToJoin)
      const roomDoc = await getDoc(roomRef)

      if (!roomDoc.exists()) {
        toast({
          title: "Room not found",
          description: "The chat room ID you entered does not exist",
          variant: "destructive",
        })
        setIsJoiningRoom(false)
        return
      }

      const roomData = roomDoc.data() as ChatRoom

      // Check if user is already a participant
      if (roomData.participants.includes(auth.currentUser.email)) {
        // Just open the room
        setActiveChatRoom(roomIdToJoin)
        setActiveTab("private")
        setIsOpen(true)
        setJoinChatRoomId("")
        setIsJoiningRoom(false)
        return
      }

      // Add user to participants
      await updateDoc(roomRef, {
        participants: [...roomData.participants, auth.currentUser.email],
      })

      toast({
        title: "Joined chat room",
        description: `You have joined "${roomData.name}"`,
      })

      setJoinChatRoomId("")
      setActiveChatRoom(roomIdToJoin)
      setActiveTab("private")
      setIsOpen(true)
    } catch (error) {
      console.error("Error joining chat room:", error)
      toast({
        title: "Error joining chat room",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsJoiningRoom(false)
    }
  }

  // Get shareable link for a chat room
  const getChatRoomLink = (roomId: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}${pathname}?chatRoom=${roomId}`
  }

  // Copy chat room link to clipboard
  const copyRoomLink = (roomId: string) => {
    const link = getChatRoomLink(roomId)
    navigator.clipboard.writeText(link)
    toast({
      title: "Link copied",
      description: "Chat room link copied to clipboard",
    })
  }

  // Get initials for avatar - memoized to improve performance
  const getInitials = useCallback((name: string) => {
    if (!name) return "UN"
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
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
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
  const getActiveSubjectName = useCallback(() => {
    if (!activeSubject) return "Subject Chat"
    const subject = subjects.find((s) => s.id === activeSubject)
    return subject ? subject.name : "Subject Chat"
  }, [activeSubject, subjects])

  // Get active chat room name - memoized to improve performance
  const getActiveChatRoomName = useCallback(() => {
    if (!activeChatRoom) return "Private Chat"
    const room = chatRooms.find((r) => r.id === activeChatRoom)
    return room ? room.name : "Private Chat"
  }, [activeChatRoom, chatRooms])

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

  // Toggle expanded mode
  const toggleExpandedMode = () => {
    setIsExpanded(!isExpanded)
  }

  // Calculate dynamic styles based on state
  const chatContainerStyle = isExpanded
    ? {
        position: "fixed",
        top: "5rem", // Below navbar
        right: "1rem",
        bottom: "1rem",
        left: "1rem",
        width: "auto",
        height: "auto",
        maxWidth: "none",
        zIndex: 40, // Below navbar (z-index 50)
      }
    : {
        position: "fixed",
        bottom: "6rem",
        right: "1.5rem",
        width: "22rem",
        height: "30rem",
        maxWidth: "calc(100vw - 3rem)",
        zIndex: 40, // Below navbar (z-index 50)
      }

  return (
    <div className="fixed bottom-6 right-6 z-40" style={{ display: isAuthenticated ? "block" : "none" }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            style={chatContainerStyle as any}
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden"
          >
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full w-full">
              <div className="border-b px-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-between">
                <TabsList className="grid grid-cols-3 w-full max-w-md rounded-lg bg-gray-100/80 dark:bg-gray-700/80 p-1">
                  <TabsTrigger value="general" className="flex items-center gap-2 rounded-md text-sm">
                    <MessageSquare className="h-3.5 w-3.5" />
                    General
                  </TabsTrigger>
                  <TabsTrigger value="subjects" className="flex items-center gap-2 rounded-md text-sm">
                    <Users className="h-3.5 w-3.5" />
                    Subjects
                  </TabsTrigger>
                  <TabsTrigger value="private" className="flex items-center gap-2 rounded-md text-sm">
                    <UserPlus className="h-3.5 w-3.5" />
                    Private
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={toggleExpandedMode} className="h-8 w-8">
                    {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden w-full relative">
                {/* General chat */}
                <TabsContent
                  value="general"
                  className="h-full m-0 p-0 w-full flex flex-col absolute inset-0 data-[state=inactive]:hidden"
                >
                  <div className="p-2 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-sm">General Chat</h3>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-0">
                      <Sparkles className="h-3 w-3 mr-1" /> Live
                    </Badge>
                  </div>
                  <div
                    className="flex-1 overflow-auto p-3 custom-scrollbar"
                    onScroll={handleScroll}
                    ref={scrollAreaRef}
                  >
                    {hasMoreMessages.general && (
                      <div className="flex justify-center mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1 rounded-full text-xs h-7 px-3"
                          onClick={loadMoreMessages}
                          disabled={loadingMore}
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <ArrowUp className="h-3 w-3" />
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
                          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                          <p className="text-muted-foreground text-sm">Loading messages...</p>
                        </div>
                      ) : generalMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="bg-primary/10 p-3 rounded-full mb-3">
                            <MessageSquare className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-muted-foreground text-center text-sm">No messages yet.</p>
                          <p className="text-muted-foreground text-center text-sm">Start the conversation!</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
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
                                <Avatar className="h-7 w-7 border-2 border-white dark:border-gray-800 shadow-sm">
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
                                    <span className="text-xs font-medium">{msg.senderName}</span>
                                    {isCurrentUser(msg.sender) && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                            <MoreVertical className="h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive text-xs"
                                            onClick={() => handleDeleteMessage(msg.id)}
                                          >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                  <div
                                    className={`rounded-2xl p-2 shadow-sm ${
                                      isCurrentUser(msg.sender)
                                        ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                                        : "bg-gray-100 dark:bg-gray-700 rounded-tl-none"
                                    }`}
                                  >
                                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
                  <form onSubmit={handleSendMessage} className="p-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                    <div className="flex flex-col gap-1 bg-white dark:bg-gray-900 rounded-lg p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type your message..."
                          value={messageInput}
                          onChange={handleInputChange}
                          className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="rounded-full px-3 text-xs h-8"
                          disabled={!messageInput.trim() || wordCount > 100}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Send
                        </Button>
                      </div>
                      <div className="text-xs text-right text-muted-foreground px-1">
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
                    <div className="hidden md:flex w-48 border-r h-full overflow-hidden flex flex-col bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                      <div className="p-2 border-b bg-white/70 dark:bg-gray-800/70">
                        <h3 className="font-medium flex items-center gap-2 text-xs">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          Subjects
                        </h3>
                      </div>
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="p-1 space-y-1">
                          {subjects.map((subject) => (
                            <Button
                              key={subject.id}
                              variant={activeSubject === subject.id ? "secondary" : "ghost"}
                              className={`w-full justify-start text-left rounded-lg text-xs py-1.5 h-auto ${
                                activeSubject === subject.id ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
                              }`}
                              onClick={() => handleSubjectSelect(subject.id)}
                            >
                              <span className="truncate">{subject.name}</span>
                              <ChevronRight className="ml-auto h-3.5 w-3.5" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Mobile and desktop chat area */}
                    <div className="flex-1 flex flex-col h-full">
                      {/* Mobile header with subject selector */}
                      <div className="md:hidden flex items-center justify-between p-2 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">{getActiveSubjectName()}</h3>
                        </div>
                        <Sheet open={isMobileSubjectListOpen} onOpenChange={setIsMobileSubjectListOpen}>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs h-7 px-2">
                              <Menu className="h-3.5 w-3.5" />
                              Select Subject
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0">
                            <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70">
                              <h3 className="font-medium flex items-center gap-2 text-sm">
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
                                    className={`w-full justify-start text-left rounded-lg text-sm ${
                                      activeSubject === subject.id
                                        ? "bg-primary/15 text-primary hover:bg-primary/20"
                                        : ""
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
                      <div className="hidden md:flex items-center justify-between p-2 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">{getActiveSubjectName()}</h3>
                        </div>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-0">
                          <Sparkles className="h-3 w-3 mr-1" /> Live
                        </Badge>
                      </div>

                      {/* Chat messages area */}
                      <div
                        className="flex-1 overflow-auto p-3 custom-scrollbar"
                        onScroll={handleScroll}
                        ref={scrollAreaRef}
                      >
                        {activeSubject && hasMoreMessages[activeSubject] && (
                          <div className="flex justify-center mb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 rounded-full text-xs h-7 px-3"
                              onClick={loadMoreMessages}
                              disabled={loadingMore}
                            >
                              {loadingMore ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="h-3 w-3" />
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
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                              <p className="text-muted-foreground text-sm">Loading messages...</p>
                            </div>
                          ) : !activeSubject ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-primary/10 p-3 rounded-full mb-3">
                                <Users className="h-6 w-6 text-primary" />
                              </div>
                              <p className="text-muted-foreground text-center text-sm">Please select a subject</p>
                            </div>
                          ) : (subjectMessages[activeSubject]?.length || 0) === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-primary/10 p-3 rounded-full mb-3">
                                <MessageSquare className="h-6 w-6 text-primary" />
                              </div>
                              <p className="text-muted-foreground text-center text-sm">No messages yet.</p>
                              <p className="text-muted-foreground text-center text-sm">Start the conversation!</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
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
                                    <Avatar className="h-7 w-7 border-2 border-white dark:border-gray-800 shadow-sm">
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
                                        <span className="text-xs font-medium">{msg.senderName}</span>
                                        {isCurrentUser(msg.sender) && (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                                <MoreVertical className="h-3 w-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem
                                                className="text-destructive focus:text-destructive text-xs"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                              >
                                                <Trash2 className="h-3 w-3 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </div>
                                      <div
                                        className={`rounded-2xl p-2 shadow-sm ${
                                          isCurrentUser(msg.sender)
                                            ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                                            : "bg-gray-100 dark:bg-gray-700 rounded-tl-none"
                                        }`}
                                      >
                                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
                      <form
                        onSubmit={handleSendMessage}
                        className="p-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm"
                      >
                        <div className="flex flex-col gap-1 bg-white dark:bg-gray-900 rounded-lg p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type your message..."
                              value={messageInput}
                              onChange={handleInputChange}
                              className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="rounded-full px-3 text-xs h-8"
                              disabled={!messageInput.trim() || !activeSubject || wordCount > 100}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Send
                            </Button>
                          </div>
                          <div className="text-xs text-right text-muted-foreground px-1">
                            {wordCount}/100 words
                            {wordCount > 100 && <span className="text-destructive ml-2">Message too long</span>}
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </TabsContent>

                {/* Private chat */}
                <TabsContent
                  value="private"
                  className="h-full m-0 p-0 w-full flex flex-col absolute inset-0 data-[state=inactive]:hidden"
                >
                  <div className="flex h-full w-full">
                    {/* Desktop sidebar */}
                    <div className="hidden md:flex w-48 border-r h-full overflow-hidden flex flex-col bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                      <div className="p-2 border-b bg-white/70 dark:bg-gray-800/70">
                        <h3 className="font-medium flex items-center gap-2 text-xs">
                          <UserPlus className="h-3.5 w-3.5 text-primary" />
                          Private Chats
                        </h3>
                      </div>
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="p-1 space-y-1">
                          {chatRooms.map((room) => (
                            <div key={room.id} className="flex flex-col">
                              <Button
                                variant={activeChatRoom === room.id ? "secondary" : "ghost"}
                                className={`w-full justify-start text-left rounded-lg text-xs py-1.5 h-auto ${
                                  activeChatRoom === room.id ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
                                }`}
                                onClick={() => handleChatRoomSelect(room.id)}
                              >
                                <span className="truncate">{room.name}</span>
                                <ChevronRight className="ml-auto h-3.5 w-3.5" />
                              </Button>
                              {activeChatRoom === room.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 ml-2 mt-1"
                                  onClick={() => copyRoomLink(room.id)}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Share Link
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="p-2 mt-2 border-t">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full text-xs">
                                <UserPlus className="h-3.5 w-3.5 mr-1" />
                                New Chat Room
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Create a new chat room</DialogTitle>
                                <DialogDescription>
                                  Create a private chat room and invite others by sharing the link.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="name" className="text-right">
                                    Name
                                  </Label>
                                  <Input
                                    id="name"
                                    value={newChatRoomName}
                                    onChange={(e) => setNewChatRoomName(e.target.value)}
                                    className="col-span-3"
                                    placeholder="My Chat Room"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  onClick={handleCreateChatRoom}
                                  disabled={isCreatingRoom || !newChatRoomName.trim()}
                                >
                                  {isCreatingRoom ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Creating...
                                    </>
                                  ) : (
                                    "Create Room"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full text-xs mt-2">
                                <LinkIcon className="h-3.5 w-3.5 mr-1" />
                                Join via Link
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Join a chat room</DialogTitle>
                                <DialogDescription>
                                  Enter a chat room ID or paste a shared link to join.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="roomId" className="text-right">
                                    Room ID
                                  </Label>
                                  <Input
                                    id="roomId"
                                    value={joinChatRoomId}
                                    onChange={(e) => setJoinChatRoomId(e.target.value)}
                                    className="col-span-3"
                                    placeholder="Enter room ID or full link"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  onClick={() => handleJoinChatRoom("")}
                                  disabled={isJoiningRoom || !joinChatRoomId.trim()}
                                >
                                  {isJoiningRoom ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Joining...
                                    </>
                                  ) : (
                                    "Join Room"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>

                    {/* Mobile and desktop chat area */}
                    <div className="flex-1 flex flex-col h-full">
                      {/* Mobile header with chat room selector */}
                      <div className="md:hidden flex items-center justify-between p-2 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">{getActiveChatRoomName()}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          {activeChatRoom && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={() => copyRoomLink(activeChatRoom)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Share
                            </Button>
                          )}
                          <Sheet open={isMobileChatRoomListOpen} onOpenChange={setIsMobileChatRoomListOpen}>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs h-7 px-2">
                                <Menu className="h-3.5 w-3.5" />
                                Chats
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0">
                              <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70">
                                <h3 className="font-medium flex items-center gap-2 text-sm">
                                  <UserPlus className="h-4 w-4 text-primary" />
                                  Private Chats
                                </h3>
                              </div>
                              <div className="overflow-auto h-full custom-scrollbar">
                                <div className="p-2 space-y-1">
                                  {chatRooms.map((room) => (
                                    <Button
                                      key={room.id}
                                      variant={activeChatRoom === room.id ? "secondary" : "ghost"}
                                      className={`w-full justify-start text-left rounded-lg text-sm ${
                                        activeChatRoom === room.id
                                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                                          : ""
                                      }`}
                                      onClick={() => handleChatRoomSelect(room.id)}
                                    >
                                      <span className="truncate">{room.name}</span>
                                      <ChevronRight className="ml-auto h-4 w-4" />
                                    </Button>
                                  ))}
                                </div>
                                <div className="p-3 mt-2 border-t space-y-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-full">
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        New Chat Room
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Create a new chat room</DialogTitle>
                                        <DialogDescription>
                                          Create a private chat room and invite others by sharing the link.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                          <Label htmlFor="name-mobile" className="text-right">
                                            Name
                                          </Label>
                                          <Input
                                            id="name-mobile"
                                            value={newChatRoomName}
                                            onChange={(e) => setNewChatRoomName(e.target.value)}
                                            className="col-span-3"
                                            placeholder="My Chat Room"
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          type="submit"
                                          onClick={handleCreateChatRoom}
                                          disabled={isCreatingRoom || !newChatRoomName.trim()}
                                        >
                                          {isCreatingRoom ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Creating...
                                            </>
                                          ) : (
                                            "Create Room"
                                          )}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>

                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-full">
                                        <LinkIcon className="h-4 w-4 mr-2" />
                                        Join via Link
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Join a chat room</DialogTitle>
                                        <DialogDescription>
                                          Enter a chat room ID or paste a shared link to join.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                          <Label htmlFor="roomId-mobile" className="text-right">
                                            Room ID
                                          </Label>
                                          <Input
                                            id="roomId-mobile"
                                            value={joinChatRoomId}
                                            onChange={(e) => setJoinChatRoomId(e.target.value)}
                                            className="col-span-3"
                                            placeholder="Enter room ID or full link"
                                          />
                                        </div>
                                      </div>
                                      <DialogFooter>
                                        <Button
                                          type="submit"
                                          onClick={() => handleJoinChatRoom("")}
                                          disabled={isJoiningRoom || !joinChatRoomId.trim()}
                                        >
                                          {isJoiningRoom ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Joining...
                                            </>
                                          ) : (
                                            "Join Room"
                                          )}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        </div>
                      </div>

                      {/* Desktop header */}
                      <div className="hidden md:flex items-center justify-between p-2 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">{getActiveChatRoomName()}</h3>
                        </div>
                        {activeChatRoom && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => copyRoomLink(activeChatRoom)}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Share Link
                          </Button>
                        )}
                      </div>

                      {/* Chat messages area */}
                      <div
                        className="flex-1 overflow-auto p-3 custom-scrollbar"
                        onScroll={handleScroll}
                        ref={scrollAreaRef}
                      >
                        {activeChatRoom && hasMoreMessages[`private_${activeChatRoom}`] && (
                          <div className="flex justify-center mb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1 rounded-full text-xs h-7 px-3"
                              onClick={loadMoreMessages}
                              disabled={loadingMore}
                            >
                              {loadingMore ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <ArrowUp className="h-3 w-3" />
                                  Load older messages
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        <div ref={messagesStartRef} />

                        <AnimatePresence initial={false}>
                          {loading && (!activeChatRoom || !privateListeners[activeChatRoom]) ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                              <p className="text-muted-foreground text-sm">Loading messages...</p>
                            </div>
                          ) : !activeChatRoom ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-primary/10 p-3 rounded-full mb-3">
                                <UserPlus className="h-6 w-6 text-primary" />
                              </div>
                              <p className="text-muted-foreground text-center text-sm">No chat room selected</p>
                              <p className="text-muted-foreground text-center text-sm">
                                Create a new room or join an existing one
                              </p>
                            </div>
                          ) : (privateMessages[activeChatRoom]?.length || 0) === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-primary/10 p-3 rounded-full mb-3">
                                <MessageSquare className="h-6 w-6 text-primary" />
                              </div>
                              <p className="text-muted-foreground text-center text-sm">No messages yet.</p>
                              <p className="text-muted-foreground text-center text-sm">
                                Start the conversation or share the link to invite others!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(privateMessages[activeChatRoom] || []).map((msg) => (
                                <motion.div
                                  key={msg.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`flex ${isCurrentUser(msg.sender) ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`flex gap-2 max-w-[90%] ${isCurrentUser(msg.sender) ? "flex-row-reverse" : "flex-row"}`}
                                  >
                                    <Avatar className="h-7 w-7 border-2 border-white dark:border-gray-800 shadow-sm">
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
                                        <span className="text-xs font-medium">{msg.senderName}</span>
                                        {isCurrentUser(msg.sender) && (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                                <MoreVertical className="h-3 w-3" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem
                                                className="text-destructive focus:text-destructive text-xs"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                              >
                                                <Trash2 className="h-3 w-3 mr-2" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </div>
                                      <div
                                        className={`rounded-2xl p-2 shadow-sm ${
                                          isCurrentUser(msg.sender)
                                            ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-tr-none"
                                            : "bg-gray-100 dark:bg-gray-700 rounded-tl-none"
                                        }`}
                                      >
                                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
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
                      <form
                        onSubmit={handleSendMessage}
                        className="p-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm"
                      >
                        <div className="flex flex-col gap-1 bg-white dark:bg-gray-900 rounded-lg p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Type your message..."
                              value={messageInput}
                              onChange={handleInputChange}
                              className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm"
                              disabled={!activeChatRoom}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="rounded-full px-3 text-xs h-8"
                              disabled={!messageInput.trim() || !activeChatRoom || wordCount > 100}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Send
                            </Button>
                          </div>
                          <div className="text-xs text-right text-muted-foreground px-1">
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
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="default"
        size="icon"
        className="relative h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
    </div>
  )
}
