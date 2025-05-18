"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"
import { auth, db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Github,
  Globe,
  Heart,
  MessageSquare,
  Share2,
  Trash2,
  ArrowLeft,
  Loader2,
  Edit,
  ExternalLink,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAdmin } from "@/hooks/use-admin"
import Link from "next/link"

export default function ProjectPage({ params }) {
  const [project, setProject] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [commentText, setCommentText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isAdmin = useAdmin()

  const router = useRouter()
  const { toast } = useToast()
  const { id } = params

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
    })

    fetchProject()
    fetchComments()

    return () => unsubscribe()
  }, [id])

  const fetchProject = async () => {
    try {
      const projectDoc = await getDoc(doc(db, "projects", id))

      if (projectDoc.exists()) {
        setProject({
          id: projectDoc.id,
          ...projectDoc.data(),
        })
      } else {
        toast({
          title: "Project not found",
          description: "The project you're looking for doesn't exist",
          variant: "destructive",
        })
        router.push("/projects")
      }
    } catch (error) {
      console.error("Error fetching project:", error)
      toast({
        title: "Error",
        description: "Failed to load project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const commentsRef = collection(db, "projects", id, "comments")
      const q = query(commentsRef, orderBy("createdAt", "desc"))
      const querySnapshot = await getDocs(q)

      const commentsList = []
      querySnapshot.forEach((doc) => {
        commentsList.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setComments(commentsList)
    } catch (error) {
      console.error("Error fetching comments:", error)
    }
  }

  const handleLike = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like projects",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    try {
      const projectRef = doc(db, "projects", id)

      const isLiked = project.likedBy && project.likedBy.includes(user.uid)

      if (isLiked) {
        // Unlike
        await updateDoc(projectRef, {
          likes: project.likes - 1,
          likedBy: arrayRemove(user.uid),
        })

        setProject({
          ...project,
          likes: project.likes - 1,
          likedBy: project.likedBy.filter((uid) => uid !== user.uid),
        })
      } else {
        // Like
        await updateDoc(projectRef, {
          likes: project.likes + 1,
          likedBy: arrayUnion(user.uid),
        })

        setProject({
          ...project,
          likes: project.likes + 1,
          likedBy: [...(project.likedBy || []), user.uid],
        })
      }
    } catch (error) {
      console.error("Error liking project:", error)
      toast({
        title: "Error",
        description: "Failed to like project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!user || (project.createdBy !== user.uid && !isAdmin)) return

    try {
      await deleteDoc(doc(db, "projects", id))

      toast({
        title: "Project deleted",
        description: "Your project has been successfully deleted",
      })

      router.push("/projects")
    } catch (error) {
      console.error("Error deleting project:", error)
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async () => {
    try {
      const shareUrl = window.location.href

      if (navigator.share) {
        await navigator.share({
          title: project.title,
          text: `Check out this project: ${project.title}`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        toast({
          title: "Link copied",
          description: "Project link copied to clipboard",
        })
      }
    } catch (error) {
      console.error("Error sharing project:", error)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    if (!commentText.trim()) {
      toast({
        title: "Empty comment",
        description: "Please enter a comment",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      // Get user data
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const userData = userDoc.exists() ? userDoc.data() : { displayName: user.email.split("@")[0] }

      const commentsRef = collection(db, "projects", id, "comments")
      const newComment = {
        content: commentText.trim(),
        createdBy: user.uid,
        creatorName: userData.displayName || user.displayName || user.email.split("@")[0],
        creatorEmail: user.email,
        creatorPhoto: userData.photoURL || user.photoURL || null,
        createdAt: serverTimestamp(),
      }

      const docRef = await addDoc(commentsRef, newComment)

      // Add to local state
      setComments([
        {
          id: docRef.id,
          ...newComment,
          createdAt: new Date(), // Temporary date for UI
        },
        ...comments,
      ])

      setCommentText("")

      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!user) return

    try {
      await deleteDoc(doc(db, "projects", id, "comments", commentId))

      // Update local state
      setComments(comments.filter((c) => c.id !== commentId))

      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted",
      })
    } catch (error) {
      console.error("Error deleting comment:", error)
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const isUserProject = () => {
    return user && project && project.createdBy === user.uid
  }

  const isUserComment = (comment) => {
    return user && comment.createdBy === user.uid
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Project Not Found</CardTitle>
              <CardDescription>The project you're looking for doesn't exist or has been removed.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild>
                <Link href="/projects">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  const formattedDate = project.createdAt
    ? new Date(project.createdAt.toDate()).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recent"

  const isLiked = user && project.likedBy && project.likedBy.includes(user.uid)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />

      <main className="flex-1 container py-8">
        <Button variant="ghost" className="mb-6" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              {project.imageUrl && (
                <div className="w-full overflow-hidden max-h-[400px]">
                  <img
                    src={project.imageUrl || "/placeholder.svg"}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl md:text-3xl">{project.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={project.creatorPhoto || ""} alt={project.creatorName} />
                        <AvatarFallback>{project.creatorName?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <span>{project.creatorName}</span>
                      <span className="text-xs">• {formattedDate}</span>
                    </CardDescription>
                  </div>

                  {isUserProject() && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" asChild>
                        <Link href={`/projects/edit/${id}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-line">{project.description}</p>
                </div>

                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {project.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-6">
                  {project.projectUrl && (
                    <Button asChild>
                      <a href={project.projectUrl} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 mr-2" />
                        View Project
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}

                  {project.githubUrl && (
                    <Button variant="outline" asChild>
                      <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="h-4 w-4 mr-2" />
                        View Code
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between">
                <div className="flex gap-4">
                  <Button variant="ghost" onClick={handleLike} className={isLiked ? "text-primary" : ""}>
                    <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-primary" : ""}`} />
                    {project.likes || 0} Likes
                  </Button>

                  <Button variant="ghost">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {comments.length} Comments
                  </Button>
                </div>

                <Button variant="ghost" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </CardFooter>
            </Card>

            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Comments</h2>

              {user ? (
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="mb-2"
                    rows={3}
                  />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Comment"
                    )}
                  </Button>
                </form>
              ) : (
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <p className="text-center mb-4">Sign in to leave a comment</p>
                    <div className="flex justify-center">
                      <Button asChild>
                        <Link href="/login">Sign In</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <Card key={comment.id}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={comment.creatorPhoto || ""} alt={comment.creatorName} />
                              <AvatarFallback>{comment.creatorName?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{comment.creatorName}</p>
                              <p className="text-xs text-muted-foreground">
                                {comment.createdAt
                                  ? typeof comment.createdAt.toDate === "function"
                                    ? new Date(comment.createdAt.toDate()).toLocaleString()
                                    : new Date(comment.createdAt).toLocaleString()
                                  : "Just now"}
                              </p>
                            </div>
                          </div>

                          {(isUserComment(comment) || isAdmin) && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteComment(comment.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-line">{comment.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>About the Creator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={project.creatorPhoto || ""} alt={project.creatorName} />
                    <AvatarFallback>{project.creatorName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{project.creatorName}</p>
                    <p className="text-xs text-muted-foreground">{project.creatorEmail}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Project Stats</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{project.likes || 0} Likes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{comments.length} Comments</span>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Share Project</p>
                  <Button variant="outline" className="w-full" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share with others
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Similar Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4 text-muted-foreground">
                  <p>Coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
