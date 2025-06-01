"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Search, FileText, Code, BookOpen } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/app/firebase"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  title: string
  description: string
  type: "resource" | "project" | "subject"
  subjectSlug?: string
  week?: number
  slug?: string
}

export function GlobalSearch() {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const performSearch = async () => {
    if (!searchTerm.trim()) {
      setResults([])
      setIsOpen(false)
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
          })
        }
      })

      // Search in resources (both subject and community resources)
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
          })
        }
      })

      // Sort by relevance (title matches first, then description matches)
      searchResults.sort((a, b) => {
        const aTitle = a.title.toLowerCase()
        const bTitle = b.title.toLowerCase()
        const aTitleMatch = aTitle.includes(searchTermLower)
        const bTitleMatch = bTitle.includes(searchTermLower)

        if (aTitleMatch && !bTitleMatch) return -1
        if (!aTitleMatch && bTitleMatch) return 1

        // If both or neither match title, sort by title alphabetically
        return aTitle.localeCompare(bTitle)
      })

      setResults(searchResults.slice(0, 5))
      setIsOpen(true)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      performSearch()
    }
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case "resource":
        return <FileText className="h-4 w-4" />
      case "project":
        return <Code className="h-4 w-4" />
      case "subject":
        return <BookOpen className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
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

  const handleSeeMore = () => {
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={searchRef}>
      <div className="flex items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search everything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-8 w-64"
          />
        </div>
        <Button onClick={performSearch} size="sm" disabled={isLoading}>
          {isLoading ? "..." : "Search"}
        </Button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <>
              <div className="p-2">
                {results.map((result) => (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={getResultLink(result)}
                    onClick={() => setIsOpen(false)}
                    className="block p-3 hover:bg-accent rounded-md transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-1">{getResultIcon(result.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium truncate">{result.title}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {result.type}
                          </Badge>
                          {result.week && (
                            <Badge variant="outline" className="text-xs">
                              Week {result.week}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" onClick={handleSeeMore} className="w-full text-primary">
                  See all results for "{searchTerm}"
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground">No results found for "{searchTerm}"</div>
          )}
        </div>
      )}
    </div>
  )
}
