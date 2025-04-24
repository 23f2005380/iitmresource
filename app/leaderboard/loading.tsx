import { Skeleton } from "@/components/ui/skeleton"
import { Navbar } from "@/components/navbar"
import { Trophy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LeaderboardLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="h-8 w-8 text-amber-500" />
            <h1 className="text-3xl font-bold">Contributor Leaderboard</h1>
          </div>

          <div className="mb-6">
            <Skeleton className="h-10 w-full" />
          </div>

          <Card>
            <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-gray-800/50">
              <CardTitle className="text-xl">All Contributors</CardTitle>
              <CardDescription>Users who have shared resources on the platform</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
