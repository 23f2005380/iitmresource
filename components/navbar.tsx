"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X, Home, BookOpen, Users, Award, LogOut, FileText, Code, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { auth, db } from "@/app/firebase"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { collection, getDocs, query, where } from "firebase/firestore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser)

      // Check if user is admin
      if (currentUser) {
        try {
          // Check if user is admin by querying Firestore
          const userRef = collection(db, "users")
          const q = query(userRef, where("email", "==", currentUser.email))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data()
            setIsAdmin(userData.role === "admin")
          } else {
            setIsAdmin(false)
          }
        } catch (error) {
          console.error("Error checking admin status:", error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      })
      router.push("/login")
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const getInitials = (email) => {
    if (!email) return "U"
    return email.substring(0, 2).toUpperCase()
  }

  const isActive = (path) => {
    if (path === "/" && pathname !== "/") {
      return false
    }
    return pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">IITM BS Resource Hub</span>
          </Link>
          <Button variant="outline" size="icon" className="md:hidden" onClick={toggleMenu}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
        <div className="hidden md:flex md:flex-1 md:items-center md:justify-between">
          <nav className="flex items-center justify-center space-x-1">
            <Link
              href="/"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </span>
            </Link>
            <Link
              href="/community-resources"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/community-resources") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                All Resources
              </span>
            </Link>
            <Link
              href="/projects"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/projects") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                Projects
              </span>
            </Link>
            <Link
              href="/chat"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/chat") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Chat
              </span>
            </Link>
            <Link
              href="/leaderboard"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/leaderboard") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                Leaderboard
              </span>
            </Link>
            <Link
              href="/study-tracker"
              className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                isActive("/study-tracker") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                Study Tracker
              </span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/admin") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </span>
              </Link>
            )}
          </nav>
          <div className="flex items-center space-x-2">
            <ThemeSwitcher />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || user.email} />
                      <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
        {isMenuOpen && (
          <div className="fixed inset-0 top-16 z-50 grid h-[calc(100vh-4rem)] grid-flow-row auto-rows-max overflow-auto p-6 pb-32 shadow-md animate-in md:hidden">
            <div className="relative z-20 grid gap-6 rounded-md bg-popover p-4 text-popover-foreground shadow-md">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2" onClick={closeMenu}>
                  <span className="font-bold">IITM BS Resource Hub</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={closeMenu}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>
              <nav className="grid grid-flow-row auto-rows-max text-sm">
                <Link
                  href="/"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <Home className="h-4 w-4" />
                  Home
                </Link>
                <Link
                  href="/community-resources"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/community-resources") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <FileText className="h-4 w-4" />
                  All Resources
                </Link>
                <Link
                  href="/projects"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/projects") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <Code className="h-4 w-4" />
                  Projects
                </Link>
                <Link
                  href="/chat"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/chat") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <Users className="h-4 w-4" />
                  Chat
                </Link>
                <Link
                  href="/leaderboard"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/leaderboard") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <Award className="h-4 w-4" />
                  Leaderboard
                </Link>
                <Link
                  href="/study-tracker"
                  className={`flex items-center gap-2 p-2 rounded-md ${
                    isActive("/study-tracker") ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={closeMenu}
                >
                  <BookOpen className="h-4 w-4" />
                  Study Tracker
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-2 p-2 rounded-md ${
                      isActive("/admin") ? "bg-accent" : "hover:bg-accent"
                    }`}
                    onClick={closeMenu}
                  >
                    <Shield className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                )}
              </nav>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <ThemeSwitcher />
                  {user ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || ""} alt={user.displayName || user.email} />
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.displayName || "User"}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  ) : (
                    <Button variant="default" size="sm" asChild>
                      <Link href="/login" onClick={closeMenu}>
                        Login
                      </Link>
                    </Button>
                  )}
                </div>
                {user && (
                  <>
                    {isAdmin && (
                      <Link href="/admin" onClick={closeMenu}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
