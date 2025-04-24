"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db, auth } from "@/app/firebase"

export function useAdminCheck() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = auth.currentUser
        if (!user) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const userRef = collection(db, "users")
        const q = query(userRef, where("email", "==", user.email))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const userData = querySnapshot.docs[0].data()
        setIsAdmin(userData.role === "admin")
        setLoading(false)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAdmin(false)
        setLoading(false)
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAdmin()
      } else {
        setIsAdmin(false)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return { isAdmin, loading }
}
