"use client"

import { useEffect, useState } from "react"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { Trophy, Users, ChevronRight } from "lucide-react"
import Link from "next/link"

import { db } from "@/app/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface Contributor {
  email: string
  displayName: string
  count: number
  photoURL?: string
}

export function Leaderboard({ className = "", limit: itemLimit = 5 }: { className?: string; limit?: number }) {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTopContributors = async () => {
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
          .slice(0, itemLimit)

        setContributors(sortedContributors)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching top contributors:", error)
        setLoading(false)
      }
    }

    fetchTopContributors()
  }, [itemLimit])

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
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/30 dark:to-gray-800/50 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-lg">Top Contributors</CardTitle>
        </div>
        <CardDescription>Users who have shared the most resources</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3">
            {Array(itemLimit)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-center font-medium">
                    {i + 1}
                  </div>
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
          </div>
        ) : contributors.length > 0 ? (
          <div
            className={`space-y-3 ${contributors.length > 3 ? "max-h-[250px] overflow-y-auto pr-2 custom-scrollbar" : ""}`}
          >
            {contributors.map((contributor, index) => (
              <div key={contributor.email} className="flex items-center gap-2 staggered-item">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-center font-medium
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
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{contributor.displayName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{contributor.count}</Badge>
                  {getRankBadge(index)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-3">No contributors yet</p>
        )}
      </CardContent>
      <CardFooter className="border-t pt-3">
        <Link href="/leaderboard" className="w-full">
          <Button variant="outline" className="w-full gap-1">
            <Users className="h-4 w-4" />
            <span>View All Contributors</span>
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
