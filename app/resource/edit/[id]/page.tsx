"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { ResourceForm } from "@/components/resource-form"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

export default function EditResourcePage({ params }: { params: { id: string } }) {
  const [resource, setResource] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchResource = async () => {
      try {
        // Check if user is authenticated
        if (!auth.currentUser) {
          setUnauthorized(true)
          setLoading(false)
          return
        }

        const resourceDoc = doc(db, "resources", params.id)
        const resourceSnapshot = await getDoc(resourceDoc)

        if (!resourceSnapshot.exists()) {
          setLoading(false)
          return
        }

        const resourceData = resourceSnapshot.data()

        // Check if the current user is the creator of the resource
        if (resourceData.createdBy !== auth.currentUser.email) {
          setUnauthorized(true)
          setLoading(false)
          return
        }

        setResource({
          id: resourceSnapshot.id,
          ...resourceData,
        })
        setLoading(false)
      } catch (error) {
        console.error("Error fetching resource:", error)
        setLoading(false)
      }
    }

    fetchResource()
  }, [params.id])

  const handleUpdateResource = async (formData: any) => {
    try {
      if (!auth.currentUser) {
        toast({
          title: "Authentication required",
          description: "Please sign in to update resources",
          variant: "destructive",
        })
        return
      }

      const resourceRef = doc(db, "resources", params.id)

      await updateDoc(resourceRef, {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        url: formData.url,
        urls: formData.urls,
        content: formData.content,
        updatedAt: new Date(),
      })

      toast({
        title: "Resource updated",
        description: "Your resource has been updated successfully",
      })

      // Redirect back to the resource page
      router.push(`/resource/${params.id}`)
    } catch (error) {
      console.error("Error updating resource:", error)
      toast({
        title: "Error updating resource",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading resource...</p>
          </div>
        </main>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
            <p className="text-muted-foreground mb-6">You don't have permission to edit this resource.</p>
            <Link href={`/resource/${params.id}`}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Resource
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
        <Navbar />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Resource not found</h1>
            <p className="text-muted-foreground mb-6">
              The resource you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="mb-6">
          <Link href={`/resource/${params.id}`}>
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Resource
            </Button>
          </Link>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-sm border p-6 mb-8">
          <h1 className="text-2xl font-bold mb-6">Edit Resource</h1>

          <ResourceForm
            initialData={{
              title: resource.title,
              description: resource.description,
              type: resource.type,
              url: resource.url || "",
              urls: resource.urls || [],
              content: resource.content || "",
            }}
            onSubmit={handleUpdateResource}
            buttonText="Update Resource"
          />
        </div>
      </main>
    </div>
  )
}
