"use client"

import { Suspense } from "react"
import AddSubjectForm from "@/components/add-subject-form"

export default function AddSubjectPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
      <AddSubjectForm />
    </Suspense>
  )
}
