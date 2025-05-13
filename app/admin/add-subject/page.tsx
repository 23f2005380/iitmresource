"use client"

import type React from "react"

import { useState } from "react"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Loader2, Plus } from "lucide-react"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminCheck } from "@/hooks/use-admin-check"

export default function AddSubjectPage() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    level: "foundation",
    weeks: 12,
    slug: "",
    hasGeneralResource: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { isAdmin, loading } = useAdminCheck()
  const router = useRouter()
  const { toast } = useToast()

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Auto-generate slug when name changes
    if (field === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
      setFormData((prev) => ({ ...prev, slug }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.description) {
      toast({
        title: "Missing information",
        description: "Please provide both name and description",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const subjectData = {
        ...formData,
        weeks: Number(formData.weeks),
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.email,
      }

      const docRef = await addDoc(collection(db, "subjects"), subjectData)

      toast({
        title: "Subject added",
        description: "The subject has been added successfully",
      })

      router.push("/admin")
    } catch (error) {
      console.error("Error adding subject:", error)
      toast({
        title: "Error adding subject",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
   
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Checking permissions...</CardTitle>
              <CardDescription>Please wait while we verify your access</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>You don't have permission to access this page</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center">
              <Link href="/">
                <Button>Back to Home</Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 animate-gradient-x">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Add New Subject</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Create a new subject for students to share resources
          </p>
        </div>

        <Card className="max-w-2xl mx-auto hover-card-animation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Subject Details
            </CardTitle>
            <CardDescription>Enter the details for the new subject</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Python for Data Science"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL-friendly name)</Label>
                <Input
                  id="slug"
                  placeholder="e.g. python-for-data-science"
                  value={formData.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This will be used in the URL. Auto-generated from the subject name.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this subject covers"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  required
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Select value={formData.level} onValueChange={(value) => handleChange("level", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="foundation">Foundation</SelectItem>
                      <SelectItem value="diploma">Diploma</SelectItem>
                      <SelectItem value="degree">Degree</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeks">Number of Weeks</Label>
                  <Input
                    id="weeks"
                    type="number"
                    min="1"
                    max="52"
                    value={formData.weeks}
                    onChange={(e) => handleChange("weeks", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Subject...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Subject
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
