"use client"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import SubjectSearchContent from "@/components/subject-search-content"

interface Subject {
  id: string
  name: string
  level: string
  description: string
  weeks: number
}

interface Resource {
  id: string
  title: string
  description: string
  type: string
  url?: string
  content?: string
  createdBy: string
  creatorName?: string
  createdAt: any
  likes: number
  likedBy: string[]
  subjectId: string
  week?: number
  isGeneral?: boolean
}

// Wrap the component that uses useSearchParams in Suspense
export default function SubjectSearchPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="text-center p-8">Loading search results...</div>}>
      <SubjectSearchWrapper params={params} />
    </Suspense>
  )
}

// Client component that uses useSearchParams
function SubjectSearchWrapper({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()

  return <SubjectSearchContent params={params} searchParams={searchParams} />
}
