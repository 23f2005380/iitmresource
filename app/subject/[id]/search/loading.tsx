import { Loader2 } from "lucide-react"
import { Navbar } from "@/components/navbar"

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Searching resources...</p>
        </div>
      </main>
    </div>
  )
}
