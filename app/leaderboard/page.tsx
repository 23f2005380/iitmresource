"use client"

import { useEffect, useState } from "react"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { Trophy, Search, Users } from "lucide-react"

import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface Contributor {
  email: string
  displayName: string
  count: number
  photoURL?: string
}

export default function LeaderboardPage() {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [filteredContributors, setFilteredContributors] = useState<Contributor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchAllContributors = async () => {
      try {
        setLoading(true)

        // Get all resources
        const resourcesQuery = query(collection(db, "resources"), orderBy("createdAt", "desc"))
        const resourcesSnapshot = await getDocs(resourcesQuery)

        // Count contributions by email
        const contributorMap = new Map<string, { count: number; displayName: string; photoURL?: string }>()

        resourcesSnapshot.forEach((doc) => {
          const data = doc.data()
          const email = data.createdBy
          const displayName = data.creatorName || email?.split("@")[0] || "User"

          if (email) {
            if (contributorMap.has(email)) {
              contributorMap.get(email)!.count += 1
            } else {
              contributorMap.set(email, {
                count: 1,
                displayName,
                photoURL: data.creatorPhotoURL,
              })
            }
          }
        })

        // Convert to array and sort by count
        const sortedContributors = Array.from(contributorMap.entries())
          .map(([email, data]) => ({
            email,
            displayName: data.displayName,
            count: data.count,
            photoURL: data.photoURL,
          }))
          .sort((a, b) => b.count - a.count)

        setContributors(sortedContributors)
        setFilteredContributors(sortedContributors)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching contributors:", error)
        setLoading(false)
      }
    }

    fetchAllContributors()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContributors(contributors)
    } else {
      const filtered = contributors.filter(
        (contributor) =>
          contributor.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contributor.email.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredContributors(filtered)
    }
  }, [searchQuery, contributors])

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return <Badge className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0">Platinum</Badge>
      case 1:
        return <Badge className="bg-gradient-to-r from-blue-400 to-cyan-300 text-white border-0">Diamond</Badge>
      case 2:
        return <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0">Gold</Badge>
      case 3:
        return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800 border-0">Silver</Badge>
      case 4:
        return <Badge className="bg-gradient-to-r from-amber-700 to-amber-600 text-white border-0">Bronze</Badge>
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950">
    
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-8 w-8 text-amber-500" />
            <h1 className="text-3xl font-bold">Contributor Leaderboard</h1>
          </div>

          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">All Contributors</CardTitle>
                  <CardDescription>Users who have shared resources on the platform</CardDescription>
                </div>
                <Badge variant="outline" className="px-3 py-1">
                  <Users className="h-3 w-3 mr-1" />
                  {filteredContributors.length} {filteredContributors.length === 1 ? "User" : "Users"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-4">
                  {Array(10)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-center font-medium">
                          {i + 1}
                        </div>
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ))}
                </div>
              ) : filteredContributors.length > 0 ? (
                <div className="space-y-4">
                  {filteredContributors.map((contributor, index) => (
                    <div
                      key={contributor.email}
                      className="flex items-center gap-3 p-3 rounded-lg border staggered-item"
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-center font-medium
                        ${
                          index === 0
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                            : index === 1
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                              : index === 2
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
                                : index === 3
                                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                                  : index === 4
                                    ? "bg-amber-800 text-amber-100 dark:bg-amber-700 dark:text-amber-100"
                                    : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{contributor.displayName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="px-3 py-1">
                          {contributor.count} {contributor.count === 1 ? "resource" : "resources"}
                        </Badge>
                        {index < 5 && getRankBadge(index)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium mb-2">No contributors found</h3>
                  <p className="text-muted-foreground">Try a different search term</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
