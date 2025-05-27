"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore"
import { auth, db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Github, Globe, Heart, MessageSquare, Share2, Trash2, Plus, Loader2, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookmarkButton } from "@/components/bookmark-button"

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState("all")
  const [commentingOn, setCommentingOn] = useState(null)
  const [commentText, setCommentText] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentInputRef = useRef(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    projectUrl: "",
    githubUrl: "",
    tags: "",
  })

  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
    })

    fetchProjects()

    return () => unsubscribe()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const projectsRef = collection(db, "projects")
      const q = query(projectsRef, orderBy("createdAt", "desc"))
      const querySnapshot = await getDocs(q)

      const projectsList = []
      querySnapshot.forEach((doc) => {
        projectsList.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setProjects(projectsList)
    } catch (error) {
      console.error("Error fetching projects:", error)
      toast({
        title: "Error",
        description: "Failed to load projects. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to submit a project",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    try {
      setSubmitting(true)

      // Validate form
      if (!formData.title || !formData.description) {
        toast({
          title: "Missing information",
          description: "Please provide a title and description for your project",
          variant: "destructive",
        })
        return
      }

      // Process tags
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag)
        : []

      // Add project to Firestore
      await addDoc(collection(db, "projects"), {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl || null,
        projectUrl: formData.projectUrl || null,
        githubUrl: formData.githubUrl || null,
        tags: tagsArray,
        createdBy: user.uid,
        creatorName: user.displayName || user.email,
        creatorEmail: user.email,
        creatorPhoto: user.photoURL || null,
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
      })

      // Reset form and close dialog
      setFormData({
        title: "",
        description: "",
        imageUrl: "",
        projectUrl: "",
        githubUrl: "",
        tags: "",
      })
      setFormOpen(false)

      toast({
        title: "Project submitted",
        description: "Your project has been successfully submitted",
      })

      // Refresh projects list
      fetchProjects()
    } catch (error) {
      console.error("Error submitting project:", error)
      toast({
        title: "Error",
        description: "Failed to submit project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleLike = async (projectId) => {
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
      const projectRef = doc(db, "projects", projectId)
      const project = projects.find((p) => p.id === projectId)

      if (!project) return

      const isLiked = project.likedBy && project.likedBy.includes(user.uid)
      const newLikedBy = isLiked
        ? project.likedBy.filter((uid) => uid !== user.uid)
        : [...(project.likedBy || []), user.uid]

      const newLikes = isLiked ? project.likes - 1 : project.likes + 1

      // Update project in Firestore
      await updateDoc(projectRef, {
        likes: newLikes,
        likedBy: newLikedBy,
      })

      // Update local state
      setProjects(projects.map((p) => (p.id === projectId ? { ...p, likes: newLikes, likedBy: newLikedBy } : p)))
    } catch (error) {
      console.error("Error liking project:", error)
      toast({
        title: "Error",
        description: "Failed to like project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (projectId) => {
    if (!user) return

    try {
      const projectRef = doc(db, "projects", projectId)
      await deleteDoc(projectRef)

      // Update local state
      setProjects(projects.filter((p) => p.id !== projectId))

      toast({
        title: "Project deleted",
        description: "Your project has been successfully deleted",
      })
    } catch (error) {
      console.error("Error deleting project:", error)
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleShare = async (project) => {
    try {
      const shareUrl = `${window.location.origin}/projects/${project.id}`

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

  const handleCommentClick = (projectId) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    if (commentingOn === projectId) {
      setCommentingOn(null)
      setCommentText("")
    } else {
      setCommentingOn(projectId)
      setCommentText("")
      // Focus the comment input after a short delay to allow the UI to update
      setTimeout(() => {
        if (commentInputRef.current) {
          commentInputRef.current.focus()
        }
      }, 100)
    }
  }

  const handleCommentSubmit = async (projectId) => {
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
      setSubmittingComment(true)

      const commentsRef = collection(db, "projects", projectId, "comments")
      await addDoc(commentsRef, {
        content: commentText.trim(),
        createdBy: user.uid,
        creatorName: user.displayName || user.email,
        creatorEmail: user.email,
        creatorPhoto: user.photoURL || null,
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      })

      setCommentText("")
      setCommentingOn(null)

      // Redirect to the project detail page to see all comments
      router.push(`/projects/${projectId}`)
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "Failed to post comment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const isUserProject = (project) => {
    return user && project.createdBy === user.uid
  }

  const handleTabChange = (value) => {
    setActiveTab(value)
  }

  // Determine which tabs to show based on authentication
  const renderTabs = () => {
    if (user) {
      return (
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="my">My Projects</TabsTrigger>
        </TabsList>
      )
    } else {
      return (
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Projects</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
        </TabsList>
      )
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />

      <main className="flex-1 container py-8">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Student Projects</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Showcase your projects, get feedback, and discover what others are building
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange} className="w-full">
            {renderTabs()}
            <div className="flex justify-center md:justify-end w-full md:w-auto mt-8 md:mt-0">
              {user ? (
                <Dialog open={formOpen} onOpenChange={setFormOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                      <DialogTitle>Add New Project</DialogTitle>
                      <DialogDescription>
                        Share your project with the IITM community. Fill in the details below.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label htmlFor="title" className="text-sm font-medium">
                          Project Title *
                        </label>
                        <Input
                          id="title"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          placeholder="Enter project title"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="description" className="text-sm font-medium">
                          Description *
                        </label>
                        <Textarea
                          id="description"
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Describe your project"
                          rows={4}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="imageUrl" className="text-sm font-medium">
                          Image URL
                        </label>
                        <Input
                          id="imageUrl"
                          name="imageUrl"
                          value={formData.imageUrl}
                          onChange={handleInputChange}
                          placeholder="https://example.com/image.jpg"
                        />
                        <p className="text-xs text-muted-foreground">Provide a URL to an image of your project</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="projectUrl" className="text-sm font-medium">
                            Project URL
                          </label>
                          <Input
                            id="projectUrl"
                            name="projectUrl"
                            value={formData.projectUrl}
                            onChange={handleInputChange}
                            placeholder="https://yourproject.com"
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="githubUrl" className="text-sm font-medium">
                            GitHub URL
                          </label>
                          <Input
                            id="githubUrl"
                            name="githubUrl"
                            value={formData.githubUrl}
                            onChange={handleInputChange}
                            placeholder="https://github.com/username/repo"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="tags" className="text-sm font-medium">
                          Tags
                        </label>
                        <Input
                          id="tags"
                          name="tags"
                          value={formData.tags}
                          onChange={handleInputChange}
                          placeholder="web, machine learning, python (comma separated)"
                        />
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Project"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button onClick={() => router.push("/login")}>Login to Add Project</Button>
              )}
            </div>
            <TabsContent value="all" className="mt-6">
              {loading ? (
                <div className="flex py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-xl font-medium mb-2">No projects yet</h3>
                  <p className="text-muted-foreground mb-4">Be the first to share your project!</p>
                  {user ? (
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Project
                    </Button>
                  ) : (
                    <Button onClick={() => router.push("/login")}>Login to Add Project</Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      user={user}
                      onLike={() => handleLike(project.id)}
                      onDelete={() => handleDelete(project.id)}
                      onShare={() => handleShare(project)}
                      onCommentClick={() => handleCommentClick(project.id)}
                      isUserProject={isUserProject(project)}
                      isCommenting={commentingOn === project.id}
                      commentText={commentText}
                      setCommentText={setCommentText}
                      onCommentSubmit={() => handleCommentSubmit(project.id)}
                      submittingComment={submittingComment}
                      commentInputRef={commentingOn === project.id ? commentInputRef : null}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="popular" className="mt-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects
                    .sort((a, b) => b.likes - a.likes)
                    .map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        user={user}
                        onLike={() => handleLike(project.id)}
                        onDelete={() => handleDelete(project.id)}
                        onShare={() => handleShare(project)}
                        onCommentClick={() => handleCommentClick(project.id)}
                        isUserProject={isUserProject(project)}
                        isCommenting={commentingOn === project.id}
                        commentText={commentText}
                        setCommentText={setCommentText}
                        onCommentSubmit={() => handleCommentSubmit(project.id)}
                        submittingComment={submittingComment}
                        commentInputRef={commentingOn === project.id ? commentInputRef : null}
                      />
                    ))}
                </div>
              )}
            </TabsContent>

            {user && (
              <TabsContent value="my" className="mt-6">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects
                      .filter((project) => project.createdBy === user.uid)
                      .map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          user={user}
                          onLike={() => handleLike(project.id)}
                          onDelete={() => handleDelete(project.id)}
                          onShare={() => handleShare(project)}
                          onCommentClick={() => handleCommentClick(project.id)}
                          isUserProject={true}
                          isCommenting={commentingOn === project.id}
                          commentText={commentText}
                          setCommentText={setCommentText}
                          onCommentSubmit={() => handleCommentSubmit(project.id)}
                          submittingComment={submittingComment}
                          commentInputRef={commentingOn === project.id ? commentInputRef : null}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function ProjectCard({
  project,
  user,
  onLike,
  onDelete,
  onShare,
  onCommentClick,
  isUserProject,
  isCommenting,
  commentText,
  setCommentText,
  onCommentSubmit,
  submittingComment,
  commentInputRef,
}) {
  const isLiked = user && project.likedBy && project.likedBy.includes(user.uid)
  const formattedDate = project.createdAt ? new Date(project.createdAt.toDate()).toLocaleDateString() : "Recent"
  const router = useRouter()

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
      {project.imageUrl && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={project.imageUrl || "/placeholder.svg"}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Link href={`/projects/${project.id}`} className="hover:underline flex-1">
            <CardTitle className="text-xl font-bold line-clamp-1">{project.title}</CardTitle>
          </Link>
          <div className="flex items-center gap-2">
            <BookmarkButton resourceId={project.id} resourceType="project" size="sm" />
            {isUserProject && (
              <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={project.creatorPhoto || ""} alt={project.creatorName} />
            <AvatarFallback>{project.creatorName?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{project.creatorName}</span>
          <span className="text-xs whitespace-nowrap">• {formattedDate}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-4 flex-grow px-6">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3 leading-relaxed">{project.description}</p>

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs font-medium">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-auto">
          {project.projectUrl && (
            <Button variant="outline" size="sm" asChild className="text-xs h-8 font-medium">
              <a href={project.projectUrl} target="_blank" rel="noopener noreferrer">
                <Globe className="h-3 w-3 mr-1" />
                View
              </a>
            </Button>
          )}

          {project.githubUrl && (
            <Button variant="outline" size="sm" asChild className="text-xs h-8 font-medium">
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                <Github className="h-3 w-3 mr-1" />
                Code
              </a>
            </Button>
          )}

          <Button variant="outline" size="sm" asChild className="text-xs h-8 ml-auto font-medium">
            <Link href={`/projects/${project.id}`}>Details</Link>
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between pt-2 border-t mt-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onLike} className={`px-2 h-8 ${isLiked ? "text-primary" : ""}`}>
            <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-primary" : ""}`} />
            {project.likes || 0}
          </Button>

          <Button variant="ghost" size="sm" onClick={onCommentClick} className="px-2 h-8">
            <MessageSquare className="h-4 w-4 mr-1" />
            Comment
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onShare} className="px-2 h-8">
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
      </CardFooter>

      {isCommenting && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex gap-2 items-center">
            <Textarea
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="text-sm min-h-[60px] resize-none"
            />
            <Button
              size="icon"
              onClick={onCommentSubmit}
              disabled={!commentText.trim() || submittingComment}
              className="h-8 w-8 shrink-0"
            >
              {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
