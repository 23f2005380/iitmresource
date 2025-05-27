"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { Bookmark, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BookmarkButton } from "@/components/bookmark-button"

interface BookmarkedItem {
  id: string
  title: string
  description: string
  type?: string
  resourceType: "resource" | "project"
  createdAt: any
  creatorName?: string
  subjectName?: string
  week?: number
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        fetchBookmarks(currentUser.uid)
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchBookmarks = async (userId: string) => {
    try {
      setLoading(true)

      const bookmarksQuery = query(collection(db, "bookmarks"), where("userId", "==", userId))

      const bookmarksSnapshot = await getDocs(bookmarksQuery)
      const bookmarksList: BookmarkedItem[] = []

      for (const bookmarkDoc of bookmarksSnapshot.docs) {
        const bookmarkData = bookmarkDoc.data()
        const { resourceId, resourceType } = bookmarkData

        try {
          let itemDoc
          if (resourceType === "resource") {
            itemDoc = await getDoc(doc(db, "resources", resourceId))
          } else {
            itemDoc = await getDoc(doc(db, "projects", resourceId))
          }

          if (itemDoc.exists()) {
            const itemData = itemDoc.data()

            // Fetch subject name for resources
            let subjectName = ""
            if (resourceType === "resource" && itemData.subjectId) {
              const subjectDoc = await getDoc(doc(db, "subjects", itemData.subjectId))
              if (subjectDoc.exists()) {
                subjectName = subjectDoc.data().name
              }
            }

            bookmarksList.push({
              id: resourceId,
              title: itemData.title,
              description: itemData.description,
              type: itemData.type,
              resourceType,
              createdAt: itemData.createdAt,
              creatorName: itemData.creatorName,
              subjectName,
              week: itemData.week,
            })
          }
        } catch (error) {
          console.error(`Error fetching ${resourceType} ${resourceId}:`, error)
        }
      }

      setBookmarks(bookmarksList)
    } catch (error) {
      console.error("Error fetching bookmarks:", error)
    } finally {
      setLoading(false)
    }
  }

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
            YouTube
          </Badge>
        )
      case "website":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            Website
          </Badge>
        )
      case "gdrive":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
            Google Drive
          </Badge>
        )
      case "text":
        return (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200"
          >
            Text
          </Badge>
        )
      default:
        return null
    }
  }

  const resources = bookmarks.filter((item) => item.resourceType === "resource")
  const projects = bookmarks.filter((item) => item.resourceType === "project")

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>Please sign in to view your bookmarks</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/login">
                <Button>Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bookmark className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight text-primary">My Bookmarks</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">Your saved resources and projects in one place</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading bookmarks...</span>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-medium mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground mb-6">Start bookmarking resources and projects to see them here</p>
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button variant="outline">Browse Resources</Button>
              </Link>
              <Link href="/projects">
                <Button>View Projects</Button>
              </Link>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
              <TabsTrigger value="all">All ({bookmarks.length})</TabsTrigger>
              <TabsTrigger value="resources">Resources ({resources.length})</TabsTrigger>
              <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookmarks.map((item) => (
                  <BookmarkCard
                    key={`${item.resourceType}-${item.id}`}
                    item={item}
                    getResourceTypeIcon={getResourceTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="resources" className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.map((item) => (
                  <BookmarkCard
                    key={`${item.resourceType}-${item.id}`}
                    item={item}
                    getResourceTypeIcon={getResourceTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((item) => (
                  <BookmarkCard
                    key={`${item.resourceType}-${item.id}`}
                    item={item}
                    getResourceTypeIcon={getResourceTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}

function BookmarkCard({
  item,
  getResourceTypeIcon,
}: { item: BookmarkedItem; getResourceTypeIcon: (type: string) => React.ReactNode }) {
  const linkHref = item.resourceType === "resource" ? `/resource/${item.id}` : `/projects/${item.id}`

  return (
    <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold line-clamp-2 mb-2">{item.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {item.resourceType === "resource" && item.type && getResourceTypeIcon(item.type)}
              {item.resourceType === "project" && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Project
                </Badge>
              )}
            </div>
          </div>
          <BookmarkButton resourceId={item.id} resourceType={item.resourceType} size="sm" variant="ghost" />
        </div>
        <CardDescription className="text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>by {item.creatorName || "User"}</span>
            {item.subjectName && <span>• {item.subjectName}</span>}
            {item.week && <span>• Week {item.week}</span>}
          </div>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
      </CardContent>

      <CardContent className="pt-0">
        <Link href={linkHref}>
          <Button variant="outline" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            View {item.resourceType === "resource" ? "Resource" : "Project"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
