"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Code, Search, BookOpen } from "lucide-react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

interface SearchResult {
  id: string
  title: string
  description: string
  type: "resource" | "project" | "subject"
  subjectSlug?: string
  week?: number
  slug?: string
  createdAt?: any
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get("q") || ""
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setResults([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const searchResults: SearchResult[] = []
      const searchTermLower = searchTerm.toLowerCase()

      try {
        // Search in subjects
        const subjectsRef = collection(db, "subjects")
        const subjectsSnapshot = await getDocs(subjectsRef)

        subjectsSnapshot.forEach((doc) => {
          const data = doc.data()
          const titleMatch = data.title?.toLowerCase().includes(searchTermLower)
          const descMatch = data.description?.toLowerCase().includes(searchTermLower)

          if (titleMatch || descMatch) {
            searchResults.push({
              id: doc.id,
              title: data.title,
              description: data.description,
              type: "subject",
              slug: data.slug,
              createdAt: data.createdAt,
            })
          }
        })

        // Search in resources
        const resourcesRef = collection(db, "resources")
        const resourcesSnapshot = await getDocs(resourcesRef)

        resourcesSnapshot.forEach((doc) => {
          const data = doc.data()
          const titleMatch = data.title?.toLowerCase().includes(searchTermLower)
          const descMatch = data.description?.toLowerCase().includes(searchTermLower)

          if (titleMatch || descMatch) {
            searchResults.push({
              id: doc.id,
              title: data.title,
              description: data.description,
              type: "resource",
              subjectSlug: data.subjectSlug,
              week: data.week,
              createdAt: data.createdAt,
            })
          }
        })

        // Search in projects
        const projectsRef = collection(db, "projects")
        const projectsSnapshot = await getDocs(projectsRef)

        projectsSnapshot.forEach((doc) => {
          const data = doc.data()
          const titleMatch = data.title?.toLowerCase().includes(searchTermLower)
          const descMatch = data.description?.toLowerCase().includes(searchTermLower)

          if (titleMatch || descMatch) {
            searchResults.push({
              id: doc.id,
              title: data.title,
              description: data.description,
              type: "project",
              createdAt: data.createdAt,
            })
          }
        })

        // Sort by relevance and date
        searchResults.sort((a, b) => {
          const aTitle = a.title.toLowerCase()
          const bTitle = b.title.toLowerCase()
          const aTitleMatch = aTitle.includes(searchTermLower)
          const bTitleMatch = bTitle.includes(searchTermLower)

          if (aTitleMatch && !bTitleMatch) return -1
          if (!aTitleMatch && bTitleMatch) return 1

          // If both or neither match title, sort by date
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        })

        setResults(searchResults)
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    performSearch()
  }, [searchTerm])

  const getResultIcon = (type: string) => {
    switch (type) {
      case "resource":
        return <FileText className="h-5 w-5" />
      case "project":
        return <Code className="h-5 w-5" />
      case "subject":
        return <BookOpen className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getResultLink = (result: SearchResult) => {
    switch (result.type) {
      case "resource":
        return `/resource/${result.id}`
      case "project":
        return `/projects/${result.id}`
      case "subject":
        return `/subject/${result.id}`
      default:
        return "#"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Search Results</h1>
          </div>
          <p className="text-muted-foreground">
            {isLoading
              ? "Searching..."
              : `Found ${results.length} result${results.length !== 1 ? "s" : ""} for "${searchTerm}"`}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Searching...</span>
          </div>
        ) : results.length > 0 ? (
          <div className="grid gap-6">
            {results.map((result) => (
              <Card key={`${result.type}-${result.id}`} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {getResultIcon(result.type)}
                      <div>
                        <CardTitle className="text-lg">
                          <Link href={getResultLink(result)} className="hover:text-primary transition-colors">
                            {result.title}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary">{result.type}</Badge>
                          {result.week && <Badge variant="outline">Week {result.week}</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{result.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">Try adjusting your search terms or browse our categories.</p>
          </div>
        )}
      </div>
    </div>
  )
}
