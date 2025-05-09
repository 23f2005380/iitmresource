"use client"

import { DialogTrigger } from "@/components/ui/dialog"

import { useEffect, useState } from "react"
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  ThumbsUp,
  Trash,
  Youtube,
  Search,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ResourceForm } from "@/components/resource-form"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Subject {
  id: string
  name: string
  level: string
  description: string
  weeks: number
  slug?: string
}

interface Resource {
  id: string
  title: string
  description: string
  type: string
  url?: string
  urls?: string[]
  content?: string
  createdBy: string
  creatorName?: string
  createdAt: any
  likes: number
  likedBy: string[]
  subjectId: string
  subjectSlug?: string
  week: number
}

interface Comment {
  id: string
  resourceId: string
  content: string
  createdBy: string
  createdAt: any
}

export default function WeekPage({ params }: { params: { id: string; weekNum: string } }) {
  const [subject, setSubject] = useState<Subject | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({})
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [activeResourceId, setActiveResourceId] = useState<string | null>(null)
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching subject with ID:", params.id)
        // Fetch subject
        const subjectDoc = doc(db, "subjects", params.id)
        const subjectSnapshot = await getDoc(subjectDoc)

        if (subjectSnapshot.exists()) {
          const subjectData = subjectSnapshot.data()
          console.log("Subject data:", subjectData)
          setSubject({
            id: subjectSnapshot.id,
            ...subjectData,
          } as Subject)

          // Fetch resources for this week
          console.log(`Fetching resources for subject ${params.id}, week ${params.weekNum}`)
          const resourcesQuery = query(
            collection(db, "resources"),
            where("subjectId", "==", params.id),
            where("week", "==", Number.parseInt(params.weekNum)),
          )
          const resourcesSnapshot = await getDocs(resourcesQuery)

          if (resourcesSnapshot.empty) {
            console.log("No resources found for this week")
            setResources([])
            setFilteredResources([])
          } else {
            const resourcesList = resourcesSnapshot.docs.map((doc) => {
              const data = doc.data()
              console.log(`Resource ${doc.id}:`, data)
              return {
                id: doc.id,
                ...data,
              }
            }) as Resource[]

            console.log(`Fetched ${resourcesList.length} resources:`, resourcesList)
            setResources(resourcesList)
            setFilteredResources(resourcesList)

            // Fetch comments for each resource
            const commentsObj: { [key: string]: Comment[] } = {}

            for (const resource of resourcesList) {
              const commentsQuery = query(collection(db, "comments"), where("resourceId", "==", resource.id))
              const commentsSnapshot = await getDocs(commentsQuery)
              const commentsList = commentsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Comment[]

              commentsObj[resource.id] = commentsList
            }

            setComments(commentsObj)
          }
        } else {
          console.log("Subject not found")
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, params.weekNum])

  // Filter resources based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredResources(resources)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = resources.filter(
        (resource) =>
          resource.title.toLowerCase().includes(query) || resource.description.toLowerCase().includes(query),
      )
      setFilteredResources(filtered)
    }
  }, [searchQuery, resources])

  const toggleResourceExpansion = (resourceId: string) => {
    setExpandedResources((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(resourceId)) {
        newSet.delete(resourceId)
      } else {
        newSet.add(resourceId)
      }
      return newSet
    })
  }

  const handleAddResource = async (formData: any) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add resources",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      if (!formData.title) {
        toast({
          title: "Title required",
          description: "Please provide a title for your resource",
          variant: "destructive",
        })
        return
      }

      if ((formData.type === "youtube" || formData.type === "website" || formData.type === "gdrive") && !formData.url) {
        toast({
          title: "URL required",
          description: "Please provide a URL for your resource",
          variant: "destructive",
        })
        return
      }

      if (formData.type === "text" && !formData.content) {
        toast({
          title: "Content required",
          description: "Please provide content for your text resource",
          variant: "destructive",
        })
        return
      }

      // Get subject slug if available
      const subjectSlug = subject?.slug || ""

      const resourceData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        url: formData.url || null,
        urls: formData.urls || [], // Make sure this is included
        content: formData.content || null,
        createdBy: auth.currentUser.email,
        creatorName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        subjectId: params.id,
        subjectSlug: subjectSlug,
        week: Number.parseInt(params.weekNum),
      }

      console.log("Adding resource with data:", resourceData)
      const docRef = await addDoc(collection(db, "resources"), resourceData)

      const newResource = {
        id: docRef.id,
        ...resourceData,
        createdAt: new Date(), // For immediate display
      }

      const updatedResources = [newResource, ...resources]
      setResources(updatedResources)

      // Update filtered resources if search is active
      if (searchQuery.trim() === "") {
        setFilteredResources(updatedResources)
      } else {
        const query = searchQuery.toLowerCase()
        if (newResource.title.toLowerCase().includes(query) || newResource.description.toLowerCase().includes(query)) {
          setFilteredResources([newResource, ...filteredResources])
        }
      }

      toast({
        title: "Resource added",
        description: "Your resource has been added successfully",
      })
    } catch (error) {
      console.error("Error adding resource:", error)
      toast({
        title: "Error adding resource",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const handleLikeResource = async (resourceId: string) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to like resources",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      const resourceRef = doc(db, "resources", resourceId)
      const resourceDoc = await getDoc(resourceRef)

      if (resourceDoc.exists()) {
        const resourceData = resourceDoc.data()
        const likedBy = resourceData.likedBy || []
        const userEmail = auth.currentUser.email

        if (likedBy.includes(userEmail)) {
          // Unlike
          await updateDoc(resourceRef, {
            likes: resourceData.likes - 1,
            likedBy: likedBy.filter((email: string) => email !== userEmail),
          })

          const updatedResources = resources.map((r) =>
            r.id === resourceId
              ? {
                  ...r,
                  likes: r.likes - 1,
                  likedBy: r.likedBy.filter((email) => email !== userEmail),
                }
              : r,
          )
          setResources(updatedResources)

          // Update filtered resources
          setFilteredResources(
            filteredResources.map((r) =>
              r.id === resourceId
                ? {
                    ...r,
                    likes: r.likes - 1,
                    likedBy: r.likedBy.filter((email) => email !== userEmail),
                  }
                : r,
            ),
          )
        } else {
          // Like
          await updateDoc(resourceRef, {
            likes: resourceData.likes + 1,
            likedBy: [...likedBy, userEmail],
          })

          const updatedResources = resources.map((r) =>
            r.id === resourceId
              ? {
                  ...r,
                  likes: r.likes + 1,
                  likedBy: [...r.likedBy, userEmail],
                }
              : r,
          )
          setResources(updatedResources)

          // Update filtered resources
          setFilteredResources(
            filteredResources.map((r) =>
              r.id === resourceId
                ? {
                    ...r,
                    likes: r.likes + 1,
                    likedBy: [...r.likedBy, userEmail],
                  }
                : r,
            ),
          )
        }
      }
    } catch (error) {
      console.error("Error liking resource:", error)
      toast({
        title: "Error",
        description: "Could not process your like",
        variant: "destructive",
      })
    }
  }

  const handleAddComment = async (resourceId: string) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add comments",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      if (!newComment.trim()) {
        toast({
          title: "Comment required",
          description: "Please enter a comment",
          variant: "destructive",
        })
        return
      }

      const commentData = {
        resourceId,
        content: newComment,
        createdBy: auth.currentUser.email,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, "comments"), commentData)

      const newCommentObj = {
        id: docRef.id,
        ...commentData,
        createdAt: new Date(), // For immediate display
      }

      setComments({
        ...comments,
        [resourceId]: [...(comments[resourceId] || []), newCommentObj],
      })

      setNewComment("")
      setIsAddingComment(false)

      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error adding comment",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const handleDeleteResource = async (resourceId: string) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to delete resources",
          variant: "destructive",
        })
        return
      }

      const resource = resources.find((r) => r.id === resourceId)

      if (resource?.createdBy !== auth.currentUser.email && auth.currentUser.email !== "admin@iitm.ac.in") {
        toast({
          title: "Permission denied",
          description: "You can only delete your own resources",
          variant: "destructive",
        })
        return
      }

      // Delete all comments for this resource
      const commentsForResource = comments[resourceId] || []
      for (const comment of commentsForResource) {
        await deleteDoc(doc(db, "comments", comment.id))
      }

      // Delete the resource
      await deleteDoc(doc(db, "resources", resourceId))

      // Update state
      const updatedResources = resources.filter((r) => r.id !== resourceId)
      setResources(updatedResources)
      setFilteredResources(filteredResources.filter((r) => r.id !== resourceId))

      const newComments = { ...comments }
      delete newComments[resourceId]
      setComments(newComments)

      toast({
        title: "Resource deleted",
        description: "The resource has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting resource:", error)
      toast({
        title: "Error deleting resource",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube":
        return <Youtube className="h-5 w-5 text-red-500" />
      case "website":
        return <ExternalLink className="h-5 w-5 text-primary" />
      case "gdrive":
        return <FileText className="h-5 w-5 text-green-500" />
      case "text":
        return <FileText className="h-5 w-5 text-primary" />
      default:
        return null
    }
  }

  const getLinkIcon = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return <Youtube className="h-4 w-4 text-red-500 flex-shrink-0" />
    } else if (url.includes("drive.google.com")) {
      return <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
    } else {
      return <ExternalLink className="h-4 w-4 text-primary flex-shrink-0" />
    }
  }

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case "youtube":
        return "YouTube Video"
      case "website":
        return "Website Link"
      case "gdrive":
        return "Google Drive"
      case "text":
        return "Text Content"
      default:
        return "Resource"
    }
  }

  const renderResourceContent = (resource: Resource) => {
    switch (resource.type) {
      case "youtube":
        // Extract video ID from YouTube URL
        const getYouTubeVideoId = (url) => {
          if (!url) return null

          // Handle youtu.be format
          if (url.includes("youtu.be")) {
            const parts = url.split("/")
            return parts[parts.length - 1].split("?")[0]
          }

          // Handle youtube.com format
          const urlParams = new URLSearchParams(new URL(url).search)
          return urlParams.get("v")
        }

        const videoId = getYouTubeVideoId(resource.url)
        const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : ""

        return (
          <div className="flex flex-col gap-4">
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                className="w-full h-full rounded-md"
                allowFullScreen
                title={resource.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              ></iframe>
            </div>

            {/* Direct link to YouTube video */}
            <Alert variant="outline" className="bg-muted/50">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              <AlertDescription>
                <span className="mr-2">If the video doesn't load, open it directly:</span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  View on YouTube
                </a>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <p className="text-sm text-muted-foreground">{resource.description}</p>
              <Link href={`/resource/${resource.id}`} className="text-primary hover:underline whitespace-nowrap">
                View Full Resource
              </Link>
            </div>
            {resource.urls && resource.urls.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-1">Additional Links:</h4>
                <ul className="space-y-2">
                  {resource.urls.map((url, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {getLinkIcon(url)}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      case "website":
        return (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{resource.description}</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {getLinkIcon(resource.url || "")}
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  Visit Website
                </a>
              </div>
              <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                View All Links
              </Link>
            </div>
            {resource.urls && resource.urls.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-1">Additional Links:</h4>
                <ul className="space-y-2">
                  {resource.urls.slice(0, 2).map((url, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {getLinkIcon(url)}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                  {resource.urls.length > 2 && (
                    <li>
                      <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                        +{resource.urls.length - 2} more links
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )
      case "gdrive":
        return (
          <div className="flex flex-col gap-4">
            {/* <div className="aspect-video w-full">
              <iframe
                src={resource.url}
                className="w-full h-full rounded-md"
                allowFullScreen
                title={resource.title}
              ></iframe>
            </div>

           
            <Alert variant="outline" className="bg-muted/50">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
              <AlertDescription>
                <span className="mr-2">If the document doesn't load, open it directly:</span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  View on Google Drive
                </a>
              </AlertDescription>
            </Alert>*/}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <p className="text-sm text-muted-foreground">{resource.description}</p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {getLinkIcon(resource.url || "")}
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline whitespace-nowrap"
                  >
                    Open in Google Drive
                  </a>
                </div>
                <Link href={`/resource/${resource.id}`} className="text-primary hover:underline whitespace-nowrap">
                  View Full Resource
                </Link>
              </div>
            </div>
            {resource.urls && resource.urls.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-1">Additional Links:</h4>
                <ul className="space-y-2">
                  {resource.urls.slice(0, 2).map((url, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {getLinkIcon(url)}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                  {resource.urls.length > 2 && (
                    <li>
                      <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                        +{resource.urls.length - 2} more links
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )
      case "text":
        const isLongText = resource.content && resource.content.length > 500
        return (
          <div className="prose prose-sky max-w-none dark:prose-invert">
            <p className="whitespace-pre-wrap">
              {isLongText ? resource.content?.substring(0, 500) + "..." : resource.content}
            </p>
            {isLongText && (
              <div className="mt-4">
                <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                  Read Full Content
                </Link>
              </div>
            )}
            {(resource.url || (resource.urls && resource.urls.length > 0)) && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-1">Related Links:</h4>
                <ul className="space-y-2">
                  {resource.url && (
                    <li className="flex items-start gap-2">
                      {getLinkIcon(resource.url)}
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {resource.url}
                      </a>
                    </li>
                  )}
                  {resource.urls &&
                    resource.urls.slice(0, 2).map((url, index) => (
                      <li key={index} className="flex items-start gap-2">
                        {getLinkIcon(url)}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  {resource.urls && resource.urls.length > 2 && (
                    <li>
                      <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                        +{resource.urls.length - 2} more links
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )
      default:
        return <p>{resource.description}</p>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading resources...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Subject not found</h1>
            <p className="text-muted-foreground mb-6">
              The resource you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Link href={`/subject/${params.id}`}>
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {subject.name}
            </Button>
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            {subject.name} - Week {params.weekNum}
          </h1>
          <p className="text-muted-foreground mb-6">
            Browse and share resources for Week {params.weekNum} of {subject.name}
          </p>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold">Resources</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs flex">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-r-none"
                />
                <Button
                  variant="secondary"
                  className="rounded-l-none"
                  onClick={() => {
                    // This triggers the search explicitly
                    const query = searchQuery.toLowerCase()
                    const filtered = resources.filter(
                      (resource) =>
                        resource.title.toLowerCase().includes(query) ||
                        resource.description.toLowerCase().includes(query),
                    )
                    setFilteredResources(filtered)
                  }}
                >
                  Search
                </Button>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="transition-all duration-300 whitespace-nowrap">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Resource
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  {auth.currentUser ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Add a new resource</DialogTitle>
                        <DialogDescription>
                          Share a helpful resource with your peers for Week {params.weekNum} of {subject.name}
                        </DialogDescription>
                      </DialogHeader>
                      <ResourceForm onSubmit={handleAddResource} />
                    </>
                  ) : (
                    <div className="py-6 text-center space-y-4">
                      <h3 className="text-lg font-medium">Authentication Required</h3>
                      <p className="text-muted-foreground mb-4">Please sign in to share resources</p>
                      <Link href="/login">
                        <Button>Sign In</Button>
                      </Link>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {resources.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-sky-50 dark:bg-sky-900/20">
              <h3 className="text-lg font-medium mb-2">No resources yet</h3>
              <p className="text-muted-foreground mb-4">Be the first to share a helpful resource for this week!</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Resource
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <DialogHeader>
                    <DialogTitle>Add a new resource</DialogTitle>
                    <DialogDescription>
                      Share a helpful resource with your peers for Week {params.weekNum} of {subject.name}
                    </DialogDescription>
                  </DialogHeader>
                  <ResourceForm onSubmit={handleAddResource} />
                </DialogContent>
              </Dialog>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-sky-50 dark:bg-sky-900/20">
              <h3 className="text-lg font-medium mb-2">No resources match your search</h3>
              <p className="text-muted-foreground mb-4">Try a different search term or clear the search</p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="grid gap-6">
              <AnimatePresence initial={false}>
                {filteredResources.map((resource) => (
                  <motion.div
                    key={resource.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="overflow-hidden transition-all duration-300 card-hover-effect">
                      <CardHeader
                        className="bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/50 dark:to-gray-800/50 cursor-pointer"
                        onClick={() => toggleResourceExpansion(resource.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getResourceTypeIcon(resource.type)}
                              <CardTitle className="flex-1 break-words">{resource.title}</CardTitle>
                              <Badge variant="outline" className="ml-2">
                                {getResourceTypeLabel(resource.type)}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1 flex flex-wrap gap-2 items-center">
                              <span>Shared by {resource.creatorName || resource.createdBy}</span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {resource.likes} likes
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {(comments[resource.id] || []).length} comments
                              </span>
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {(auth.currentUser?.email === resource.createdBy ||
                              auth.currentUser?.email === "admin@iitm.ac.in") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteResource(resource.id)
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                            {expandedResources.has(resource.id) ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        {!expandedResources.has(resource.id) && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{resource.description}</p>
                        )}
                      </CardHeader>

                      {expandedResources.has(resource.id) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <CardContent className="pt-6">{renderResourceContent(resource)}</CardContent>
                          <CardFooter className="flex flex-col sm:flex-row justify-between border-t pt-4 gap-2">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`flex items-center gap-1 ${
                                  auth.currentUser && resource.likedBy.includes(auth.currentUser.email)
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }`}
                                onClick={() => handleLikeResource(resource.id)}
                              >
                                <ThumbsUp className="h-4 w-4" />
                                {resource.likes}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1 text-muted-foreground"
                                onClick={() => {
                                  setActiveResourceId(activeResourceId === resource.id ? null : resource.id)
                                  setIsAddingComment(false)
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                                {(comments[resource.id] || []).length}
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary w-full sm:w-auto"
                              onClick={() => {
                                setActiveResourceId(resource.id)
                                setIsAddingComment(true)
                              }}
                            >
                              Add Comment
                            </Button>
                          </CardFooter>
                        </motion.div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      <footer className="border-t py-6 bg-sky-50 dark:bg-gray-900">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Built by students, for students. IITM BS Resource Hub.</p>
        </div>
      </footer>
    </div>
  )
}
