"use client"

import { useState, useEffect } from "react"
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { auth, db } from "@/app/firebase"

interface BookmarkButtonProps {
  resourceId: string
  resourceType: "resource" | "project"
  size?: "sm" | "md" | "lg"
  variant?: "default" | "ghost" | "outline"
}

export function BookmarkButton({ resourceId, resourceType, size = "sm", variant = "ghost" }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    checkBookmarkStatus()
  }, [resourceId, resourceType])

  const checkBookmarkStatus = async () => {
    if (!auth.currentUser) return

    try {
      const bookmarksQuery = query(
        collection(db, "bookmarks"),
        where("userId", "==", auth.currentUser.uid),
        where("resourceId", "==", resourceId),
        where("resourceType", "==", resourceType),
      )

      const snapshot = await getDocs(bookmarksQuery)
      setIsBookmarked(!snapshot.empty)
    } catch (error) {
      console.error("Error checking bookmark status:", error)
    }
  }

  const toggleBookmark = async () => {
    if (!auth.currentUser) {
      toast({
        title: "Authentication required",
        description: "Please sign in to bookmark items",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const bookmarkId = `${auth.currentUser.uid}_${resourceType}_${resourceId}`
      const bookmarkRef = doc(db, "bookmarks", bookmarkId)

      if (isBookmarked) {
        await deleteDoc(bookmarkRef)
        setIsBookmarked(false)
        toast({
          title: "Bookmark removed",
          description: `${resourceType === "resource" ? "Resource" : "Project"} removed from bookmarks`,
        })
      } else {
        await setDoc(bookmarkRef, {
          userId: auth.currentUser.uid,
          resourceId,
          resourceType,
          createdAt: new Date(),
        })
        setIsBookmarked(true)
        toast({
          title: "Bookmarked",
          description: `${resourceType === "resource" ? "Resource" : "Project"} added to bookmarks`,
        })
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error)
      toast({
        title: "Error",
        description: "Failed to update bookmark",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const iconSize = size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6"

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleBookmark}
      disabled={loading}
      className={`${isBookmarked ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground"}`}
    >
      {isBookmarked ? <BookmarkCheck className={iconSize} /> : <Bookmark className={iconSize} />}
    </Button>
  )
}
