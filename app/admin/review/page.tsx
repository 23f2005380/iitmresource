"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, doc, updateDoc, query, orderBy, Timestamp, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  ThumbsUp,
  Youtube,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Resource {
  id: string
  title: string
  description: string
  type: string
  url?: string
  content?: string
  createdBy: string
  creatorName?: string
  createdAt: any
  likes: number
  likedBy: string[]
  subjectId?: string
  subjectName?: string
  week?: number
  isGeneral?: boolean
  isGlobal?: boolean
  reviewed?: boolean
  flagged?: boolean
  flagReason?: string
  reviewedBy?: string
  reviewedAt?: any
}

export default function AdminReviewPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [flagReason, setFlagReason] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkAdmin = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (!user) {
          router.push("/login")
          toast({
            title: "Authentication required",
            description: "Please sign in to access the admin review page",
            variant: "destructive",
          })
          return
        }

        // Check if user is admin
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
          router.push("/")
          toast({
            title: "Access denied",
            description: "You don't have permission to access the admin review page",
            variant: "destructive",
          })
          return
        }

        fetchResources()
      })

      return () => unsubscribe()
    }

    checkAdmin()
  }, [router, toast])

  const fetchResources = async () => {
    try {
      setLoading(true)
      const resourcesQuery = query(collection(db, "resources"), orderBy("createdAt", "desc"))
      const resourcesSnapshot = await getDocs(resourcesQuery)

      if (resourcesSnapshot.empty) {
        setResources([])
        setFilteredResources([])
      } else {
        const resourcesList = resourcesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Resource[]

        // Fetch subject names for resources
        for (const resource of resourcesList) {
          if (resource.subjectId) {
            try {
              const subjectDoc = await getDoc(doc(db, "subjects", resource.subjectId))
              if (subjectDoc.exists()) {
                resource.subjectName = subjectDoc.data().name
              }
            } catch (error) {
              console.error(`Error fetching subject for resource ${resource.id}:`, error)
            }
          }
        }

        setResources(resourcesList)
        setFilteredResources(resourcesList)
      }
      setLoading(false)
    } catch (error) {
      console.error("Error fetching resources:", error)
      setLoading(false)
      toast({
        title: "Error fetching resources",
        description: "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleSearch = () => {
    let filtered = [...resources]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (resource) =>
          resource.title.toLowerCase().includes(query) ||
          resource.description.toLowerCase().includes(query) ||
          (resource.createdBy && resource.createdBy.toLowerCase().includes(query)) ||
          (resource.subjectName && resource.subjectName.toLowerCase().includes(query)),
      )
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((resource) => resource.type === typeFilter)
    }

    // Apply status filter
    if (statusFilter === "reviewed") {
      filtered = filtered.filter((resource) => resource.reviewed === true)
    } else if (statusFilter === "unreviewed") {
      filtered = filtered.filter((resource) => !resource.reviewed)
    } else if (statusFilter === "flagged") {
      filtered = filtered.filter((resource) => resource.flagged === true)
    }

    setFilteredResources(filtered)
  }

  const handleApproveResource = async (resourceId: string) => {
    try {
      const resourceRef = doc(db, "resources", resourceId)
      await updateDoc(resourceRef, {
        reviewed: true,
        flagged: false,
        flagReason: "",
        reviewedBy: auth.currentUser?.email,
        reviewedAt: Timestamp.now(),
      })

      // Update local state
      const updatedResources = resources.map((resource) =>
        resource.id === resourceId
          ? {
              ...resource,
              reviewed: true,
              flagged: false,
              flagReason: "",
              reviewedBy: auth.currentUser?.email,
              reviewedAt: Timestamp.now(),
            }
          : resource,
      )
      setResources(updatedResources)
      setFilteredResources(
        filteredResources.map((resource) =>
          resource.id === resourceId
            ? {
                ...resource,
                reviewed: true,
                flagged: false,
                flagReason: "",
                reviewedBy: auth.currentUser?.email,
                reviewedAt: Timestamp.now(),
              }
            : resource,
        ),
      )

      toast({
        title: "Resource approved",
        description: "The resource has been approved successfully",
      })
    } catch (error) {
      console.error("Error approving resource:", error)
      toast({
        title: "Error approving resource",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const handleFlagResource = async (resourceId: string) => {
    if (!flagReason.trim()) {
      toast({
        title: "Flag reason required",
        description: "Please provide a reason for flagging this resource",
        variant: "destructive",
      })
      return
    }

    try {
      const resourceRef = doc(db, "resources", resourceId)
      await updateDoc(resourceRef, {
        reviewed: true,
        flagged: true,
        flagReason: flagReason,
        reviewedBy: auth.currentUser?.email,
        reviewedAt: Timestamp.now(),
      })

      // Update local state
      const updatedResources = resources.map((resource) =>
        resource.id === resourceId
          ? {
              ...resource,
              reviewed: true,
              flagged: true,
              flagReason: flagReason,
              reviewedBy: auth.currentUser?.email,
              reviewedAt: Timestamp.now(),
            }
          : resource,
      )
      setResources(updatedResources)
      setFilteredResources(
        filteredResources.map((resource) =>
          resource.id === resourceId
            ? {
                ...resource,
                reviewed: true,
                flagged: true,
                flagReason: flagReason,
                reviewedBy: auth.currentUser?.email,
                reviewedAt: Timestamp.now(),
              }
            : resource,
        ),
      )

      setFlagReason("")
      setSelectedResource(null)

      toast({
        title: "Resource flagged",
        description: "The resource has been flagged successfully",
      })
    } catch (error) {
      console.error("Error flagging resource:", error)
      toast({
        title: "Error flagging resource",
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

  const getResourceLocationLabel = (resource: Resource) => {
    if (resource.isGlobal) {
      return "Community Resources"
    } else if (resource.isGeneral) {
      return `${resource.subjectName || "Subject"} - General`
    } else if (resource.week) {
      return `${resource.subjectName || "Subject"} - Week ${resource.week}`
    }
    return "Unknown"
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
 
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Resource Review</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">Review and moderate resources submitted by students</p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="all">All Resources</TabsTrigger>
              <TabsTrigger value="unreviewed">Unreviewed</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyUp={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
                <SelectTrigger className="w-[180px]">
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
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="unreviewed">Unreviewed</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </div>

          <TabsContent value="all">{renderResourceList(filteredResources)}</TabsContent>

          <TabsContent value="unreviewed">
            {renderResourceList(filteredResources.filter((r) => !r.reviewed))}
          </TabsContent>

          <TabsContent value="flagged">{renderResourceList(filteredResources.filter((r) => r.flagged))}</TabsContent>
        </Tabs>

        {/* Flag Resource Dialog */}
        <Dialog open={!!selectedResource} onOpenChange={(open) => !open && setSelectedResource(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Flag Resource</DialogTitle>
              <DialogDescription>
                Provide a reason for flagging this resource. This will be visible to the creator.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Enter reason for flagging..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="min-h-[100px]"
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={() => selectedResource && handleFlagResource(selectedResource.id)}>
                Flag Resource
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <footer className="border-t py-6 bg-sky-50 dark:bg-gray-900">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Built by students, for students. IITM BS Resource Hub.</p>
        </div>
      </footer>
    </div>
  )

  function renderResourceList(resources: Resource[]) {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading resources...</span>
        </div>
      )
    }

    if (resources.length === 0) {
      return (
        <div className="text-center py-12 border rounded-lg bg-sky-50/50 dark:bg-sky-900/20">
          <h3 className="text-lg font-medium mb-2">No resources found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || typeFilter !== "all" || statusFilter !== "all"
              ? "Try different search terms or filters"
              : "No resources available for review"}
          </p>
          {(searchQuery || typeFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("")
                setTypeFilter("all")
                setStatusFilter("all")
                setFilteredResources(resources)
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {resources.map((resource) => (
          <Card key={resource.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/50 dark:to-gray-800/50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {getResourceTypeIcon(resource.type)}
                    <CardTitle className="flex-1 break-words">{resource.title}</CardTitle>
                    <Badge variant="outline" className="ml-2">
                      {getResourceTypeLabel(resource.type)}
                    </Badge>
                    {resource.reviewed && !resource.flagged && (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      >
                        Approved
                      </Badge>
                    )}
                    {resource.flagged && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                        Flagged
                      </Badge>
                    )}
                    {!resource.reviewed && (
                      <Badge
                        variant="outline"
                        className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                      >
                        Unreviewed
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1 flex flex-wrap gap-2 items-center">
                    <span>Shared by {resource.creatorName || resource.createdBy}</span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {resource.likes} likes
                    </span>
                    <span>Location: {getResourceLocationLabel(resource)}</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>

              {resource.flagged && resource.flagReason && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 dark:text-red-200">Flag Reason:</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">{resource.flagReason}</p>
                      {resource.reviewedBy && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Flagged by {resource.reviewedBy}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Resource
                  </a>
                )}
                <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                  View Full Details
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-4">
              {!resource.reviewed && (
                <>
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                    onClick={() => handleApproveResource(resource.id)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setSelectedResource(resource)}
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    Flag
                  </Button>
                </>
              )}
              {resource.flagged && (
                <Button
                  variant="outline"
                  className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={() => handleApproveResource(resource.id)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Remove Flag
                </Button>
              )}
              {resource.reviewed && !resource.flagged && (
                <Button
                  variant="outline"
                  className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setSelectedResource(resource)}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Flag
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }
}
