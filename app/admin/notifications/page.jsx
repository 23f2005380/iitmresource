"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { getDatabase, ref, update } from "firebase/database"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { db, auth } from "../../firebase"
import { Navbar } from "../../../components/navbar"

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [sendToAll, setSendToAll] = useState(false)
  const [allowReply, setAllowReply] = useState(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const router = useRouter()
  const searchInputRef = useRef(null)

  // Count words in a string
  const countWords = (text) => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }

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
          alert("Access denied. You don't have permission to access this page.")
          router.push("/")
          return
        }

        setIsAdmin(true)
        fetchUsers()
      } catch (error) {
        console.error("Error checking admin status:", error)
        router.push("/")
      }
    }

    checkAdmin()
  }, [router])

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, "users")
      const querySnapshot = await getDocs(usersRef)

      const users = []
      querySnapshot.forEach((doc) => {
        const userData = doc.data()
        users.push({
          uid: doc.id,
          ...userData,
        })
      })

      setAllUsers(users)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching users:", error)
      alert("Failed to fetch users")
      setLoading(false)
    }
  }

  // Debounced search function
  const debouncedSearch = useCallback(
    (query) => {
      setTimeout(() => {
        if (!query.trim()) {
          setSearchResults([])
          setIsSearching(false)
          return
        }

        const filteredUsers = allUsers.filter(
          (user) =>
            user.email.toLowerCase().includes(query.toLowerCase()) ||
            (user.displayName && user.displayName.toLowerCase().includes(query.toLowerCase())),
        )

        // Limit to 10 results for better performance
        setSearchResults(filteredUsers.slice(0, 10))
        setIsSearching(false)
      }, 300)
    },
    [allUsers],
  )

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    setIsSearching(true)
    debouncedSearch(query)
  }

  // Select a user
  const selectUser = (user) => {
    if (!selectedUsers.some((u) => u.uid === user.uid)) {
      setSelectedUsers([...selectedUsers, user])
    }
    setSearchQuery("")
    setSearchResults([])

    // Focus back on search input
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  // Remove a selected user
  const removeSelectedUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((user) => user.uid !== userId))
  }

  // Handle send to all toggle
  const handleSendToAllToggle = (checked) => {
    setSendToAll(checked)
    if (checked) {
      setSelectedUsers([])
    }
  }

  // Send notification
  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please provide both title and message")
      return
    }

    if (!sendToAll && selectedUsers.length === 0) {
      alert("Please select at least one recipient or choose to send to all users")
      return
    }

    setSending(true)

    try {
      console.log("Sending notification:", { title, message, sendToAll })

      const rtdb = getDatabase()
      // Generate a unique notification ID
      const notificationId = Date.now().toString()

      const notificationData = {
        title,
        message,
        sender: auth.currentUser?.email || "admin",
        timestamp: Date.now(),
        read: false,
        allowReply,
      }

      console.log("Notification data:", notificationData)

      // Create a batch of updates to perform atomically
      const updates = {}

      if (sendToAll) {
        // Send to all users
        console.log(`Sending to all ${allUsers.length} users`)

        const allNotification = {
          ...notificationData,
          recipients: "all",
        }

        // For each user, create a notification entry
        for (const user of allUsers) {
          if (user.email) {
            const userEmail = user.email.replace(/\./g, ",")
            updates[`notifications/${userEmail}/${notificationId}`] = allNotification
            console.log(`Added notification for user: ${user.email}`)
          }
        }
      } else {
        // Send to selected users
        console.log(`Sending to ${selectedUsers.length} selected users`)

        const selectedNotification = {
          ...notificationData,
          recipients: selectedUsers.map((user) => user.email),
        }

        // For each selected user, create a notification entry
        for (const user of selectedUsers) {
          if (user.email) {
            const userEmail = user.email.replace(/\./g, ",")
            updates[`notifications/${userEmail}/${notificationId}`] = selectedNotification
            console.log(`Added notification for user: ${user.email}`)
          }
        }
      }

      console.log("Updates to be applied:", updates)

      // Perform all updates in a single operation
      await update(ref(rtdb), updates)
      console.log("Notifications saved successfully")

      alert(
        sendToAll
          ? "Notification has been sent to all users"
          : `Notification has been sent to ${selectedUsers.length} user(s)`,
      )

      // Reset form
      setTitle("")
      setMessage("")
      setSelectedUsers([])
      setSendToAll(false)
    } catch (error) {
      console.error("Error sending notification:", error)
      alert("Failed to send notification. Please check your permissions.")
    } finally {
      setSending(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
     
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="card w-full max-w-md">
            <div className="card-header text-center">
              <h2>Checking permissions...</h2>
              <p className="text-light">Please wait while we verify your access</p>
            </div>
            <div className="card-content flex justify-center">
              <div className="loading-spinner"></div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
     
      <main className="flex-1 container py-4 md:py-8 px-2 md:px-4">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin">
            <button className="btn btn-outline btn-icon">
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
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          </Link>
          <h1 className="text-2xl font-bold">Send Notifications</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h2 className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                </svg>
                Compose Notification
              </h2>
              <p className="text-light">Create and send notifications to users</p>
            </div>
            <div className="card-content space-y-4">
              <div className="form-group">
                <label htmlFor="title" className="form-label">
                  Title
                </label>
                <input
                  id="title"
                  className="form-input"
                  placeholder="Notification title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">
                  Message
                </label>
                <textarea
                  id="message"
                  className="form-textarea"
                  placeholder="Notification message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                ></textarea>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allow-reply"
                  checked={allowReply}
                  onChange={(e) => setAllowReply(e.target.checked)}
                />
                <label htmlFor="allow-reply">Allow users to reply to this notification</label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="send-to-all"
                  checked={sendToAll}
                  onChange={(e) => handleSendToAllToggle(e.target.checked)}
                />
                <label htmlFor="send-to-all">Send to all users</label>
              </div>

              {!sendToAll && (
                <div className="form-group">
                  <label className="form-label">Recipients</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedUsers.map((user) => (
                      <div key={user.uid} className="badge badge-primary flex items-center gap-1">
                        <span className="truncate" style={{ maxWidth: "150px" }}>
                          {user.displayName || user.email}
                        </span>
                        <button
                          className="btn btn-ghost btn-icon btn-sm ml-1"
                          onClick={() => removeSelectedUser(user.uid)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
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
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="relative">
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
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-light"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      ref={searchInputRef}
                      placeholder="Search users by name or email"
                      className="form-input pl-10"
                      value={searchQuery}
                      onChange={handleSearchChange}
                    />
                  </div>

                  {isSearching && (
                    <div className="flex items-center justify-center py-2">
                      <div className="loading-spinner-sm"></div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div
                      className="custom-scrollbar border rounded-md mt-2"
                      style={{ maxHeight: "200px", overflowY: "auto" }}
                    >
                      <div className="p-2 space-y-1">
                        {searchResults.map((user) => (
                          <button
                            key={user.uid}
                            className="btn btn-ghost w-full justify-start text-left py-2"
                            onClick={() => selectUser(user)}
                          >
                            <div className="flex items-center gap-2">
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
                                className="text-light"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              <div className="flex flex-col">
                                <span className="font-medium">{user.displayName || "User"}</span>
                                <span className="text-xs text-light">{user.email}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn btn-primary w-full"
                onClick={sendNotification}
                disabled={sending || !title.trim() || !message.trim() || (!sendToAll && selectedUsers.length === 0)}
              >
                {sending ? (
                  <>
                    <div className="loading-spinner-sm mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
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
                      className="mr-2"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Recipients
              </h2>
              <p className="text-light">
                {sendToAll
                  ? `Sending to all users (${allUsers.length})`
                  : `Selected ${selectedUsers.length} recipient(s)`}
              </p>
            </div>
            <div className="card-content">
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="loading-spinner"></div>
                </div>
              ) : sendToAll ? (
                <div className="space-y-4">
                  <p className="text-sm">
                    Your notification will be sent to all {allUsers.length} users on the platform.
                  </p>
                  <hr />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Recipients</span>
                    <span className="badge">{allUsers.length}</span>
                  </div>
                </div>
              ) : selectedUsers.length === 0 ? (
                <div className="text-center py-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-2 text-light"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <p className="text-sm text-light">No recipients selected</p>
                  <p className="text-xs text-light mt-1">Search and select users or enable "Send to all"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="custom-scrollbar" style={{ maxHeight: "300px", overflowY: "auto" }}>
                    <div className="space-y-2">
                      {selectedUsers.map((user) => (
                        <div key={user.uid} className="flex items-center justify-between p-2 rounded-md border">
                          <div className="flex items-center gap-2">
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
                              className="text-light"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <div className="overflow-hidden">
                              <p className="font-medium truncate">{user.displayName || "User"}</p>
                              <p className="text-xs text-light truncate">{user.email}</p>
                            </div>
                          </div>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => removeSelectedUser(user.uid)}
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
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <hr />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Recipients</span>
                    <span className="badge">{selectedUsers.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
