"use client"

import { useState, useEffect } from "react"
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"

import { db } from "@/app/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Youtube, ExternalLink } from "lucide-react"

interface Contributor {
  id: string
  email: string
  name: string
  photoURL?: string
  latestResource: {
    id: string
    title: string
    type: string
    description: string
    week?: number
    isGeneral?: boolean
  }
}

interface RecentContributorsProps {
  subjectId: string
  limit?: number
}

export function RecentContributors({ subjectId, limit: contributorsLimit = 5 }: RecentContributorsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecentContributors = async () => {
      try {
        // Get recent resources for this subject
        const resourcesQuery = query(
          collection(db, "resources"),
          where("subjectId", "==", subjectId),
          orderBy("createdAt", "desc"),
          limit(20), // Fetch more than needed to get unique contributors
        )

        const resourcesSnapshot = await getDocs(resourcesQuery)

        if (resourcesSnapshot.empty) {
          setContributors([])
          setLoading(false)
          return
        }

        // Process resources to get unique contributors
        const contributorsMap = new Map<string, Contributor>()

        resourcesSnapshot.docs.forEach((doc) => {
          const resource = { id: doc.id, ...doc.data() }
          const email = resource.createdBy

          if (!contributorsMap.has(email)) {
            contributorsMap.set(email, {
              id: email,
              email: email,
              name: resource.creatorName || email.split("@")[0],
              photoURL: resource.creatorPhotoURL,
              latestResource: {
                id: resource.id,
                title: resource.title,
                type: resource.type,
                description: resource.description,
                week: resource.week,
                isGeneral: resource.isGeneral,
              },
            })
          }
        })

        // Convert map to array and limit to requested number
        const contributorsList = Array.from(contributorsMap.values()).slice(0, contributorsLimit)
        setContributors(contributorsList)
      } catch (error) {
        console.error("Error fetching recent contributors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentContributors()
  }, [subjectId, contributorsLimit])

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube":
        return <Youtube className="h-4 w-4 text-red-500" />
      case "website":
        return <ExternalLink className="h-4 w-4 text-primary" />
      case "gdrive":
        return <FileText className="h-4 w-4 text-green-500" />
      case "text":
        return <FileText className="h-4 w-4 text-primary" />
      default:
        return null
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="flex space-x-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (contributors.length === 0) {
    return null
  }

  return (
    <div className="py-2">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Contributors</h3>
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence>
          {contributors.map((contributor, index) => (
            <motion.div
              key={contributor.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Link href={`/resource/${contributor.latestResource.id}`}>
                    <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-800 shadow-sm cursor-pointer transition-transform hover:scale-110">
                      {contributor.photoURL ? (
                        <AvatarImage src={contributor.photoURL || "/placeholder.svg"} alt={contributor.name} />
                      ) : (
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs">
                          {getInitials(contributor.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </Link>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0" align="start">
                  <Card className="border-0 shadow-none">
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{contributor.name}</CardTitle>
                          <CardDescription className="text-xs truncate">{contributor.email}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1">
                          {getResourceTypeIcon(contributor.latestResource.type)}
                          <Badge variant="outline" className="text-xs">
                            {contributor.latestResource.isGeneral
                              ? "General"
                              : contributor.latestResource.week
                                ? `Week ${contributor.latestResource.week}`
                                : "Resource"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <h4 className="font-medium text-sm mb-1">{contributor.latestResource.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {contributor.latestResource.description}
                      </p>
                    </CardContent>
                  </Card>
                </HoverCardContent>
              </HoverCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
