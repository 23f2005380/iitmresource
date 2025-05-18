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
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
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
  UserPlus,
  Copy,
  Lock,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
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
  chatRoomId?: string | null
  photoURL?: string | null
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
  privateMessages: { [roomId: string]: Message[] }
  lastUpdated: number
}

// Number of messages to load initially and when loading more
const MESSAGES_PER_PAGE = 15

export default function ChatPage() {
  // Message input state
  const [messageInput, setMessageInput] = useState("")
  const [wordCount, setWordCount] = useState(0)

  // Messages state - separate states for general, subject, and private chats
  const [generalMessages, setGeneralMessages] = useState<Message[]>([])
  const [subjectMessages, setSubjectMessages] = useState<{ [subjectId: string]: Message[] }>({})
  const [privateMessages, setPrivateMessages] = useState<{ [roomId: string]: Message[] }>({})

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [activeChatRoom, setActiveChatRoom] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("general")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isMobileSubjectListOpen, setIsMobileSubjectListOpen] = useState(false)
  const [isMobileChatRoomListOpen, setIsMobileChatRoomListOpen] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState<{ [key: string]: boolean }>({
    general: true,
  })

  // New chat room state
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteLink, setInviteLink] = useState("")

  // Last document references for pagination
  const [lastDocRefs, setLastDocRefs] = useState<{ [key: string]: any }>({})

  // Track if listeners are set up
  const [generalListenerActive, setGeneralListenerActive] = useState(false)
  const [subjectListeners, setSubjectListeners] = useState<{ [subjectId: string]: boolean }>({})
  const [privateListeners, setPrivateListeners] = useState<{ [roomId: string]: boolean }>({})

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesStartRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for room invitation in URL
  useEffect(() => {
    const roomId = searchParams.get("join")
    if (roomId && auth.currentUser) {
      joinChatRoom(roomId)
    }
  }, [searchParams, auth.currentUser])

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
      } else {
        // Load chat rooms for the user
        loadChatRooms()

        // Set up general chat listener by default
        if (!generalListenerActive) {
          setupGeneralChatListener()
        }
      }
    })

    return () => unsubscribe()
  }, [router, toast])

  // Load chat rooms for the current user
  const loadChatRooms = async () => {
    if (!auth.currentUser) return

    try {
      const roomsQuery = query(
        collection(db, "chatRooms"),
        where("participants", "array-contains", auth.currentUser.email),
      )

      const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
        const rooms: ChatRoom[] = []
        snapshot.forEach((doc) => {
          rooms.push({
            id: doc.id,
            ...doc.data(),
          } as ChatRoom)
        })

        // Sort rooms by creation date (newest first)
        rooms.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.() || new Date(0)
          const timeB = b.createdAt?.toDate?.() || new Date(0)
          return timeB.getTime() - timeA.getTime()
        })

        setChatRooms(rooms)

        // Initialize hasMoreMessages for each room
        const newHasMore = { ...hasMoreMessages }
        rooms.forEach((room) => {
          newHasMore[room.id] = true
        })
        setHasMoreMessages(newHasMore)
      })

      return unsubscribe
    } catch (error) {
      console.error("Error loading chat rooms:", error)
    }
  }

  // Create a new chat room
  const createChatRoom = async () => {
    if (!auth.currentUser || !newRoomName.trim()) return

    try {
      setIsCreatingRoom(true)

      const roomData = {
        name: newRoomName.trim(),
        createdBy: auth.currentUser.email,
        createdAt: serverTimestamp(),
        participants: [auth.currentUser.email],
      }

      const roomRef = await addDoc(collection(db, "chatRooms"), roomData)

      toast({
        title: "Chat room created",
        description: "Your private chat room has been created successfully",
      })

      setNewRoomName("")
      setIsCreatingRoom(false)
      setActiveTab("private")
      setActiveChatRoom(roomRef.id)

      // Generate and show invite link
      const inviteLink = `${window.location.origin}/chat?join=${roomRef.id}`
      setInviteLink(inviteLink)
      setShowInviteDialog(true)
    } catch (error) {
      console.error("Error creating chat room:", error)
      toast({
        title: "Error",
        description: "Failed to create chat room. Please try again.",
        variant: "destructive",
      })
      setIsCreatingRoom(false)
    }
  }

  // Join a chat room by ID
  const joinChatRoom = async (roomId: string) => {
    if (!auth.currentUser) return

    try {
      const roomRef = doc(db, "chatRooms", roomId)
      const roomSnap = await getDoc(roomRef)

      if (!roomSnap.exists()) {
        toast({
          title: "Room not found",
          description: "The chat room you're trying to join doesn't exist",
          variant: "destructive",
        })
        return
      }

      const roomData = roomSnap.data()

      // Check if user is already a participant
      if (roomData.participants.includes(auth.currentUser.email)) {
        // Just switch to the room
        setActiveTab("private")
        setActiveChatRoom(roomId)
        toast({
          title: "Room joined",
          description: `You're already a member of "${roomData.name}"`,
        })
        return
      }

      // Add user to participants
      await updateDoc(roomRef, {
        participants: arrayUnion(auth.currentUser.email),
      })

      toast({
        title: "Room joined",
        description: `You've joined "${roomData.name}"`,
      })

      setActiveTab("private")
      setActiveChatRoom(roomId)
    } catch (error) {
      console.error("Error joining chat room:", error)
      toast({
        title: "Error",
        description: "Failed to join chat room. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Check if a user exists by email
  const checkUserExists = async (email: string) => {
    try {
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("email", "==", email))
      const querySnapshot = await getDocs(q)

      return !querySnapshot.empty
    } catch (error) {
      console.error("Error checking user:", error)
      return false
    }
  }

  // Invite a user to a chat room
  const inviteUserByEmail = async () => {
    if (!auth.currentUser || !activeChatRoom || !inviteEmail.trim()) return

    try {
      // Check if email is valid
      if (!/\S+@\S+\.\S+/.test(inviteEmail)) {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address",
          variant: "destructive",
        })
        return
      }

      // Check if user exists
      const userExists = await checkUserExists(inviteEmail.trim())
      if (!userExists) {
        toast({
          title: "User not found",
          description: "This email is not registered in the system",
          variant: "destructive",
        })
        return
      }

      const roomRef = doc(db, "chatRooms", activeChatRoom)

      // Add user to participants
      await updateDoc(roomRef, {
        participants: arrayUnion(inviteEmail.trim()),
      })

      toast({
        title: "Invitation sent",
        description: `${inviteEmail} has been added to the chat room`,
      })

      setInviteEmail("")
    } catch (error) {
      console.error("Error inviting user:", error)
      toast({
        title: "Error",
        description: "Failed to invite user. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Copy invite link to clipboard
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({
      title: "Link copied",
      description: "Invite link copied to clipboard",
    })
  }

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
            setGeneralMessages(parsedData.generalMessages || [])
            setSubjectMessages(parsedData.subjectMessages || {})
            setPrivateMessages(parsedData.privateMessages || {})

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
            } else if (activeTab === "private" && activeChatRoom) {
              setupPrivateChatListener(activeChatRoom, true)
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
      } else if (activeTab === "private" && activeChatRoom) {
        setupPrivateChatListener(activeChatRoom)
      }
    }
  }, [])

  // Save messages to local storage whenever they change, but throttled
  useEffect(() => {
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
  }, [generalMessages, subjectMessages, privateMessages])

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
    } else if (activeTab === "private" && activeChatRoom && !privateListeners[activeChatRoom]) {
      setLoading(true)
      setupPrivateChatListener(activeChatRoom)
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
  }, [activeTab, activeSubject, activeChatRoom])

  // Setup general chat listener
  const setupGeneralChatListener = useCallback(
    (appendOnly = false) => {
      try {
        const messagesQuery = query(
          collection(db, "chats"),
          where("subjectId", "==", null),
          where("chatRoomId", "==", null),
          orderBy("timestamp", "desc"),
          limit(MESSAGES_PER_PAGE),
        )

        const unsubscribe = onSnapshot(
          messagesQuery,
          (snapshot) => {
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
          },
          (error) => {
            console.error("Error loading general chat messages:", error)
            setLoading(false)
            setGeneralListenerActive(true)
            toast({
              title: "Error loading messages",
              description: "There was a problem loading chat messages. Please try again.",
              variant: "destructive",
            })
          },
        )

        return unsubscribe
      } catch (error) {
        console.error("Error setting up general chat listener:", error)
        setLoading(false)
        setGeneralListenerActive(true)
        return () => {}
      }
    },
    [toast],
  )

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

  // Setup private chat listener
  const setupPrivateChatListener = useCallback((roomId: string, appendOnly = false) => {
    const messagesQuery = query(
      collection(db, "chats"),
      where("chatRoomId", "==", roomId),
      orderBy("timestamp", "desc"),
      limit(MESSAGES_PER_PAGE),
    )

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      if (snapshot.empty) {
        setHasMoreMessages((prev) => ({ ...prev, [roomId]: false }))
        setLoading(false)
        setPrivateListeners((prev) => ({ ...prev, [roomId]: true }))
        return
      }

      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[]

      // Save the last document for pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1]
      setLastDocRefs((prev) => ({ ...prev, [roomId]: lastDoc }))

      // Sort messages by timestamp (oldest first)
      messagesList.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(0)
        const timeB = b.timestamp?.toDate?.() || new Date(0)
        return timeA.getTime() - timeB.getTime()
      })

      if (appendOnly) {
        // Only append new messages that aren't already in the list
        setPrivateMessages((prev) => {
          const existingMessages = prev[roomId] || []
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
            [roomId]: combined,
          }
        })
      } else {
        setPrivateMessages((prev) => ({
          ...prev,
          [roomId]: messagesList,
        }))

        // Scroll to bottom after initial load
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        }, 100)
      }

      setPrivateListeners((prev) => ({
        ...prev,
        [roomId]: true,
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
        key = activeChatRoom
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
          where("subjectId", "==", key),
          orderBy("timestamp", "desc"),
          startAfter(lastDoc),
          limit(MESSAGES_PER_PAGE),
        )
      } else if (activeTab === "private" && activeChatRoom) {
        messagesQuery = query(
          collection(db, "chats"),
          where("chatRoomId", "==", key),
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
    const { scrollTop } = e.currentTarget

    // If scrolled to top (with a small threshold), load more messages
    if (scrollTop < 50) {
      let key: string | null = null

      if (activeTab === "general") {
        key = "general"
      } else if (activeTab === "subjects" && activeSubject) {
        key = activeSubject
      } else if (activeTab === "private" && activeChatRoom) {
        key = activeChatRoom
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
  const handleChatRoomSelect = (roomId: string) => {
    setActiveChatRoom(roomId)
    setIsMobileChatRoomListOpen(false) // Close mobile drawer after selection
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

  // Get active chat room name - memoized to improve performance
  const getActiveChatRoomName = useMemo(() => {
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-pink-200/30 to-purple-300/20 dark:from-blue-900/20 dark:to-indigo-800/10 blur-xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-gradient-to-tr from-blue-200/20 to-cyan-300/15 dark:from-blue-800/15 dark:to-cyan-700/10 blur-xl animate-float-medium"></div>

      <Navbar />
      <main className="flex-1 container py-4 md:py-8 px-2 md:px-4 relative z-10 flex items-center justify-center">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-xl shadow-lg border border-gray-100/50 dark:border-gray-700/50 h-[calc(100vh-8rem)] w-full max-w-6xl flex flex-col overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-500/5 before:to-purple-500/5 before:rounded-xl relative">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full w-full">
            <div className="border-b px-4 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto rounded-lg bg-gray-100/80 dark:bg-gray-700/80 p-1">
                <TabsTrigger value="general" className="flex items-center gap-2 rounded-md text-base">
                  <MessageSquare className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="subjects" className="flex items-center gap-2 rounded-md text-base">
                  <Users className="h-4 w-4" />
                  Subjects
                </TabsTrigger>
                <TabsTrigger value="private" className="flex items-center gap-2 rounded-md text-base">
                  <Lock className="h-4 w-4" />
                  Private
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

              {/* Private chat */}
              <TabsContent
                value="private"
                className="h-full m-0 p-0 w-full flex flex-col absolute inset-0 data-[state=inactive]:hidden"
              >
                <div className="flex h-full w-full">
                  {/* Desktop sidebar */}
                  <div className="hidden md:flex w-64 border-r h-full overflow-hidden flex flex-col bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
                    <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70 flex justify-between items-center">
                      <h3 className="font-medium flex items-center gap-2 text-base">
                        <Lock className="h-4 w-4 text-primary" />
                        Private Chats
                      </h3>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserPlus className="h-4 w-4 mr-1" />
                            New
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create a Private Chat Room</DialogTitle>
                            <DialogDescription>
                              Create a new private chat room and invite others to join.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="room-name">Room Name</Label>
                              <Input
                                id="room-name"
                                placeholder="Enter room name"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={createChatRoom} disabled={!newRoomName.trim() || isCreatingRoom}>
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
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                      <div className="p-2 space-y-1">
                        {chatRooms.length === 0 ? (
                          <div className="text-center p-4 text-muted-foreground">
                            <p>No private chats yet</p>
                            <p className="text-sm">Create one to get started</p>
                          </div>
                        ) : (
                          chatRooms.map((room) => (
                            <Button
                              key={room.id}
                              variant={activeChatRoom === room.id ? "secondary" : "ghost"}
                              className={`w-full justify-start text-left rounded-lg text-base ${
                                activeChatRoom === room.id ? "bg-primary/15 text-primary hover:bg-primary/20" : ""
                              }`}
                              onClick={() => handleChatRoomSelect(room.id)}
                            >
                              <span className="truncate">{room.name}</span>
                              <ChevronRight className="ml-auto h-4 w-4" />
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile and desktop chat area */}
                  <div className="flex-1 flex flex-col h-full">
                    {/* Mobile header with room selector */}
                    <div className="md:hidden flex items-center justify-between p-3 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-base">{getActiveChatRoomName}</h3>
                      </div>
                      <div className="flex gap-2">
                        <Sheet open={isMobileChatRoomListOpen} onOpenChange={setIsMobileChatRoomListOpen}>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-1 text-base">
                              <Menu className="h-4 w-4" />
                              Select Room
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="w-[80%] sm:w-[350px] p-0">
                            <div className="p-3 border-b bg-white/70 dark:bg-gray-800/70 flex justify-between items-center">
                              <h3 className="font-medium flex items-center gap-2 text-base">
                                <Lock className="h-4 w-4 text-primary" />
                                Private Chats
                              </h3>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    New
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Create a Private Chat Room</DialogTitle>
                                    <DialogDescription>
                                      Create a new private chat room and invite others to join.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="room-name-mobile">Room Name</Label>
                                      <Input
                                        id="room-name-mobile"
                                        placeholder="Enter room name"
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={createChatRoom} disabled={!newRoomName.trim() || isCreatingRoom}>
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
                            </div>
                            <div className="overflow-auto h-full custom-scrollbar">
                              <div className="p-2 space-y-1">
                                {chatRooms.length === 0 ? (
                                  <div className="text-center p-4 text-muted-foreground">
                                    <p>No private chats yet</p>
                                    <p className="text-sm">Create one to get started</p>
                                  </div>
                                ) : (
                                  chatRooms.map((room) => (
                                    <Button
                                      key={room.id}
                                      variant={activeChatRoom === room.id ? "secondary" : "ghost"}
                                      className={`w-full justify-start text-left rounded-lg text-base ${
                                        activeChatRoom === room.id
                                          ? "bg-primary/15 text-primary hover:bg-primary/20"
                                          : ""
                                      }`}
                                      onClick={() => handleChatRoomSelect(room.id)}
                                    >
                                      <span className="truncate">{room.name}</span>
                                      <ChevronRight className="ml-auto h-4 w-4" />
                                    </Button>
                                  ))
                                )}
                              </div>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </div>

                    {/* Desktop header */}
                    <div className="hidden md:flex items-center justify-between p-3 border-b bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-base">{getActiveChatRoomName}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeChatRoom && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="flex items-center gap-1">
                                  <UserPlus className="h-4 w-4 mr-1" />
                                  Invite
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Invite to {getActiveChatRoomName}</DialogTitle>
                                  <DialogDescription>Invite someone to join this private chat room.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="invite-email">Email Address</Label>
                                    <Input
                                      id="invite-email"
                                      placeholder="Enter email address"
                                      value={inviteEmail}
                                      onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Or share this invite link</Label>
                                    <div className="flex items-center gap-2">
                                      <Input readOnly value={`${window.location.origin}/chat?join=${activeChatRoom}`} />
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            `${window.location.origin}/chat?join=${activeChatRoom}`,
                                          )
                                          toast({
                                            title: "Link copied",
                                            description: "Invite link copied to clipboard",
                                          })
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={inviteUserByEmail} disabled={!inviteEmail.trim()}>
                                    Invite by Email
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          <Sparkles className="h-3 w-3 mr-1" /> Live
                        </Badge>
                      </div>
                    </div>

                    {/* Chat messages area */}
                    <div
                      className="flex-1 overflow-auto p-4 custom-scrollbar"
                      onScroll={handleScroll}
                      ref={scrollAreaRef}
                    >
                      {!activeChatRoom ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <Lock className="h-10 w-10 text-primary" />
                          </div>
                          {chatRooms.length === 0 ? (
                            <>
                              <p className="text-muted-foreground text-center text-base">No private chat rooms yet.</p>
                              <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => {
                                  const dialog = document.querySelector("dialog")
                                  if (dialog) {
                                    dialog.showModal()
                                  }
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Create a Private Chat Room
                              </Button>
                            </>
                          ) : (
                            <p className="text-muted-foreground text-center text-base">Please select a chat room</p>
                          )}
                        </div>
                      ) : activeChatRoom && hasMoreMessages[activeChatRoom] ? (
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
                      ) : null}

                      <div ref={messagesStartRef} />

                      <AnimatePresence initial={false}>
                        {loading && activeChatRoom && !privateListeners[activeChatRoom] ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                            <p className="text-muted-foreground text-base">Loading messages...</p>
                          </div>
                        ) : activeChatRoom && (privateMessages[activeChatRoom]?.length || 0) === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                              <MessageSquare className="h-10 w-10 text-primary" />
                            </div>
                            <p className="text-muted-foreground text-center text-base">No messages yet.</p>
                            <p className="text-muted-foreground text-center text-base">Start the conversation!</p>
                            <Button
                              variant="outline"
                              className="mt-4"
                              onClick={() => {
                                const dialog = document.querySelector("dialog")
                                if (dialog) {
                                  dialog.showModal()
                                }
                              }}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Invite Others
                            </Button>
                          </div>
                        ) : (
                          activeChatRoom && (
                            <div className="space-y-4">
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
                          )
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
                            disabled={!activeChatRoom}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            className="rounded-full px-4 text-base"
                            disabled={!messageInput.trim() || !activeChatRoom || wordCount > 100}
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

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat Room Created</DialogTitle>
            <DialogDescription>
              Your private chat room has been created. Share this link to invite others.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteLink} />
                <Button variant="outline" size="icon" onClick={copyInviteLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
