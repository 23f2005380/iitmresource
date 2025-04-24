import { Loader2 } from "lucide-react"

import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function NotificationRepliesLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="flex items-center mb-6">
          <div className="w-8 h-8 rounded-md bg-muted animate-pulse mr-2" />
          <div className="h-8 w-48 bg-muted rounded-md animate-pulse" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="w-64 h-8 bg-muted rounded-md animate-pulse" />
              <div className="w-24 h-8 bg-muted rounded-md animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading notifications...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
