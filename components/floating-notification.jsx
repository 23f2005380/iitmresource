"use client"

import { useState, useEffect } from "react"
import { getDatabase, ref, onValue, off } from "firebase/database"
import { useAuth } from "../context/AuthContext"
import NotificationItem from "./notification-item"

const FloatingNotification = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const auth = useAuth()

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    const rtdb = getDatabase()
    const userEmail = user.email?.replace(/\./g, ",") || "anonymous"
    const userNotificationsRef = ref(rtdb, `notifications/${userEmail}`)

    const handleNotifications = (snapshot) => {
      try {
        if (!snapshot.exists()) {
          setNotifications([])
          setUnreadCount(0)
          return
        }

        const notificationsData = snapshot.val()
        const notificationsArray = []
        let unread = 0

        for (const id in notificationsData) {
          const notification = {
            id,
            ...notificationsData[id],
          }
          notificationsArray.push(notification)
          if (!notification.read) unread++
        }

        // Sort by timestamp (newest first)
        notificationsArray.sort((a, b) => b.timestamp - a.timestamp)

        setNotifications(notificationsArray)
        setUnreadCount(unread)
      } catch (error) {
        console.error("Error processing notifications:", error)
        setNotifications([])
        setUnreadCount(0)
      }
    }

    onValue(userNotificationsRef, handleNotifications, (error) => {
      console.error("Error loading notifications:", error)
      setNotifications([])
      setUnreadCount(0)
    })

    return () => {
      off(userNotificationsRef, "value")
    }
  }, [])

  const toggleNotifications = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={toggleNotifications}
        className="relative bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-6-6c-1.105 0-2.15.306-3.07.853A6.005 6.005 0 003 11v3.158a2.032 2.032 0 01-.595 2.842L4 17h5m6 0h1.965a1.969 1.969 0 001.595-2.842L21 13V11a6.002 6.002 0 00-6-6c-1.105 0-2.15.306-3.07.853A6.005 6.005 0 003 11v3.158a2.032 2.032 0 01-.595 2.842L4 17h5m6 0h1.965a1.969 1.969 0 001.595-2.842L21 13V11a6.002 6.002 0 00-6-6c-1.105 0-2.15.306-3.07.853A6.005 6.005 0 003 11v3.158a2.032 2.032 0 01-.595 2.842L4 17h5"
          />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute top-0 right-0 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-20 right-0 w-80 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="py-3 px-5 bg-gray-100 border-b">
            <h5 className="text-lg font-semibold">Notifications</h5>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            ) : (
              <div className="py-4 px-5 text-gray-500">No notifications yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FloatingNotification
