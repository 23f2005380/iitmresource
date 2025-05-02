"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { ArrowLeft, Calendar, Loader2, FileText, Search, X } from "lucide-react"
import Link from "next/link"

import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { RecentContributors } from "@/components/recent-contributors"

interface Subject {
  id: string
  name: string
  level: string
  description: string
  weeks: number
  hasGeneralResource?: boolean
  imageUrl?: string
}

interface ResourceCount {
  [key: string]: number // week number or 'general' as key, count as value
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

export default function SubjectPage({ params }: { params: { id: string } }) {
  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [resourceCounts, setResourceCounts] = useState<ResourceCount>({})
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [searchResults, setSearchResults] = useState<Resource[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)

  useEffect(() => {
    const fetchSubject = async () => {
      try {
        const subjectDoc = doc(db, "subjects", params.id)
        const subjectSnapshot = await getDoc(subjectDoc)

        if (subjectSnapshot.exists()) {
          setSubject({
            id: subjectSnapshot.id,
            ...subjectSnapshot.data(),
          } as Subject)
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching subject:", error)
        setLoading(false)
      }
    }

    fetchSubject()
  }, [params.id])

  // Fetch resource counts for each week
  useEffect(() => {
    const fetchResourceCounts = async () => {
      if (!subject) return

      try {
        setLoadingCounts(true)
        const counts: ResourceCount = {}

        // Fetch general resources count if applicable
        if (subject.hasGeneralResource) {
          const generalQuery = query(
            collection(db, "resources"),
            where("subjectId", "==", params.id),
            where("isGeneral", "==", true),
          )
          const generalSnapshot = await getDocs(generalQuery)
          counts["general"] = generalSnapshot.size
        }

        // Fetch counts for each week
        for (let week = 1; week <= subject.weeks; week++) {
          const weekQuery = query(
            collection(db, "resources"),
            where("subjectId", "==", params.id),
            where("week", "==", week),
          )
          const weekSnapshot = await getDocs(weekQuery)
          counts[week.toString()] = weekSnapshot.size
        }

        setResourceCounts(counts)
        setLoadingCounts(false)
      } catch (error) {
        console.error("Error fetching resource counts:", error)
        setLoadingCounts(false)
      }
    }

    if (subject) {
      fetchResourceCounts()
    }
  }, [subject, params.id])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!searchQuery.trim()) return

    setIsSearching(true)
    setShowSearchResults(true)

    try {
      // Fetch all resources for this subject
      const resourcesQuery = query(collection(db, "resources"), where("subjectId", "==", params.id))
      const resourcesSnapshot = await getDocs(resourcesQuery)

      if (resourcesSnapshot.empty) {
        setSearchResults([])
      } else {
        const allResources = resourcesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Resource[]

        // Filter resources based on search query
        const query = searchQuery.toLowerCase()
        const filteredResources = allResources.filter(
          (resource) =>
            resource.title.toLowerCase().includes(query) || resource.description.toLowerCase().includes(query),
        )

        setSearchResults(filteredResources)
      }
    } catch (error) {
      console.error("Error searching resources:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
    setShowSearchResults(false)
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
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
        {/* Background blur elements */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/20 dark:bg-blue-900/10 blur-xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/15 dark:bg-blue-800/10 blur-xl animate-float-medium"></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/20 dark:bg-blue-700/10 blur-xl animate-float-fast"></div>
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-pink-400/10 dark:bg-indigo-600/10 blur-xl animate-float-reverse"></div>

        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center relative z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading subject information...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
        {/* Background blur elements */}
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/20 dark:bg-blue-900/10 blur-xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/15 dark:bg-blue-800/10 blur-xl animate-float-medium"></div>
        <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/20 dark:bg-blue-700/10 blur-xl animate-float-fast"></div>
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-pink-400/10 dark:bg-indigo-600/10 blur-xl animate-float-reverse"></div>

        <Navbar />
        <main className="flex-1 container py-8 relative z-10">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Subject not found</h1>
            <p className="text-muted-foreground mb-6">
              The subject you're looking for doesn't exist or has been removed.
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
              Back to Subjects
            </Button>
          </Link>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">{subject.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                  {subject.level.charAt(0).toUpperCase() + subject.level.slice(1)} Level
                </span>
              </div>
            </div>

            {/* Inline Search form */}
            <form onSubmit={handleSearch} className="w-full md:w-auto flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full md:w-[300px]"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button type="submit" disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Search
              </Button>
            </form>
          </div>

          <p className="text-muted-foreground mb-4">{subject.description}</p>

          {/* Recent Contributors */}
          <RecentContributors subjectId={subject.id} />

          {/* Search Results Section */}
          {showSearchResults && (
            <div className="mb-8 bg-sky-50/50 dark:bg-sky-900/20 p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Search Results {searchResults.length > 0 ? `(${searchResults.length})` : ""}
                </h2>
                <Button variant="ghost" size="sm" onClick={clearSearch}>
                  <X className="h-4 w-4 mr-2" />
                  Close
                </Button>
              </div>

              {isSearching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No resources found matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className="h-[25vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid gap-4">
                    {searchResults.map((resource) => (
                      <Card key={resource.id} className="overflow-hidden transition-all duration-300">
                        <CardHeader className="bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/50 dark:to-gray-800/50 py-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{resource.title}</CardTitle>
                              <Badge variant="secondary" className="mt-1">
                                {getWeekLabel(resource)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="py-3">
                          <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                        </CardContent>
                        <CardFooter className="py-3 flex justify-end border-t">
                          <Link
                            href={
                              resource.isGeneral
                                ? `/subject/${resource.subjectId}/general`
                                : `/subject/${resource.subjectId}/week/${resource.week}`
                            }
                          >
                            <Button variant="ghost" size="sm" className="text-primary">
                              View in {getWeekLabel(resource)}
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Resources Section */}
          {subject.hasGeneralResource && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                General Resources
              </h2>
              <Link href={`/subject/${subject.id}/general`}>
                <Card className="hover-scale transition-colors">
                  <CardHeader className="bg-gradient-to-r from-sky-100 to-sky-50 dark:from-sky-900 dark:to-sky-800 py-3 px-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>General Resources</span>
                      {!loadingCounts && (
                        <Badge variant="secondary" className="ml-2">
                          {resourceCounts["general"] || 0} resources
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-2 px-4">
                    <p className="text-sm text-muted-foreground">
                      View resources that apply to the entire subject, not specific to any week
                    </p>
                  </CardContent>
                  <CardFooter className="py-2 px-4">
                    <Button variant="ghost" size="sm" className="text-primary px-0 hover:bg-transparent">
                      Browse Resources
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            </div>
          )}

          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Weeks
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: subject.weeks }, (_, i) => i + 1).map((weekNum) => (
              <Link href={`/subject/${subject.id}/week/${weekNum}`} key={weekNum}>
                <Card className="hover-scale h-full flex flex-col transition-colors">
                  <CardHeader className="bg-gradient-to-r from-sky-100 to-sky-50 dark:from-sky-900 dark:to-sky-800 py-3 px-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Week {weekNum}</span>
                      {!loadingCounts && (
                        <Badge variant="secondary" className="ml-2">
                          {resourceCounts[weekNum.toString()] || 0} resources
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 pb-2 px-4 flex-grow">
                    <p className="text-sm text-muted-foreground">View resources shared for Week {weekNum}</p>
                  </CardContent>
                  <CardFooter className="mt-auto py-2 px-4">
                    <Button variant="ghost" size="sm" className="text-primary px-0 hover:bg-transparent">
                      Browse Resources
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
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
