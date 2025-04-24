"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ThankYouAnimation } from "@/components/thank-you-animation"

interface ResourceFormProps {
  initialData?: {
    title: string
    description: string
    type: string
    url: string
    urls: string[]
    content: string
  }
  onSubmit: (data: {
    title: string
    description: string
    type: string
    url: string
    urls: string[]
    content: string
  }) => void
  buttonText?: string
  onSuccess?: () => void
}

export function ResourceForm({ initialData, onSubmit, buttonText = "Add Resource", onSuccess }: ResourceFormProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    type: initialData?.type || "youtube",
    url: initialData?.url || "",
    urls: initialData?.urls || [],
    content: initialData?.content || "",
  })
  const [newUrl, setNewUrl] = useState("")

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      setIsLoading(false)
      if (!currentUser) {
        router.push("/login")
      }
    })

    return () => unsubscribe()
  }, [router])

  if (isLoading) return null
  if (!user) return null

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddUrl = () => {
    if (newUrl.trim() && !formData.urls.includes(newUrl.trim())) {
      setFormData((prev) => ({
        ...prev,
        urls: [...prev.urls, newUrl.trim()],
      }))
      setNewUrl("")
    }
  }

  const handleRemoveUrl = (urlToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      urls: prev.urls.filter((url) => url !== urlToRemove),
    }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Make sure to pass the entire formData object including urls array
      await onSubmit({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        url: formData.url,
        urls: formData.urls, // This ensures the additional URLs are passed
        content: formData.content,
      })

      // Show thank you animation
      setShowThankYou(true)

      // Reset form
      setFormData({
        title: "",
        description: "",
        type: "youtube",
        url: "",
        urls: [],
        content: "",
      })

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Enter key press in the URL input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddUrl()
    }
  }

  return (
    <>
      <ThankYouAnimation show={showThankYou} onClose={() => setShowThankYou(false)} />

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="title" className="text-base font-medium">
            Title
          </Label>
          <Input
            id="title"
            placeholder="Enter a descriptive title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className="text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description" className="text-base font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Briefly describe this resource"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className="text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="type" className="text-base font-medium">
            Resource Type
          </Label>
          <Select value={formData.type} onValueChange={(value) => handleChange("type", value)}>
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select resource type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube Video</SelectItem>
              <SelectItem value="website">Website Link</SelectItem>
              <SelectItem value="gdrive">Google Drive</SelectItem>
              <SelectItem value="text">Text Content</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(formData.type === "youtube" || formData.type === "website" || formData.type === "gdrive") && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="url" className="text-base font-medium">
                Main URL
              </Label>
              <Input
                id="url"
                placeholder="Enter the main resource URL"
                value={formData.url}
                onChange={(e) => handleChange("url", e.target.value)}
                className="text-base"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-base font-medium">Additional URLs</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add another URL"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-base"
                />
                <Button type="button" onClick={handleAddUrl} size="icon" className="flex-shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {formData.urls.length > 0 && (
                <motion.div className="mt-2 flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {formData.urls.map((url, index) => (
                    <motion.div
                      key={url}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Badge variant="secondary" className="flex items-center gap-1 py-1 px-2">
                        <span className="truncate max-w-[200px] text-sm">{url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => handleRemoveUrl(url)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </>
        )}

        {formData.type === "text" && (
          <div className="grid gap-2">
            <Label htmlFor="content" className="text-base font-medium">
              Content
            </Label>
            <Textarea
              id="content"
              placeholder="Enter your text content"
              className="min-h-[150px] text-base"
              value={formData.content}
              onChange={(e) => handleChange("content", e.target.value)}
            />
          </div>
        )}

        <Button type="button" onClick={handleSubmit} className="mt-2 text-base py-5" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : buttonText}
        </Button>
      </div>
    </>
  )
}
