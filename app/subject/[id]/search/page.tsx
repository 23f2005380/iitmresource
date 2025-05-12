import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import SubjectSearchContent from "@/components/subject-search-content"

export default function SubjectSearchPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="flex-1 container py-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading search results...</p>
            </div>
          </div>
        </div>
      }
    >
      <SubjectSearchContent params={params} />
    </Suspense>
  )
}
