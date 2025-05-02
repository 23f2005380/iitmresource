"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore"
import { ArrowLeft, Loader2, Plus, Sparkles, Trash, SortAsc, Search } from "lucide-react"
import Link from "next/link"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ResourceForm } from "@/components/resource-form"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
  isGlobal?: boolean
}

export default function CommunityResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortOption, setSortOption] = useState("newest")
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true)
        const resourcesQuery = query(
          collection(db, "resources"),
          where("isGlobal", "==", true),
          orderBy("createdAt", "desc"),
        )
        const resourcesSnapshot = await getDocs(resourcesQuery)

        if (resourcesSnapshot.empty) {
          setResources([])
          setFilteredResources([])
        } else {
          const resourcesList = resourcesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Resource[]

          setResources(resourcesList)
          setFilteredResources(resourcesList)
        }
        setLoading(false)
      } catch (error) {
        console.error("Error fetching resources:", error)
        setLoading(false)
      }
    }

    fetchResources()
  }, [])

  // Apply filters and sorting
  useEffect(() => {
    if (resources.length === 0) return

    let filtered = [...resources]

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (resource) =>
          resource.title.toLowerCase().includes(query) || resource.description.toLowerCase().includes(query),
      )
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((resource) => resource.type === typeFilter)
    }

    // Apply sorting
    switch (sortOption) {
      case "newest":
        filtered.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
          return dateB.getTime() - dateA.getTime()
        })
        break
      case "oldest":
        filtered.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt)
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt)
          return dateA.getTime() - dateB.getTime()
        })
        break
      case "most-liked":
        filtered.sort((a, b) => b.likes - a.likes)
        break
      case "least-liked":
        filtered.sort((a, b) => a.likes - b.likes)
        break
      default:
        break
    }

    setFilteredResources(filtered)
  }, [searchQuery, typeFilter, sortOption, resources])

  const handleAddResource = async (formData: any) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to add resources",
          variant: "destructive",
        })
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

      const resourceData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        url: formData.url || null,
        urls: formData.urls || [],
        content: formData.content || null,
        createdBy: auth.currentUser.email,
        creatorName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        createdAt: serverTimestamp(),
        likes: 0,
        likedBy: [],
        isGlobal: true,
      }

      const docRef = await addDoc(collection(db, "resources"), resourceData)

      const newResource = {
        id: docRef.id,
        ...resourceData,
        createdAt: new Date(), // For immediate display
      }

      setResources([newResource, ...resources])
      setFilteredResources([newResource, ...filteredResources])

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

  const handleDeleteResource = async (resourceId: string) => {
    try {
      await deleteDoc(doc(db, "resources", resourceId))

      // Update state
      const updatedResources = resources.filter((r) => r.id !== resourceId)
      setResources(updatedResources)
      setFilteredResources(filteredResources.filter((r) => r.id !== resourceId))

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
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            YouTube
          </Badge>
        )
      case "website":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            Website
          </Badge>
        )
      case "gdrive":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Google Drive
          </Badge>
        )
      case "text":
        return (
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
            Text
          </Badge>
        )
      default:
        return null
    }
  }

  // Check if user can delete a resource
  const canDeleteResource = (resource: Resource) => {
    if (!currentUser) return false

    // Check if user is the creator or has admin email
    const isCreator = currentUser.email === resource.createdBy
    const isAdminEmail = currentUser.email === "admin@iitm.ac.in"

    return isCreator || isAdminEmail
  }

  function showText(data, name) {
  console.log(data.split(" "), " ", data.length, " " , data.split(" ").slice(0,5))
  let words = 0
  let character = 0
    if (name == "description") {
      words = 20
      character = 100
      }
      else if (name == "title") {
      words = 10
      character = 50
      }
    if(data.split(" ").length > words && data.length > character) {
      return data.split(" ").slice(0,20).join(" ") + "..."
    }
    else {
    return data
    }
  }
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/20 dark:bg-blue-900/10 blur-xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/15 dark:bg-blue-800/10 blur-xl animate-float-medium"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/20 dark:bg-blue-700/10 blur-xl animate-float-fast"></div>
      <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-pink-400/10 dark:bg-indigo-600/10 blur-xl animate-float-reverse"></div>

      <Navbar />
      <main className="flex-1 container py-8 relative z-10">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary mb-4 font-display flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-amber-500" />
            Community Resources
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl font-body">
            Explore and share helpful resources that aren't specific to any subject
          </p>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold font-display">All Resources</h2>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" />
                  Share a Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                {currentUser ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Share a resource with everyone</DialogTitle>
                      <DialogDescription>Share helpful resources that aren't specific to any subject</DialogDescription>
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

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative flex w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="gdrive">Google Drive</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOption} onValueChange={(value) => setSortOption(value)}>
                <SelectTrigger className="w-[150px]">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="most-liked">Most Liked</SelectItem>
                  <SelectItem value="least-liked">Least Liked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading resources...</span>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-sky-50/50 dark:bg-sky-900/20">
              <h3 className="text-lg font-medium mb-2">No resources found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all"
                  ? "Try different search terms or filters"
                  : "Be the first to share a helpful resource with the community!"}
              </p>
              {searchQuery || typeFilter !== "all" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("")
                    setTypeFilter("all")
                    setSortOption("newest")
                    setFilteredResources(resources)
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Share a Resource
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                      <DialogTitle>Share a resource with everyone</DialogTitle>
                      <DialogDescription>Share helpful resources that aren't specific to any subject</DialogDescription>
                    </DialogHeader>
                    <ResourceForm onSubmit={handleAddResource} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredResources.map((resource) => (
                <Card key={resource.id} className="hover-scale overflow-hidden h-full flex flex-col transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="font-display">{showText(resource.title, "title")}</CardTitle>
                      {getResourceTypeIcon(resource.type)}
                    </div>
                    <CardDescription className="flex justify-between items-center">
                      <span>Shared by {resource.creatorName || resource.createdBy}</span>
                      {canDeleteResource(resource) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this resource? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteResource(resource.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground font-body">
                    {showText(resource.description, "description")}
                    </p>
                  </CardContent>
                  <CardFooter className="border-t pt-4">
                    {resource.type === "text" ? (
                      <Link href={`/resource/${resource.id}`} className="w-full">
                        <Button variant="outline" className="w-full">
                          View Content
                        </Button>
                      </Link>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                          <Button variant="outline" className="w-full">
                            Visit Resource
                          </Button>
                        </a>
                        <Link href={`/resource/${resource.id}`}>
                          <Button variant="ghost">Details</Button>
                        </Link>
                      </div>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <footer className="border-t py-6 bg-sky-50 dark:bg-gray-900 relative z-10">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground font-body">
            Built by FDSF and v0, for students. IITM BS Resource Hub.
          </p>
        </div>
      </footer>
    </div>
  )
}
