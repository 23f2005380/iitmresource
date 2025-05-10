"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { MessageCircle, X, Send, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/app/auth-context"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
  id: string
  text: string
  userId: string
  userName: string
  timestamp: Timestamp
  userPhotoURL?: string
}

interface ChatRoom {
  id: string
  name: string
  createdBy: string
  createdAt: Timestamp
  members: string[]
  lastMessage?: string
  lastMessageTime?: Timestamp
  isPrivate?: boolean
}

export function FloatingChat() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null)
  const [newChatRoomName, setNewChatRoomName] = useState("")
  const [activeTab, setActiveTab] = useState("chats")
  const [joinChatRoomId, setJoinChatRoomId] = useState("")
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen, isMinimized])

  // Fetch chat rooms
  useEffect(() => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
      const q = query(
        collection(db, "chatRooms"),
        where("members", "array-contains", user.uid),
        orderBy("lastMessageTime", "desc"),
      )

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const rooms = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ChatRoom[]
          setChatRooms(rooms)
          setIsLoading(false)

          // If no active chat room is selected and we have rooms, select the first one
          if (!activeChatRoom && rooms.length > 0) {
            setActiveChatRoom(rooms[0])
          }
        },
        (err) => {
          console.error("Error fetching chat rooms:", err)
          setError("Failed to load chat rooms")
          setIsLoading(false)
        },
      )

      return () => {
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      }
    } catch (err) {
      console.error("Error setting up chat rooms listener:", err)
      setError("Failed to set up chat rooms listener")
      setIsLoading(false)
    }
  }, [user])

  // Fetch messages for active chat room
  useEffect(() => {
    if (!user || !activeChatRoom) return

    setIsLoading(true)
    setError(null)

    try {
      const q = query(collection(db, "chatRooms", activeChatRoom.id, "messages"), orderBy("timestamp", "asc"))

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[]
          setMessages(msgs)
          setIsLoading(false)

          // Mark messages as read
          if (isOpen && !isMinimized) {
            setUnreadMessages((prev) => ({
              ...prev,
              [activeChatRoom.id]: 0,
            }))
          }
        },
        (err) => {
          console.error("Error fetching messages:", err)
          setError("Failed to load messages")
          setIsLoading(false)
        },
      )

      return () => {
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      }
    } catch (err) {
      console.error("Error setting up messages listener:", err)
      setError("Failed to set up messages listener")
      setIsLoading(false)
    }
  }, [user, activeChatRoom, isOpen, isMinimized])

  // Track unread messages
  useEffect(() => {
    if (!user) return

    const unsubscribes: (() => void)[] = []

    chatRooms.forEach((room) => {
      try {
        const q = query(
          collection(db, "chatRooms", room.id, "messages"),
          orderBy("timestamp", "desc"),
          where("timestamp", ">", Timestamp.now()),
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isOpen || isMinimized || activeChatRoom?.id !== room.id) {
            const newMessages = snapshot.docs.filter((doc) => doc.data().userId !== user.uid)
            if (newMessages.length > 0) {
              setUnreadMessages((prev) => ({
                ...prev,
                [room.id]: (prev[room.id] || 0) + newMessages.length,
              }))
            }
          }
        })

        unsubscribes.push(unsubscribe)
      } catch (err) {
        console.error("Error setting up unread messages listener:", err)
      }
    })

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe()
        }
      })
    }
  }, [user, chatRooms, isOpen, isMinimized, activeChatRoom])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activeChatRoom || !newMessage.trim()) return

    try {
      // Add message to the chat room
      await addDoc(collection(db, "chatRooms", activeChatRoom.id, "messages"), {
        text: newMessage,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userPhotoURL: user.photoURL,
        timestamp: serverTimestamp(),
      })

      // Update last message in chat room
      await updateDoc(doc(db, "chatRooms", activeChatRoom.id), {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
      })

      setNewMessage("")
    } catch (err) {
      console.error("Error sending message:", err)
      setError("Failed to send message")
    }
  }

  const handleCreateChatRoom = async () => {
    if (!user || !newChatRoomName.trim()) return

    try {
      const docRef = await addDoc(collection(db, "chatRooms"), {
        name: newChatRoomName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        members: [user.uid],
        lastMessageTime: serverTimestamp(),
      })

      setNewChatRoomName("")
      setActiveTab("chats")

      // Set the newly created room as active
      const newRoom = {
        id: docRef.id,
        name: newChatRoomName,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        members: [user.uid],
      }
      setActiveChatRoom(newRoom)
    } catch (err) {
      console.error("Error creating chat room:", err)
      setError("Failed to create chat room")
    }
  }

  const handleJoinChatRoom = async () => {
    if (!user || !joinChatRoomId.trim()) return

    try {
      // Check if the input is a URL
      let roomId = joinChatRoomId.trim()

      // Try to extract room ID from URL if it's a URL
      if (roomId.includes("/")) {
        const urlParts = roomId.split("/")
        roomId = urlParts[urlParts.length - 1]
      }

      console.log("Attempting to join room with ID:", roomId)

      // Check if room exists
      const roomRef = doc(db, "chatRooms", roomId)
      const roomSnap = await getDoc(roomRef)

      if (!roomSnap.exists()) {
        setError("Chat room not found")
        return
      }

      const roomData = roomSnap.data() as ChatRoom

      // Check if user is already a member
      if (roomData.members.includes(user.uid)) {
        setActiveChatRoom({
          id: roomId,
          ...roomData,
        })
        setJoinChatRoomId("")
        setActiveTab("chats")
        return
      }

      // Add user to members
      await updateDoc(roomRef, {
        members: arrayUnion(user.uid),
      })

      setJoinChatRoomId("")
      setActiveTab("chats")
      setActiveChatRoom({
        id: roomId,
        ...roomData,
        members: [...roomData.members, user.uid],
      })

      console.log("Successfully joined room:", roomId)
    } catch (err) {
      console.error("Error joining chat room:", err)
      setError("Failed to join chat room. Check if you have the correct room ID and try again.")
    }
  }

  const handleChatRoomClick = (room: ChatRoom) => {
    setActiveChatRoom(room)
    // Reset unread count for this room
    setUnreadMessages((prev) => ({
      ...prev,
      [room.id]: 0,
    }))
  }

  const handleToggleChat = () => {
    setIsOpen(!isOpen)
    setIsMinimized(false)
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(false)
  }

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMinimized(!isMinimized)
  }

  const formatTime = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return ""

    const date = timestamp.toDate()
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getTotalUnreadCount = () => {
    return Object.values(unreadMessages).reduce((sum, count) => sum + count, 0)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Stop propagation to prevent issues with parent scrolling
    e.stopPropagation()
  }

  if (!user) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`bg-background border rounded-lg shadow-lg mb-2 overflow-hidden flex flex-col ${
              isMinimized ? "w-72" : "w-80 sm:w-96 md:w-[450px]"
            }`}
            style={{
              height: isMinimized ? "auto" : "500px",
              maxHeight: isMinimized ? "auto" : "80vh",
            }}
          >
            {/* Chat Header */}
            <div className="bg-primary text-primary-foreground p-3 flex justify-between items-center">
              <div className="flex items-center space-x-2 overflow-hidden">
                <MessageCircle className="h-5 w-5" />
                <span className="font-medium truncate">{activeChatRoom ? activeChatRoom.name : "Chat"}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary/90"
                  onClick={handleMinimize}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary/90"
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Chat Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                  <TabsList className="grid grid-cols-3 p-0 h-10">
                    <TabsTrigger value="chats" className="rounded-none">
                      Chats
                    </TabsTrigger>
                    <TabsTrigger value="create" className="rounded-none">
                      Create
                    </TabsTrigger>
                    <TabsTrigger value="join" className="rounded-none">
                      Join
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chats" className="flex-1 flex flex-col p-0 m-0">
                    {chatRooms.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                        <p>No chat rooms yet</p>
                        <p className="text-sm">Create or join a chat room to start messaging</p>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        {/* Chat Room List */}
                        <ScrollArea className="border-b h-24 flex-shrink-0">
                          <div className="p-2 space-y-1">
                            {chatRooms.map((room) => (
                              <div
                                key={room.id}
                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-muted ${
                                  activeChatRoom?.id === room.id ? "bg-muted" : ""
                                }`}
                                onClick={() => handleChatRoomClick(room)}
                              >
                                <div className="flex items-center space-x-2 overflow-hidden">
                                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <MessageCircle className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="font-medium truncate">{room.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {room.lastMessage || "No messages yet"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
                                  <div className="text-xs text-muted-foreground">
                                    {formatTime(room.lastMessageTime)}
                                  </div>
                                  {unreadMessages[room.id] > 0 && (
                                    <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                      {unreadMessages[room.id]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>

                        {/* Messages Area */}
                        {activeChatRoom ? (
                          <>
                            <ScrollArea className="flex-1 p-3" onScroll={handleScroll}>
                              {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                                  <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                                  <p>No messages yet</p>
                                  <p className="text-sm">Be the first to send a message!</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {messages.map((message) => (
                                    <div
                                      key={message.id}
                                      className={`flex ${
                                        message.userId === user.uid ? "justify-end" : "justify-start"
                                      }`}
                                    >
                                      <div
                                        className={`max-w-[80%] rounded-lg p-3 ${
                                          message.userId === user.uid
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}
                                      >
                                        {message.userId !== user.uid && (
                                          <div className="font-medium text-xs mb-1">
                                            {message.userName || "Anonymous"}
                                          </div>
                                        )}
                                        <div className="break-words">{message.text}</div>
                                        <div className="text-xs mt-1 opacity-70 text-right">
                                          {formatTime(message.timestamp)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  <div ref={messagesEndRef} />
                                </div>
                              )}
                            </ScrollArea>

                            {/* Message Input */}
                            <form onSubmit={handleSendMessage} className="p-3 border-t">
                              <div className="flex space-x-2">
                                <Textarea
                                  value={newMessage}
                                  onChange={(e) => setNewMessage(e.target.value)}
                                  placeholder="Type a message..."
                                  className="min-h-[40px] max-h-[120px] resize-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault()
                                      handleSendMessage(e)
                                    }
                                  }}
                                />
                                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </form>
                          </>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                            <p>Select a chat room</p>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="create" className="flex-1 flex flex-col p-4 m-0">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="roomName" className="block text-sm font-medium mb-1">
                          Chat Room Name
                        </label>
                        <Input
                          id="roomName"
                          value={newChatRoomName}
                          onChange={(e) => setNewChatRoomName(e.target.value)}
                          placeholder="Enter a name for your chat room"
                        />
                      </div>
                      <Button onClick={handleCreateChatRoom} disabled={!newChatRoomName.trim()} className="w-full">
                        Create Chat Room
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="join" className="flex-1 flex flex-col p-4 m-0">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="roomId" className="block text-sm font-medium mb-1">
                          Chat Room ID or URL
                        </label>
                        <Input
                          id="roomId"
                          value={joinChatRoomId}
                          onChange={(e) => setJoinChatRoomId(e.target.value)}
                          placeholder="Enter chat room ID or URL"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Ask for a chat room ID from someone who has already joined
                        </p>
                      </div>
                      <Button onClick={handleJoinChatRoom} disabled={!joinChatRoomId.trim()} className="w-full">
                        Join Chat Room
                      </Button>
                      {error && <div className="text-sm text-red-500 mt-2">{error}</div>}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        className="rounded-full shadow-lg bg-primary hover:bg-primary/90 relative"
        onClick={handleToggleChat}
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            {getTotalUnreadCount() > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 px-1.5 py-0.5">
                {getTotalUnreadCount()}
              </Badge>
            )}
          </>
        )}
      </Button>
    </div>
  )
}
