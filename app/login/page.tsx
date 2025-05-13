"use client"

import { useState, useEffect } from "react"
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { serverTimestamp, doc, setDoc, getDoc } from "firebase/firestore"

import { auth, db } from "@/app/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Navbar } from "@/components/navbar"

export default function LoginPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const googleProvider = new GoogleAuthProvider()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
        router.push("/")
      } else {
        setIsAuthenticated(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)

    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid))

      if (!userDoc.exists()) {
        // Create new user document if it doesn't exist
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "Google User",
          role: "student",
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
        })
      }

      toast({
        title: "Signed in with Google successfully",
        variant: "default",
      })

      router.push("/")
    } catch (error: any) {
      console.error("Google sign in error:", error)

      let errorMessage = "Failed to sign in with Google. Please try again."
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-in popup was closed. Please try again."
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Multiple popup requests. Please try again."
      } else if (error.code === "auth/popup-blocked") {
        errorMessage = "Popup was blocked by your browser. Please allow popups for this site."
      }

      toast({
        title: "Error signing in with Google",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setGoogleLoading(false)
    }
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
       
        <main className="flex-1 container flex items-center justify-center py-8">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Already Signed In</CardTitle>
              <CardDescription>You are already signed in to your account</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/" className="w-full">
                <Button className="w-full">Go to Home</Button>
              </Link>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
      {/* Background blur elements */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-pink-200/20 dark:bg-blue-900/10 blur-xl animate-float-slow"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-pink-300/15 dark:bg-blue-800/10 blur-xl animate-float-medium"></div>
      <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-pink-100/20 dark:bg-blue-700/10 blur-xl animate-float-fast"></div>
      <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-pink-400/10 dark:bg-indigo-600/10 blur-xl animate-float-reverse"></div>

      <Navbar />
      <main className="flex-1 container flex items-center justify-center py-8 relative z-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Sign in to access the IITM Resource Hub</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2 py-6"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                "Connecting..."
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="24"
                    viewBox="0 0 24 24"
                    width="24"
                    className="h-5 w-5"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardFooter>
        </Card>
      </main>
      <footer className="border-t py-6 bg-sky-50 dark:bg-gray-900 relative z-10">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Built by students, for students. IITM BS Resource Hub.</p>
        </div>
      </footer>
    </div>
  )
}
