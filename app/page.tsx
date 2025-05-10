"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from "firebase/firestore"
import { BookOpen, Filter, Plus, Sparkles, Loader2, ChevronRight } from "lucide-react"
import Link from "next/link"

import { db, auth } from "./firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Leaderboard } from "@/components/leaderboard"
import { RecentContributions } from "@/components/recent-contributions"
import { NotificationSystem } from "@/components/notification-system"

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
      <Card className="hover-scale overflow-hidden h-full flex flex-col transition-colors">
        <CardHeader className="bg-gradient-to-r from-sky-400 to-sky-300 text-white dark:from-sky-700 dark:to-sky-600 py-4">
          <CardTitle className="font-display text-lg">{subject.name}</CardTitle>
          <CardDescription className="text-sky-50 dark:text-sky-100">
            {subject.level.charAt(0).toUpperCase() + subject.level.slice(1)} Level
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex-grow">
          <p className="text-sm text-muted-foreground line-clamp-2 font-body">
            {subject.description || "Explore resources for this subject"}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between mt-auto border-t pt-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 mr-1" />
            {subject.weeks} {subject.weeks === 1 ? "Week" : "Weeks"}
          </div>
          <Button variant="ghost" size="sm" className="text-primary">
            View Resources
          </Button>
        </CardFooter>
      </Card>
    </Link>
  )

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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/20 dark:bg-blue-900/10 blur-xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/15 dark:bg-blue-800/10 blur-xl animate-float-medium"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/20 dark:bg-blue-700/10 blur-xl animate-float-fast"></div>
      <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-pink-400/10 dark:bg-indigo-600/10 blur-xl animate-float-reverse"></div>

      <main className="flex-1 container py-6 relative z-10">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary mb-3 font-display">
            IITM BS in Data Science Resources
          </h1>
          <p className="text-base text-muted-foreground max-w-3xl font-body">
            A community-driven platform for IITM BS in Data Science and Applications students to share and discover
            alternative learning resources.
          </p>
          {error && <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md dark:bg-red-900/30">{error}</div>}
        </div>

        {/* Main content grid - Desktop: Leaderboard and Recent Contributions side by side, Community Resources below */}
        <div className="grid grid-cols-1 gap-6 mb-12">
          {/* Top row - Leaderboard and Recent Contributions side by side (desktop only) */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            <Leaderboard className="fade-in-up" />
            <RecentContributions className="fade-in-up" />
          </div>

          {/* Mobile view - Community Resources and Recent Contributions side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4">
            <div className="sm:col-span-1">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3">
                <div className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h2 className="text-lg font-semibold font-display">Community Resources</h2>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Please post general resources here. Subject-specific resources should be added to the respective subject
                sections below.
              </p>

              {loadingResources ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : globalResources.length === 0 ? (
                <div className="text-center py-4 border rounded-lg bg-sky-50/50 dark:bg-sky-900/20">
                  <p className="text-sm text-muted-foreground">No resources yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {globalResources.slice(0, 5).map((resource) => (
                    <Link
                      href={`/resource/${resource.id}`}
                      key={resource.id}
                      className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        {getResourceTypeIcon(resource.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{resource.title}</p>
                          <p className="text-sm text-muted-foreground">by {resource.creatorName || "User"}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <Link href="/community-resources">
                  <Button variant="outline" size="sm" className="w-full gap-1">
                    View All
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="sm:col-span-1 mt-4 sm:mt-0">
              <RecentContributions className="fade-in-up h-full" limit={5} />
            </div>
          </div>

          {/* Community Resources Section (desktop only) */}
          <div className="hidden lg:block">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div className="flex items-center gap-2 mb-3 md:mb-0">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-semibold font-display">Community Resources</h2>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="transition-all duration-300">
                    <Plus className="mr-2 h-4 w-4" />
                    Share a Resource
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  {auth.currentUser ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Share a resource with everyone</DialogTitle>
                        <DialogDescription>
                          Share helpful resources that aren't specific to any subject
                        </DialogDescription>
                      </DialogHeader>
                      <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
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

            <p className="text-sm text-muted-foreground mb-4">
              Kindly post those resources here which are extra or general. Topic-specific resources from a subject week
              should be added in the Subject resources section below.
            </p>

            {loadingResources ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading resources...</span>
              </div>
            ) : globalResources.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-sky-50/50 dark:bg-sky-900/20">
                <h3 className="text-base font-medium mb-2">No community resources yet</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to share a helpful resource with the community!
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Share a Resource
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px]">
                    {auth.currentUser ? (
                      <>
                        <DialogHeader>
                          <DialogTitle>Share a resource with everyone</DialogTitle>
                          <DialogDescription>
                            Share helpful resources that aren't specific to any subject
                          </DialogDescription>
                        </DialogHeader>
                        <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
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
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {globalResources.slice(0, 3).map((resource) => (
                    <Card
                      key={resource.id}
                      className="hover-scale overflow-hidden h-full flex flex-col transition-colors card-hover-effect"
                    >
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="font-display">{resource.title}</CardTitle>
                          {getResourceTypeIcon(resource.type)}
                        </div>
                        <CardDescription>Shared by {resource.creatorName || "User"}</CardDescription>
                      </CardHeader>
                      <CardFooter className="border-t pt-3 mt-auto">
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

                <div className="flex justify-center mt-4">
                  <Link href="/community-resources">
                    <Button variant="outline" className="gap-2">
                      View All Community Resources
                      <ChevronRight className="h-4 w-4" />
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
                <Button className="w-full transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" />
                  Share a Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                {auth.currentUser ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Share a resource with everyone</DialogTitle>
                      <DialogDescription>Share helpful resources that aren't specific to any subject</DialogDescription>
                    </DialogHeader>
                    <ResourceForm onSubmit={handleAddGlobalResource} onSuccess={() => setIsDialogOpen(false)} />
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

        {/* Subjects Section */}
        <Tabs defaultValue="all" className="w-full max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold font-display">Subjects</h2>
            </div>
            <TabsList className="grid grid-cols-4 w-full max-w-[400px]">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="foundation">Foundation</TabsTrigger>
              <TabsTrigger value="diploma">Diploma</TabsTrigger>
              <TabsTrigger value="degree">Degree</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="animate-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i} className="hover-scale h-[220px]">
                      <CardHeader className="h-24 bg-sky-100 dark:bg-sky-900 animate-pulse"></CardHeader>
                      <CardContent className="pt-4">
                        <div className="h-3 bg-sky-100 dark:bg-sky-900 animate-pulse rounded mb-2"></div>
                        <div className="h-3 bg-sky-100 dark:bg-sky-900 animate-pulse rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))
              ) : subjects.length > 0 ? (
                subjects.map(renderSubjectCard)
              ) : (
                <div className="col-span-3 text-center py-8">
                  <h3 className="text-base font-medium">No subjects found</h3>
                  <p className="text-muted-foreground">
                    Check back later for updates or visit{" "}
                    <a href="/api/seed" className="text-primary underline">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                  Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <Card key={i} className="hover-scale h-[220px]">
                        <CardHeader className="h-24 bg-sky-100 dark:bg-sky-900 animate-pulse"></CardHeader>
                        <CardContent className="pt-4">
                          <div className="h-3 bg-sky-100 dark:bg-sky-900 animate-pulse rounded mb-2"></div>
                          <div className="h-3 bg-sky-100 dark:bg-sky-900 animate-pulse rounded w-2/3"></div>
                        </CardContent>
                      </Card>
                    ))
                ) : subjects.filter((s) => s.level === level).length > 0 ? (
                  subjects.filter((s) => s.level === level).map(renderSubjectCard)
                ) : (
                  <div className="col-span-3 text-center py-8">
                    <h3 className="text-base font-medium">No {level} level subjects found</h3>
                    <p className="text-muted-foreground">Check back later for updates</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
      <footer className="border-t py-4 bg-sky-50 dark:bg-gray-900 relative z-10">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground font-body">
            Built by FDSF and v0, for students. IITM BS Resource Hub.
          </p>
        </div>
      </footer>

      {/* Notification System */}
      <NotificationSystem />
    </div>
  )
}
