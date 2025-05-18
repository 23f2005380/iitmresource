"use client"

import { useState, useEffect } from "react"
import { auth } from "@/app/firebase"

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = auth.currentUser
        if (!user) {
          setIsAdmin(false)
          return
        }

        setIsAdmin(user.email === "admin@iitm.ac.in")
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAdmin(false)
      }
    }

    checkAdmin()
  }, [])

  return isAdmin
}
