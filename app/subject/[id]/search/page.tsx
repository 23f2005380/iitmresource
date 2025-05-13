"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  ThumbsUp,
  Youtube,
  Filter,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Subject {
  id: string
  name: string
  level: string
  description: string
  weeks: number
}

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
  subjectId: string
  week?: number
  isGeneral?: boolean
}

export default function SubjectSearchPage({ params }: { params: { id: string } }) {
  const [subject, setSubject] = useState<Subject | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [weekFilter, setWeekFilter] = useState<string>("all")

  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  // Get the initial search query from URL if present
  useEffect(() => {
    const q = searchParams.get("q")
    if (q) {
      setSearchQuery(q)
    }

    const week = searchParams.get("week")
    if (week) {
      setWeekFilter(week)
    }
  }, [searchParams])

  // Fetch subject and all resources
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch subject
        const subjectDoc = doc(db, "subjects", params.id)
        const subjectSnapshot = await getDoc(subjectDoc)

        if (subjectSnapshot.exists()) {
          const subjectData = subjectSnapshot.data()
          setSubject({
            id: subjectSnapshot.id,
            ...subjectData,
          } as Subject)

          try {
            // Fetch all resources for this subject
            const resourcesQuery = query(collection(db, "resources"), where("subjectId", "==", params.id))
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

              // Apply initial search and filters
              applyFilters(resourcesList, searchQuery, weekFilter)
            }
          } catch (resourceError) {
            console.error("Error fetching resources:", resourceError)
            setError("Failed to load resources. This may be due to permission settings.")
            toast({
              title: "Error loading resources",
              description: "Please make sure you're signed in and have permission to view resources.",
              variant: "destructive",
            })
          }
        } else {
          setError("Subject not found")
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setError("Failed to load data. Please try again later.")
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, toast])

  // Apply search and week filters
  const applyFilters = (resourcesList: Resource[], query: string, weekFilter: string) => {
    let filtered = [...resourcesList]

    // Apply search filter
    if (query.trim()) {
      const lowercaseQuery = query.toLowerCase()
      filtered = filtered.filter(
        (resource) =>
          resource.title.toLowerCase().includes(lowercaseQuery) ||
          resource.description.toLowerCase().includes(lowercaseQuery),
      )
    }

    // Apply week filter
    if (weekFilter !== "all") {
      if (weekFilter === "general") {
        filtered = filtered.filter((resource) => resource.isGeneral === true)
      } else {
        const weekNum = Number.parseInt(weekFilter)
        filtered = filtered.filter((resource) => resource.week === weekNum)
      }
    }

    setFilteredResources(filtered)
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
  }

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters(resources, searchQuery, weekFilter)

    // Update URL with search query
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set("q", searchQuery)
    }
    if (weekFilter !== "all") {
      params.set("week", weekFilter)
    }
    router.push(`/subject/${subject?.id}/search?${params.toString()}`)
  }

  // Handle week filter change
  const handleWeekFilterChange = (value: string) => {
    setWeekFilter(value)
    applyFilters(resources, searchQuery, value)

    // Update URL with filters
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set("q", searchQuery)
    }
    if (value !== "all") {
      params.set("week", value)
    }
    router.push(`/subject/${subject?.id}/search?${params.toString()}`)
  }

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

  const getWeekLabel = (resource: Resource) => {
    if (resource.isGeneral) {
      return "General"
    } else if (resource.week) {
      return `Week ${resource.week}`
    }
    return ""
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading resources...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 h-['25%'] overflow-hidden">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">{error || "Subject not found"}</h1>
            <p className="text-muted-foreground mb-6">
              {error === "Failed to load resources. This may be due to permission settings."
                ? "Please make sure you're signed in and have permission to view resources."
                : "The subject you're looking for doesn't exist or has been removed."}
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

  // Generate week options for filter
  const weekOptions = [
    { value: "all", label: "All Weeks" },
    { value: "general", label: "General Resources" },
    ...Array.from({ length: subject.weeks }, (_, i) => ({
      value: (i + 1).toString(),
      label: `Week ${i + 1}`,
    })),
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/30 dark:bg-blue-900/20 blur-3xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/20 dark:bg-blue-800/20 blur-3xl animate-float-medium"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/30 dark:bg-blue-700/20 blur-3xl animate-float-fast"></div>

      <Navbar />
      <main className="flex-1 container py-8 relative z-10">
        <div className="mb-6">
          <Link href={`/subject/${params.id}`}>
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {subject.name}
            </Button>
          </Link>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-sm border p-6 mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">{subject.name} - Search Resources</h1>
          <p className="text-muted-foreground mb-6">Search across all weeks and general resources for {subject.name}</p>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title or description..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-9"
                  />
                </div>
                <Button type="submit">Search</Button>
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={weekFilter} onValueChange={handleWeekFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by week" />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredResources.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-sky-50 dark:bg-sky-900/20">
              <h3 className="text-lg font-medium mb-2">No resources found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || weekFilter !== "all"
                  ? "Try different search terms or filters"
                  : "No resources available for this subject yet"}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setWeekFilter("all")
                  setFilteredResources(resources)
                  router.push(`/subject/${subject.id}/search`)
                }}
              >
                Clear Filters
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
                    <Card className="overflow-hidden transition-all duration-300 bg-white/90 dark:bg-gray-800/90">
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
                              <Badge variant="secondary" className="ml-2">
                                {getWeekLabel(resource)}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1 flex flex-wrap gap-2 items-center">
                              <span>Shared by {resource.creatorName || resource.createdBy}</span>
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" />
                                {resource.likes} likes
                              </span>
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
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
                        <>
                          <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
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
                              <Link
                                href={
                                  resource.isGeneral
                                    ? `/subject/${resource.subjectId}/general`
                                    : `/subject/${resource.subjectId}/week/${resource.week}`
                                }
                                className="text-primary hover:underline"
                              >
                                Go to {getWeekLabel(resource)} Resources
                              </Link>
                              <Link href={`/resource/${resource.id}`} className="text-primary hover:underline">
                                View Full Details
                              </Link>
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between border-t pt-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <ThumbsUp className="h-4 w-4" />
                                {resource.likes}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MessageSquare className="h-4 w-4" />
                                Comments
                              </div>
                            </div>
                          </CardFooter>
                        </>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      <footer className="border-t py-6 bg-sky-50 dark:bg-gray-900 relative z-10">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Built by students, for students. IITM BS Resource Hub.</p>
        </div>
      </footer>
    </div>
  )
}
