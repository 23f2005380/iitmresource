"use client"

import { useEffect, useState, useCallback } from "react"
import { doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore"
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Youtube,
  AlertTriangle,
  ThumbsUp,
  MessageSquare,
} from "lucide-react"
import Link from "next/link"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { BookmarkButton } from "@/components/bookmark-button"

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
  subjectName?: string
  week?: number
  isGeneral?: boolean
  isGlobal?: boolean
  flagged?: boolean
  flagReason?: string
}

interface Comment {
  id: string
  resourceId: string
  content: string
  createdBy: string
  createdAt: any
}

// Add this function before the ResourcePage component

const linkifyText = (text: string | undefined) => {
  if (!text) return null

  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g

  // Split the text by URLs
  const parts = text.split(urlRegex)

  // Combine parts and URLs
  const result = []
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].match(urlRegex)) {
      // This part is a URL
      result.push(
        <a
          key={`link-${i}`}
          href={parts[i]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {parts[i]}
        </a>,
      )
    } else if (parts[i]) {
      // This part is regular text
      result.push(<span key={`text-${i}`}>{parts[i]}</span>)
    }
  }

  return result
}

export default function ResourcePage({ params }: { params: { id: string } }) {
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [embedError, setEmbedError] = useState(false)
  const [embedType, setEmbedType] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isAddingComment, setIsAddingComment] = useState(false)
  const { toast } = useToast()
  const [isResourceCreator, setIsResourceCreator] = useState(false)

  // Function to extract YouTube video ID from various URL formats
  const getYoutubeEmbedUrl = useCallback((url: string) => {
    if (!url) return null

    // Handle different YouTube URL formats
    let videoId = null

    // Regular YouTube watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    const watchRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/
    const watchMatch = url.match(watchRegex)

    // YouTube playlist URL: https://www.youtube.com/playlist\?list=PLAYLIST_ID
    const playlistRegex = /youtube\.com\/playlist\?list=([^&?/]+)/
    const playlistMatch = url.match(playlistRegex)

    // YouTube embed URL: https://www.youtube.com/embed/VIDEO_ID
    const embedRegex = /youtube\.com\/embed\/([^&?/]+)/
    const embedMatch = url.match(embedRegex)

    // YouTube shortened URL: https://youtu.be/VIDEO_ID
    const shortRegex = /youtu\.be\/([^&?/]+)/
    const shortMatch = url.match(shortRegex)

    if (watchMatch) {
      videoId = watchMatch[1]
      return {
        url: `https://www.youtube.com/embed/${videoId}?origin=${window.location.origin}`,
        type: "video",
      }
    } else if (playlistMatch) {
      const playlistId = playlistMatch[1]
      return {
        url: `https://www.youtube.com/embed/videoseries?list=${playlistId}&origin=${window.location.origin}`,
        type: "playlist",
      }
    } else if (embedMatch) {
      videoId = embedMatch[1]
      return {
        url: `https://www.youtube.com/embed/${videoId}?origin=${window.location.origin}`,
        type: "video",
      }
    } else if (shortMatch) {
      videoId = shortMatch[1]
      return {
        url: `https://www.youtube.com/embed/${videoId}?origin=${window.location.origin}`,
        type: "video",
      }
    }

    // If we can't parse the URL, return null
    return null
  }, [])

  useEffect(() => {
    const fetchResourceAndComments = async () => {
      try {
        // Fetch resource
        const resourceDoc = doc(db, "resources", params.id)
        const resourceSnapshot = await getDoc(resourceDoc)

        if (resourceSnapshot.exists()) {
          const resourceData = resourceSnapshot.data()

          // Check if current user is the creator of this resource
          if (auth.currentUser && resourceData.createdBy === auth.currentUser.email) {
            setIsResourceCreator(true)
          }

          // Fetch subject name if subjectId exists
          let subjectName = ""
          if (resourceData.subjectId) {
            const subjectDoc = doc(db, "subjects", resourceData.subjectId)
            const subjectSnapshot = await getDoc(subjectDoc)
            if (subjectSnapshot.exists()) {
              subjectName = subjectSnapshot.data().name
            }
          }

          const resource = {
            id: resourceSnapshot.id,
            ...resourceData,
            subjectName,
          } as Resource

          setResource(resource)

          // Process embed URLs based on resource type
          if (resource.type === "youtube" && resource.url) {
            const youtubeEmbed = getYoutubeEmbedUrl(resource.url)
            if (youtubeEmbed) {
              setEmbedUrl(youtubeEmbed.url)
              setEmbedType(youtubeEmbed.type)
            }
          }

          // Fetch comments for this resource
          const commentsQuery = query(collection(db, "comments"), where("resourceId", "==", params.id))
          const commentsSnapshot = await getDocs(commentsQuery)
          const commentsList = commentsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Comment[]

          setComments(commentsList)
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching resource:", error)
        setLoading(false)
      }
    }

    fetchResourceAndComments()
  }, [params.id, getYoutubeEmbedUrl])

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

  const handleEmbedError = () => {
    setEmbedError(true)
  }

  const handleLikeResource = async () => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to like resources",
          variant: "destructive",
        })
        return
      }

      if (!resource) return

      const resourceRef = doc(db, "resources", resource.id)
      const userEmail = auth.currentUser.email
      const likedBy = [...resource.likedBy]
      let newLikes = resource.likes

      if (likedBy.includes(userEmail)) {
        // Unlike
        const index = likedBy.indexOf(userEmail)
        likedBy.splice(index, 1)
        newLikes -= 1
      } else {
        // Like
        likedBy.push(userEmail)
        newLikes += 1
      }

      await updateDoc(resourceRef, {
        likes: newLikes,
        likedBy: likedBy,
      })

      // Update local state
      setResource({
        ...resource,
        likes: newLikes,
        likedBy: likedBy,
      })

      toast({
        title: likedBy.includes(userEmail) ? "Resource liked" : "Resource unliked",
        description: likedBy.includes(userEmail) ? "You liked this resource" : "You unliked this resource",
      })
    } catch (error) {
      console.error("Error liking resource:", error)
      toast({
        title: "Error",
        description: "Could not process your like",
        variant: "destructive",
      })
    }
  }

  const handleAddComment = async () => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add comments",
          variant: "destructive",
        })
        return
      }

      if (!resource) return

      if (!newComment.trim()) {
        toast({
          title: "Comment required",
          description: "Please enter a comment",
          variant: "destructive",
        })
        return
      }

      const commentData = {
        resourceId: resource.id,
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

      setComments([...comments, newCommentObj])
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

  // Function to add links to text
  // const linkifyText = (text: string) => {
  //   const urlRegex = /(https?:\/\/[^\s]+)/g;
  //   return text.replace(urlRegex, (url) => {
  //     return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">' + url + '</a>';
  //   });
  // };

  const renderResourceContent = (resource: Resource) => {
    switch (resource.type) {
      case "youtube":
        return (
          <div className="flex flex-col gap-6">
            {!embedError && embedUrl ? (
              <div className="aspect-video w-full">
                <iframe
                  src={embedUrl}
                  className="w-full h-full rounded-md"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={resource.title}
                  onError={handleEmbedError}
                  referrerPolicy="origin"
                ></iframe>
              </div>
            ) : (
              <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="flex flex-col gap-2">
                  <span>Unable to embed this YouTube content.</span>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open on YouTube
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {/* Direct link to YouTube video */}
            <Alert>
              <ExternalLink className="h-4 w-4 mr-2" />
              <AlertDescription>
                <span className="mr-2">Watch directly on YouTube:</span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {resource.url}
                </a>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">Additional Links</h3>
              {resource.urls && resource.urls.length > 0 ? (
                <ul className="space-y-3">
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
              ) : (
                <p className="text-muted-foreground">No additional links provided</p>
              )}
            </div>
          </div>
        )
      case "website":
        return (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">Links</h3>
              <ul className="space-y-3">
                {resource.url && (
                  <li className="flex items-start gap-2">
                    {getLinkIcon(resource.url)}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      <span className="font-medium">Main Link:</span> {resource.url}
                    </a>
                  </li>
                )}
                {resource.urls && resource.urls.length > 0 && (
                  <>
                    <li className="font-medium mt-4">Additional Links:</li>
                    {resource.urls.map((url, index) => (
                      <li key={index} className="flex items-start gap-2 ml-4">
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
                  </>
                )}
              </ul>
            </div>
          </div>
        )
      case "gdrive":
        return (
          <div className="flex flex-col gap-6">
            {/* Direct link to Google Drive */}
            <Alert>
              <FileText className="h-4 w-4 mr-2 text-green-500" />
              <AlertDescription>
                <span className="mr-2">Access this Google Drive resource:</span>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Open in Google Drive
                </a>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold">Additional Links</h3>
              {resource.urls && resource.urls.length > 0 ? (
                <ul className="space-y-3">
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
              ) : (
                <p className="text-muted-foreground">No additional links provided</p>
              )}
            </div>
          </div>
        )
      case "text":
        return (
          <div className="prose prose-sky max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap">{linkifyText(resource.content)}</div>
            {(resource.url || (resource.urls && resource.urls.length > 0)) && (
              <div className="mt-8">
                <h3>Related Links</h3>
                <ul className="space-y-3 mt-4">
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
                    resource.urls.map((url, index) => (
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
      default:
        return <p>{resource.description}</p>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading resource...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Resource not found</h1>
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

  // Determine the back link based on resource type
  let backLink = "/"
  let backText = "Back to Home"

  if (resource.isGlobal) {
    backLink = "/community-resources"
    backText = "Back to Community Resources"
  } else if (resource.isGeneral) {
    backLink = `/subject/${resource.subjectId}/general`
    backText = "Back to General Resources"
  } else if (resource.week) {
    backLink = `/subject/${resource.subjectId}/week/${resource.week}`
    backText = `Back to Week ${resource.week}`
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Link href={backLink}>
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backText}
            </Button>
          </Link>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/50 dark:to-gray-800/50 p-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                {getResourceTypeIcon(resource.type)}
                <CardTitle className="text-2xl font-bold">{resource.title}</CardTitle>
                <Badge variant="outline" className="ml-2 font-medium">
                  {getResourceTypeLabel(resource.type)}
                </Badge>
              </div>
              <BookmarkButton resourceId={resource.id} resourceType="resource" size="md" />
            </div>
            {isResourceCreator && (
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" size="sm" className="flex items-center gap-1 font-medium">
                  <span className="mr-2">Edit</span>
                  <Link href={`/resource/edit/${resource.id}`}>
                    <span className="text-primary hover:underline">Edit Resource</span>
                  </Link>
                </Button>
              </div>
            )}
            <CardDescription className="text-base">
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                <span className="font-medium">Shared by {resource.creatorName || "User"}</span>
                {resource.subjectName && (
                  <span>
                    Subject:{" "}
                    <Link href={`/subject/${resource.subjectId}`} className="text-primary hover:underline font-medium">
                      {resource.subjectName}
                    </Link>
                  </span>
                )}
                {resource.week && <span className="font-medium">Week {resource.week}</span>}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">{resource.description}</p>
            </div>
            <div className="mt-6">{renderResourceContent(resource)}</div>
          </CardContent>
          <CardFooter className="flex flex-col border-t pt-4">
            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center gap-1 ${
                    auth.currentUser && resource.likedBy.includes(auth.currentUser.email)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                  onClick={handleLikeResource}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>{resource.likes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-muted-foreground"
                  onClick={() => setIsAddingComment(!isAddingComment)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{comments.length}</span>
                </Button>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => setIsAddingComment(!isAddingComment)}>
                  {isAddingComment ? "Cancel" : "Add Comment"}
                </Button>
              </div>
            </div>

            {isAddingComment && (
              <div className="w-full mb-6">
                <Textarea
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[100px] mb-2"
                />
                <div className="flex justify-end">
                  <Button onClick={handleAddComment}>Post Comment</Button>
                </div>
              </div>
            )}

            {comments.length > 0 && (
              <div className="w-full">
                <h3 className="font-medium mb-4">Comments ({comments.length})</h3>
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-muted p-3 rounded-md">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <p className="text-sm font-medium">{comment.createdBy}</p>
                        {comment.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {typeof comment.createdAt.toDate === "function"
                              ? comment.createdAt.toDate().toLocaleDateString()
                              : "Recently"}
                          </p>
                        )}
                      </div>
                      <p className="mt-2 text-sm break-words">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
