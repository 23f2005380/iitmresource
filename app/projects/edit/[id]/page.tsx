"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage"
import { auth, db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, Upload, X } from "lucide-react"
import { useAdmin } from "@/hooks/use-admin"
import Link from "next/link"

export default function EditProjectPage({ params }) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    projectUrl: "",
    githubUrl: "",
  })

  const router = useRouter()
  const { toast } = useToast()
  const { id } = params
  const isAdmin = useAdmin()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        fetchProject(currentUser)
      } else {
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [id])

  const fetchProject = async (currentUser) => {
    try {
      setLoading(true)
      const projectDoc = await getDoc(doc(db, "projects", id))

      if (!projectDoc.exists()) {
        toast({
          title: "Project not found",
          description: "The project you're trying to edit doesn't exist",
          variant: "destructive",
        })
        router.push("/projects")
        return
      }

      const projectData = projectDoc.data()

      // Check if user is authorized to edit this project
      if (projectData.createdBy !== currentUser.uid && !isAdmin) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to edit this project",
          variant: "destructive",
        })
        router.push(`/projects/${id}`)
        return
      }

      setProject({
        id: projectDoc.id,
        ...projectData,
      })

      setFormData({
        title: projectData.title || "",
        description: projectData.description || "",
        tags: projectData.tags ? projectData.tags.join(", ") : "",
        projectUrl: projectData.projectUrl || "",
        githubUrl: projectData.githubUrl || "",
      })

      if (projectData.imageUrl) {
        setImagePreview(projectData.imageUrl)
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image size should be less than 5MB",
        variant: "destructive",
      })
      return
    }

    setImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(project?.imageUrl || null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to update your project",
        variant: "destructive",
      })
      router.push("/login")
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your project",
        variant: "destructive",
      })
      return
    }

    if (!formData.description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for your project",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      let imageUrl = project.imageUrl

      // Upload new image if selected
      if (imageFile) {
        const storage = getStorage()
        const imageRef = ref(storage, `projects/${id}_${Date.now()}`)
        await uploadBytes(imageRef, imageFile)
        imageUrl = await getDownloadURL(imageRef)
      }

      // Process tags
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)

      // Update project in Firestore
      const projectRef = doc(db, "projects", id)
      await updateDoc(projectRef, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        tags,
        projectUrl: formData.projectUrl.trim(),
        githubUrl: formData.githubUrl.trim(),
        imageUrl,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Project updated",
        description: "Your project has been successfully updated",
      })

      router.push(`/projects/${id}`)
    } catch (error) {
      console.error("Error updating project:", error)
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />

      <main className="flex-1 container py-8">
        <Button variant="ghost" className="mb-6" onClick={() => router.push(`/projects/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Edit Project</CardTitle>
            <CardDescription>Update your project details</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
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
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your project"
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="e.g. React, Machine Learning, Data Science"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectUrl">Project URL</Label>
                  <Input
                    id="projectUrl"
                    name="projectUrl"
                    value={formData.projectUrl}
                    onChange={handleInputChange}
                    placeholder="https://your-project.com"
                    type="url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="githubUrl">GitHub URL</Label>
                  <Input
                    id="githubUrl"
                    name="githubUrl"
                    value={formData.githubUrl}
                    onChange={handleInputChange}
                    placeholder="https://github.com/username/repo"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project Image</Label>
                <div className="border rounded-md p-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Project preview"
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 rounded-full"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-md">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No image selected</p>
                    </div>
                  )}

                  <div className="mt-4">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Max file size: 5MB. Recommended dimensions: 1200x630px.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push(`/projects/${id}`)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Project"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
