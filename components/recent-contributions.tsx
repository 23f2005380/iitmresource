"use client"

import { useEffect, useState } from "react"
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore"
import { Clock, ExternalLink, FileText, Youtube } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

import { db } from "@/app/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface Contribution {
  id: string
  title: string
  type: string
  createdBy: string
  creatorName: string
  createdAt: Date
  subjectId?: string
  subjectName?: string
  week?: number
  isGlobal?: boolean
}

export function RecentContributions({ className = "", limit: itemLimit = 5 }: { className?: string; limit?: number }) {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecentContributions = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get recent resources
        const resourcesQuery = query(collection(db, "resources"), orderBy("createdAt", "desc"), limit(itemLimit))
        const resourcesSnapshot = await getDocs(resourcesQuery)

        const contributionsData: Contribution[] = []

        // Process each resource
        for (const resourceDoc of resourcesSnapshot.docs) {
          const data = resourceDoc.data()
          let subjectName = undefined

          // If resource has a subject, fetch the subject name
          if (data.subjectId) {
            try {
              const subjectDoc = await getDoc(doc(db, "subjects", data.subjectId))
              if (subjectDoc.exists()) {
                subjectName = subjectDoc.data().name
              }
            } catch (error) {
              console.error("Error fetching subject:", error)
            }
          }

          contributionsData.push({
            id: resourceDoc.id,
            title: data.title,
            type: data.type,
            createdBy: data.createdBy,
            creatorName: data.creatorName || data.createdBy?.split("@")[0] || "User",
            createdAt: data.createdAt?.toDate() || new Date(),
            subjectId: data.subjectId,
            subjectName,
            week: data.week,
            isGlobal: data.isGlobal,
          })
        }

        setContributions(contributionsData)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching recent contributions:", error)
        setError("Failed to load recent contributions. Please try again later.")
        setLoading(false)
      }
    }

    fetchRecentContributions()
  }, [itemLimit])

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube":
        return <Youtube className="h-4 w-4 text-red-500 flex-shrink-0" />
      case "website":
        return <ExternalLink className="h-4 w-4 text-primary flex-shrink-0" />
      case "gdrive":
        return <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
      case "text":
        return <FileText className="h-4 w-4 text-primary flex-shrink-0" />
      default:
        return null
    }
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/30 dark:to-gray-800/50 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-500" />
          <CardTitle className="text-lg">Recent Contributions</CardTitle>
        </div>
        <CardDescription>Latest resources shared by the community</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-3">
            {Array(itemLimit)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm text-primary hover:underline">
              Refresh page
            </button>
          </div>
        ) : contributions.length > 0 ? (
          <div
            className={`space-y-2 ${contributions.length > 3 ? "max-h-[250px] overflow-y-auto pr-2 custom-scrollbar" : ""}`}
          >
            {contributions.map((contribution, index) => (
              <Link
                key={contribution.id}
                href={`/resource/${contribution.id}`}
                className="block p-2 rounded-lg border hover:bg-muted/50 transition-colors staggered-item"
              >
                <div className="flex items-start gap-2">
                  {getResourceTypeIcon(contribution.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contribution.title}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                      <span className="text-sm text-muted-foreground">by {contribution.creatorName}</span>
                      {contribution.isGlobal ? (
                        <Badge variant="outline" className="text-xs">
                          Community
                        </Badge>
                      ) : (
                        <>
                          {contribution.subjectName && (
                            <Badge variant="outline" className="text-xs">
                              {contribution.subjectName}
                            </Badge>
                          )}
                          {contribution.week && (
                            <Badge variant="outline" className="text-xs">
                              Week {contribution.week}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(contribution.createdAt, { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-3">No recent contributions</p>
        )}
      </CardContent>
    </Card>
  )
}
