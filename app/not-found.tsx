"use client"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-6">Page Not Found</h2>
      <p className="text-center mb-8 text-muted-foreground max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Button onClick={() => router.push("/")}>Return to Home</Button>
    </div>
  )
}
