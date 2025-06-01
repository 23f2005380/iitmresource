"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from "firebase/firestore"
import { BookOpen, Filter, Plus, Sparkles, Loader2, ChevronRight, ExternalLink, Eye } from "lucide-react"
import Link from "next/link"

import { db, auth } from "./firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FloatingNotificationButton } from "@/components/floating-notification-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ResourceForm } from "@/components/resource-form"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Leaderboard } from "@/components/leaderboard"
import { RecentContributions } from "@/components/recent-contributions"
import { BookmarkButton } from "@/components/bookmark-button"

interface Subject {
  id: string
  name: string
  level: string
  description: string
  weeks: number
  slug?: string
  imageUrl?: string
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
  isGlobal?: boolean
}

export default function Home() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [globalResources, setGlobalResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingResources, setLoadingResources] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        console.log("Fetching subjects...")
        const subjectsCollection = collection(db, "subjects")
        const subjectsQuery = query(subjectsCollection, orderBy("name"))
        const subjectsSnapshot = await getDocs(subjectsQuery)

        if (subjectsSnapshot.empty) {
          console.log("No subjects found in the database")
          setSubjects([])
        } else {
          const subjectsList = subjectsSnapshot.docs.map((doc) => {
            const data = doc.data()
            console.log(`Subject ${doc.id}:`, data)
            return {
              id: doc.id,
              name: data.name || "Unnamed Subject",
              level: data.level || "foundation",
              description: data.description || "",
              weeks: data.weeks || 12,
              slug: data.slug || "",
            }
          })

          console.log(`Fetched ${subjectsList.length} subjects:`, subjectsList)
          setSubjects(subjectsList)
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching subjects:", error)
        setError("Failed to load subjects. Please try again later.")
        setLoading(false)
      }
    }

    const fetchGlobalResources = async () => {
      try {
        setLoadingResources(true)
        const resourcesQuery = query(
          collection(db, "resources"),
          where("isGlobal", "==", true),
          orderBy("createdAt", "desc"),
        )
        const resourcesSnapshot = await getDocs(resourcesQuery)

        if (resourcesSnapshot.empty) {
          setGlobalResources([])
        } else {
          const resourcesList = resourcesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Resource[]

          setGlobalResources(resourcesList)
        }
        setLoadingResources(false)
      } catch (error) {
        console.error("Error fetching global resources:", error)
        setLoadingResources(false)
      }
    }

    fetchSubjects()
    fetchGlobalResources()
  }, [])

  const handleAddGlobalResource = async (formData: any) => {
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

      setGlobalResources([newResource, ...globalResources])

      // Close the dialog
      setIsDialogOpen(false)

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

  const renderSubjectCard = (subject: Subject) => (
    <Link href={`/subject/${subject.id}`} key={subject.id}>
      <Card className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full flex flex-col group">
        <CardHeader className="bg-gradient-to-br from-primary/90 to-primary text-white py-6 px-6">
          <CardTitle className="text-xl text-white group-hover:text-primary-foreground transition-colors" style={{"fontWeight"  : 400}}>
            {subject.name}
          </CardTitle>
          <CardDescription className="text-primary-foreground/90 font-medium">
            {subject.level.charAt(0).toUpperCase() + subject.level.slice(1)} Level
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex-grow">
          <p className="text-muted-foreground leading-relaxed line-clamp-2">
            {subject.description || "Explore comprehensive resources for this subject"}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between mt-auto border-t pt-4 px-6">
          <div className="flex items-center text-sm text-muted-foreground font-medium">
            <BookOpen className="h-4 w-4 mr-2" />
            {subject.weeks} {subject.weeks === 1 ? "Week" : "Weeks"}
          </div>
          <Button variant="ghost" size="sm" className="text-primary font-semibold group-hover:bg-primary/10">
            View Resources
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  )

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube":
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 font-medium"
          >
            YouTube
          </Badge>
        )
      case "website":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 font-medium"
          >
            Website
          </Badge>
        )
      case "gdrive":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 font-medium"
          >
            Google Drive
          </Badge>
        )
      case "text":
        return (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 font-medium"
          >
            Text
          </Badge>
        )
      default:
        return null
    }
  }

  const ResourceActionButton = ({ resource }: { resource: Resource }) => {
    if (resource.type === "text") {
      return (
        <Link href={`/resource/${resource.id}`} className="w-full">
          <Button variant="outline" className="w-full font-medium">
            <Eye className="h-4 w-4 mr-2" />
            View Content
          </Button>
        </Link>
      )
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full font-medium">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Resource
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-base">Quick Actions</h4>
            <div className="space-y-2">
              <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="default" className="w-full justify-start font-medium">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visit Resource
                </Button>
              </a>
              <Link href={`/resource/${resource.id}`} className="block">
                <Button variant="outline" className="w-full justify-start font-medium">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </Link>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
      {/* Enhanced background elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-3xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/5 blur-3xl animate-float-medium"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-gradient-to-br from-accent/15 to-accent/5 blur-3xl animate-float-fast"></div>

      <Navbar />
      <FloatingNotificationButton />

      <main className="flex-1 container py-8 relative z-10">
        <div className="flex flex-col items-center justify-center text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-6">
            DataNest
          </h1>
          
          <p className="text-base md:text-lg text-muted-foreground max-w-4xl leading-relaxed">
            A community-driven platform for IITM BS in Data Science and Applications students to share and discover
            alternative learning resources. Built by students, for students.
          </p>
          {error && (
            <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              {error}
            </div>
          )}
        </div>

        {/* Main content grid with improved spacing */}
        <div className="space-y-12 mb-16">
          {/* Desktop: Leaderboard and Recent Contributions side by side */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-8">
            <Leaderboard className="fade-in-up" />
            <RecentContributions className="fade-in-up" />
          </div>

          {/* Mobile: Community Resources and Recent Contributions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-6">
            <div className="sm:col-span-1 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-amber-500" />
                  <h3 className="text-xl font-bold">Community Resources</h3>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Share general resources here. Subject-specific resources should be added to respective subject sections.
              </p>

              {loadingResources ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : globalResources.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">No resources yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {globalResources.slice(0, 5).map((resource) => (
                    <div key={resource.id} className="p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        {getResourceTypeIcon(resource.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-base">{resource.title}</p>
                          <p className="text-sm text-muted-foreground">by {resource.creatorName || "User"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookmarkButton resourceId={resource.id} resourceType="resource" />
                          <Link href={`/resource/${resource.id}`}>
                            <Button variant="ghost" size="sm" className="font-medium">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <Link href="/community-resources">
                  <Button variant="outline" size="sm" className="w-full font-medium">
                    View All
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="sm:col-span-1">
              <RecentContributions className="fade-in-up h-full" limit={5} />
            </div>
          </div>

          {/* Desktop Community Resources Section */}
          <div className="hidden lg:block space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <Sparkles className="h-6 w-6 text-amber-500" />
                <h2 className="text-2xl font-bold">Community Resources</h2>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="font-semibold">
                    <Plus className="mr-2 h-5 w-5" />
                    Share a Resource
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  {auth.currentUser ? (
                    <>
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Share a resource with everyone</DialogTitle>
                        <DialogDescription className="text-base">
                          Share helpful resources that aren't specific to any subject
                        </DialogDescription>
                      </DialogHeader>
                      <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
                    </>
                  ) : (
                    <div className="py-8 text-center space-y-4">
                      <h3 className="text-xl font-bold">Authentication Required</h3>
                      <p className="text-base text-muted-foreground">Please sign in to share resources</p>
                      <Link href="/login">
                        <Button className="font-semibold">Sign In</Button>
                      </Link>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <p className="text-base text-muted-foreground leading-relaxed">
              Share general resources here that benefit the entire community. Subject-specific resources should be added
              to their respective sections below.
            </p>

            {loadingResources ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-base text-muted-foreground">Loading resources...</span>
              </div>
            ) : globalResources.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <h3 className="text-xl font-bold mb-3">No community resources yet</h3>
                <p className="text-base text-muted-foreground mb-6">
                  Be the first to share a helpful resource with the community!
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="font-semibold">
                      <Plus className="mr-2 h-5 w-5" />
                      Share a Resource
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    {auth.currentUser ? (
                      <>
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold">Share a resource with everyone</DialogTitle>
                          <DialogDescription className="text-base">
                            Share helpful resources that aren't specific to any subject
                          </DialogDescription>
                        </DialogHeader>
                        <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
                      </>
                    ) : (
                      <div className="py-8 text-center space-y-4">
                        <h3 className="text-xl font-bold">Authentication Required</h3>
                        <p className="text-base text-muted-foreground">Please sign in to share resources</p>
                        <Link href="/login">
                          <Button className="font-semibold">Sign In</Button>
                        </Link>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {globalResources.slice(0, 3).map((resource) => (
                    <Card
                      key={resource.id}
                      className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] h-full flex flex-col"
                    >
                      <CardHeader className="p-6">
                        <div className="flex justify-between items-start gap-3">
                          <CardTitle className="text-lg font-bold line-clamp-2">{resource.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            {getResourceTypeIcon(resource.type)}
                            <BookmarkButton resourceId={resource.id} resourceType="resource" />
                          </div>
                        </div>
                        <CardDescription className="text-base font-medium">
                          Shared by {resource.creatorName || "User"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 flex-grow">
                        <p className="text-muted-foreground leading-relaxed line-clamp-3">
                          {resource.description || "No description provided"}
                        </p>
                      </CardContent>
                      <CardFooter className="border-t pt-4 mt-auto p-6">
                        <ResourceActionButton resource={resource} />
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center mt-8">
                  <Link href="/community-resources">
                    <Button variant="outline" className="font-semibold">
                      View All Community Resources
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Mobile: Share Resource Button */}
          <div className="lg:hidden">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full font-semibold">
                  <Plus className="mr-2 h-5 w-5" />
                  Share a Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                {auth.currentUser ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold">Share a resource with everyone</DialogTitle>
                      <DialogDescription className="text-base">
                        Share helpful resources that aren't specific to any subject
                      </DialogDescription>
                    </DialogHeader>
                    <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
                  </>
                ) : (
                  <div className="py-8 text-center space-y-4">
                    <h3 className="text-xl font-bold">Authentication Required</h3>
                    <p className="text-base text-muted-foreground">Please sign in to share resources</p>
                    <Link href="/login">
                      <Button className="font-semibold">Sign In</Button>
                    </Link>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Subjects Section with improved spacing */}
        <Tabs defaultValue="all" className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Filter className="h-6 w-6 text-muted-foreground" />
              <h2 className="text-2xl font-bold">Subjects</h2>
            </div>
            <TabsList className="grid grid-cols-4 w-full max-w-[400px]">
              <TabsTrigger value="all" className="font-medium">
                All
              </TabsTrigger>
              <TabsTrigger value="foundation" className="font-medium">
                Foundation
              </TabsTrigger>
              <TabsTrigger value="diploma" className="font-medium">
                Diploma
              </TabsTrigger>
              <TabsTrigger value="degree" className="font-medium">
                Degree
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="animate-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="h-[280px]">
                      <CardHeader className="h-24 bg-primary/20 animate-pulse"></CardHeader>
                      <CardContent className="p-6">
                        <div className="h-4 bg-muted animate-pulse rounded mb-3"></div>
                        <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))
              ) : subjects.length > 0 ? (
                subjects.map(renderSubjectCard)
              ) : (
                <div className="col-span-full text-center py-12">
                  <h3 className="text-xl font-bold mb-3">No subjects found</h3>
                  <p className="text-base text-muted-foreground">
                    Check back later for updates or visit{" "}
                    <a href="/api/seed" className="text-primary underline hover:no-underline font-medium">
                      this link
                    </a>{" "}
                    to seed the database
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {["foundation", "diploma", "degree"].map((level) => (
            <TabsContent key={level} value={level} className="animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Card key={i} className="h-[280px]">
                        <CardHeader className="h-24 bg-primary/20 animate-pulse"></CardHeader>
                        <CardContent className="p-6">
                          <div className="h-4 bg-muted animate-pulse rounded mb-3"></div>
                          <div className="h-4 bg-muted animate-pulse rounded w-2/3"></div>
                        </CardContent>
                      </Card>
                    ))
                ) : subjects.filter((s) => s.level === level).length > 0 ? (
                  subjects.filter((s) => s.level === level).map(renderSubjectCard)
                ) : (
                  <div className="col-span-full text-center py-12">
                    <h3 className="text-xl font-bold mb-3">No {level} level subjects found</h3>
                    <p className="text-base text-muted-foreground">Check back later for updates</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <footer className="border-t bg-muted/30 relative z-10">
        <div className="container flex flex-col items-center justify-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Built with ❤️ by FDSF and v0, for students.
            <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent font-bold ml-2">
              DataNest
            </span>{" "}
            - Your Data Science Resource Hub.
          </p>
        </div>
      </footer>
    </div>
  )
}
