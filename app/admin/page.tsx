"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  Cog,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  ThumbsUp,
  User,
  Users,
} from "lucide-react"

import { db, auth } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = auth.currentUser
        if (!user) {
          router.push("/login")
          return
        }

        const userRef = collection(db, "users")
        const q = query(userRef, where("email", "==", user.email))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          router.push("/")
          return
        }

        const userData = querySnapshot.docs[0].data()
        if (userData.role !== "admin") {
          toast({
            title: "Access denied",
            description: "You don't have permission to access this page",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        setIsAdmin(true)
        setLoading(false)
      } catch (error) {
        console.error("Error checking admin status:", error)
        router.push("/")
      }
    }

    checkAdmin()
  }, [router, toast])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 animate-gradient-x">
      
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
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950 animate-gradient-x">
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
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Admin Dashboard</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Manage resources, users, and platform settings from this central dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Content Management */}
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Content Management
              </CardTitle>
              <CardDescription>Manage resources and content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/admin/review" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Review Submissions
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/add-subject" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Add Subject
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/featured" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Featured Resources
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Management
              </CardTitle>
              <CardDescription>Manage users and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/admin/manage-users" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Manage Users
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/roles" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    Role Permissions
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Communication */}
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Communication
              </CardTitle>
              <CardDescription>Communicate with users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/admin/notifications" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notifications
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/notification-replies" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Notification Replies
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Link href="/admin/send-emails" className="card hover:shadow-md transition-shadow">
            <div className="card-content p-6">
              <div className="flex items-center gap-3">
                <div className="icon-container bg-blue-100 dark:bg-blue-900">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600 dark:text-blue-300"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium">Send Emails</h3>
                  <p className="text-sm text-light">Send custom emails to users</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Platform Settings */}
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Platform Settings
              </CardTitle>
              <CardDescription>Configure platform settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/admin/settings" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <Cog className="h-4 w-4 mr-2" />
                    General Settings
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Add New */}
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Quickly add new content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/admin/add-subject" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Add New Subject
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/admin/notifications" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center">
                    <Bell className="h-4 w-4 mr-2" />
                    Send New Notification
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
