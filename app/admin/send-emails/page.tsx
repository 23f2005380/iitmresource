"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { db, auth } from "../../firebase"
import { Navbar } from "../../../components/navbar"
import { motion } from "framer-motion"

export default function AdminSendEmailsPage() {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [selectedUsers, setSelectedUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [sendToAll, setSendToAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const router = useRouter()
  const searchInputRef = useRef(null)

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
            user.email?.toLowerCase().includes(query.toLowerCase()) ||
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

  // Send email
  const sendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      alert("Please provide both subject and message")
      return
    }

    if (!sendToAll && selectedUsers.length === 0) {
      alert("Please select at least one recipient or choose to send to all users")
      return
    }

    setSending(true)

    try {
      // Create email record in Firestore
      const emailData = {
        subject,
        message,
        sender: auth.currentUser?.email || "admin",
        timestamp: serverTimestamp(),
        recipients: sendToAll ? "all" : selectedUsers.map((user) => user.email),
        status: "pending", // pending, sent, failed
      }

      // Add to emails collection in Firestore
      const emailRef = await addDoc(collection(db, "emails"), emailData)

      // In a real application, you would trigger a server function to send the emails
      // For now, we'll just simulate it with a timeout
      setTimeout(async () => {
        try {
          // Update the email status to "sent"
          await addDoc(collection(db, "emails"), {
            ...emailData,
            status: "sent",
            sentAt: serverTimestamp(),
          })

          alert(
            sendToAll ? "Email has been sent to all users" : `Email has been sent to ${selectedUsers.length} user(s)`,
          )

          // Reset form
          setSubject("")
          setMessage("")
          setSelectedUsers([])
          setSendToAll(false)
          setSending(false)
        } catch (error) {
          console.error("Error updating email status:", error)
          setSending(false)
        }
      }, 2000)
    } catch (error) {
      console.error("Error sending email:", error)
      alert("Failed to send email. Please check your permissions.")
      setSending(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      <Navbar />
      <motion.main
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex-1 container py-4 md:py-8 px-2 md:px-4"
      >
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
          <h1 className="text-2xl font-bold">Send Emails</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="card"
          >
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
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Compose Email
              </h2>
              <p className="text-light">Create and send emails to users</p>
            </div>
            <div className="card-content space-y-4">
              <div className="form-group">
                <label htmlFor="subject" className="form-label">
                  Subject
                </label>
                <input
                  id="subject"
                  className="form-input"
                  placeholder="Email subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">
                  Message
                </label>
                <textarea
                  id="message"
                  className="form-textarea"
                  placeholder="Email message"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                ></textarea>
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
                onClick={sendEmail}
                disabled={sending || !subject.trim() || !message.trim() || (!sendToAll && selectedUsers.length === 0)}
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
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="card"
          >
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
                  <p className="text-sm">Your email will be sent to all {allUsers.length} users on the platform.</p>
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
          </motion.div>
        </div>
      </motion.main>
    </motion.div>
  )
}
