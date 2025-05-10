"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Book, Home, LogIn, LogOut, Menu, Trophy, User, X, Clock } from "lucide-react"
import { signOut } from "firebase/auth"
import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { auth, db } from "@/app/firebase"
import { useToast } from "@/components/ui/use-toast"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Navbar() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user)

      if (user) {
        try {
          // Check if user is admin by fetching their document from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists() && userDoc.data().role === "admin") {
            setIsAdmin(true)
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

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      toast({
        title: "Signed out successfully",
        variant: "default",
      })
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: <Home className="h-4 w-4" />,
      active: pathname === "/",
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: <Trophy className="h-4 w-4" />,
      active: pathname === "/leaderboard",
    },
    {
      href: "/study-tracker",
      label: "Study Tracker",
      icon: <Clock className="h-4 w-4" />,
      active: pathname === "/study-tracker",
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Admin",
            icon: <User className="h-4 w-4" />,
            active: pathname.startsWith("/admin"),
          },
          {
            href: "/admin/review",
            label: "Review",
            icon: <User className="h-4 w-4" />,
            active: pathname.startsWith("/admin/review"),
          },
        ]
      : []),
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Book className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl md:text-2xl font-serif tracking-tight">IITM Resource Hub</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                item.active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-1">
                {item.icon}
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <ThemeSwitcher />

          {!loading && (
            <>
              {user ? (
                <div className="hidden md:flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="transition-all duration-300 hover:bg-primary hover:text-white"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Link href="/login" className="hidden md:block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="transition-all duration-300 hover:bg-primary hover:text-white"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </Link>
              )}
            </>
          )}

          {/* Mobile Menu - Only visible on small screens */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px] sm:w-[300px]">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <Link href="/" className="flex items-center space-x-2" onClick={() => setIsOpen(false)}>
                    <Book className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg font-serif">IITM Resource Hub</span>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <nav className="flex flex-col space-y-4 mb-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors ${
                        item.active
                          ? "bg-muted text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>

                {!loading && user && (
                  <div className="mt-auto border-t pt-4">
                    <div className="text-sm text-muted-foreground mb-2 truncate">{user.email}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSignOut()
                        setIsOpen(false)
                      }}
                      className="w-full transition-all duration-300 hover:bg-primary hover:text-white"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                )}

                {!loading && !user && (
                  <div className="mt-auto border-t pt-4">
                    <Link href="/login" onClick={() => setIsOpen(false)} className="w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full transition-all duration-300 hover:bg-primary hover:text-white"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
