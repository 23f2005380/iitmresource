import { Loader2 } from "lucide-react"

export default function StudyTrackerLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Loading study tracker...</span>
    </div>
  )
}
