"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import { collection, getDocs, doc, updateDoc, query, orderBy, limit, startAfter } from "firebase/firestore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Search, User, UserCog, Users } from "lucide-react"
import debounce from "lodash.debounce"

import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminCheck } from "@/hooks/use-admin-check"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AppUser {
  id: string
  uid: string
  email: string
  displayName: string
  role: string
  photoURL?: string | null
  createdAt?: any
}

const USERS_PER_PAGE = 10

export default function ManageUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
  const [newRole, setNewRole] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastVisible, setLastVisible] = useState<any>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)

  const { isAdmin, loading: adminLoading } = useAdminCheck()
  const router = useRouter()
  const { toast } = useToast()

  // Fetch users
  useEffect(() => {
    if (!isAdmin && !adminLoading) {
      return
    }

    const fetchUsers = async () => {
      try {
        setLoading(true)
        const usersQuery = query(collection(db, "users"), orderBy("email"), limit(USERS_PER_PAGE))
        const usersSnapshot = await getDocs(usersQuery)

        if (usersSnapshot.empty) {
          setUsers([])
          setFilteredUsers([])
          setHasMore(false)
        } else {
          const usersList = usersSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as AppUser[]

          setUsers(usersList)
          setFilteredUsers(usersList)
          setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1])
          setHasMore(usersSnapshot.docs.length === USERS_PER_PAGE)
        }
        setLoading(false)
      } catch (error) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchUsers()
    }
  }, [isAdmin, adminLoading, toast])

  // Load more users
  const loadMoreUsers = async () => {
    if (loadingMore || !lastVisible) return

    setLoadingMore(true)
    try {
      const usersQuery = query(
        collection(db, "users"),
        orderBy("email"),
        startAfter(lastVisible),
        limit(USERS_PER_PAGE),
      )
      const usersSnapshot = await getDocs(usersQuery)

      if (usersSnapshot.empty) {
        setHasMore(false)
      } else {
        const newUsers = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AppUser[]

        setUsers((prev) => [...prev, ...newUsers])
        setFilteredUsers((prev) => [...prev, ...newUsers])
        setLastVisible(usersSnapshot.docs[usersSnapshot.docs.length - 1])
        setHasMore(usersSnapshot.docs.length === USERS_PER_PAGE)
        setPage((prev) => prev + 1)
      }
    } catch (error) {
      console.error("Error loading more users:", error)
      toast({
        title: "Error",
        description: "Failed to load more users",
        variant: "destructive",
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // Previous page
  const previousPage = () => {
    if (page > 1) {
      // This is a simplified approach - in a real app, you'd need to store previous page data
      // or implement a more sophisticated pagination system
      setPage((prev) => prev - 1)
      // For now, we'll just reload the first page
      router.refresh()
    }
  }

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string, role: string) => {
      if (!users.length) return

      let filtered = [...users]

      // Apply search filter
      if (query.trim()) {
        const searchTerm = query.toLowerCase()
        filtered = filtered.filter(
          (user) =>
            user.email.toLowerCase().includes(searchTerm) ||
            (user.displayName && user.displayName.toLowerCase().includes(searchTerm)),
        )
      }

      // Apply role filter
      if (role !== "all") {
        filtered = filtered.filter((user) => user.role === role)
      }

      setFilteredUsers(filtered)
      setIsSearching(false)
    }, 300),
    [users],
  )

  // Handle search input change
  useEffect(() => {
    setIsSearching(true)
    debouncedSearch(searchQuery, roleFilter)
  }, [searchQuery, roleFilter, debouncedSearch])

  // Handle role update
  const handleRoleUpdate = async () => {
    if (!selectedUser || !newRole) return

    setIsUpdating(true)
    try {
      const userRef = doc(db, "users", selectedUser.id)
      await updateDoc(userRef, { role: newRole })

      // Update local state
      const updatedUsers = users.map((user) => (user.id === selectedUser.id ? { ...user, role: newRole } : user))
      setUsers(updatedUsers)
      setFilteredUsers(filteredUsers.map((user) => (user.id === selectedUser.id ? { ...user, role: newRole } : user)))

      toast({
        title: "Role updated",
        description: `${selectedUser.displayName || selectedUser.email}'s role has been updated to ${newRole}`,
      })

      setSelectedUser(null)
      setNewRole("")
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Format timestamp
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown"
    try {
      const date = timestamp.toDate()
      return date.toLocaleDateString()
    } catch (error) {
      return "Unknown"
    }
  }

  if (adminLoading) {
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
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="pl-0 hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Manage Users</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">View and manage user accounts and roles</p>
        </div>

        <Card className="hover-card-animation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Users
            </CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-sky-50/50 dark:bg-sky-900/20">
                <h3 className="text-lg font-medium mb-2">No users found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || roleFilter !== "all" ? "Try different search terms or filters" : "No users available"}
                </p>
                {(searchQuery || roleFilter !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("")
                      setRoleFilter("all")
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">User</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                        <th className="text-left p-3 font-medium">Role</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">Joined</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {user.photoURL ? (
                                  <AvatarImage
                                    src={user.photoURL || "/placeholder.svg"}
                                    alt={user.displayName || "User"}
                                  />
                                ) : (
                                  <AvatarFallback className="bg-primary text-primary-foreground">
                                    {getInitials(user.displayName || user.email)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span className="font-medium">{user.displayName || "User"}</span>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-muted-foreground">{user.email}</span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={
                                user.role === "admin"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                  : user.role === "moderator"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              }
                            >
                              {user.role}
                            </Badge>
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setNewRole(user.role)
                              }}
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Edit Role
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={previousPage}
                    disabled={page === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} {hasMore ? "" : "(end)"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreUsers}
                    disabled={!hasMore || loadingMore}
                    className="flex items-center gap-1"
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Role Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.displayName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="role">Role</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleRoleUpdate} disabled={isUpdating || newRole === selectedUser?.role}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <User className="h-4 w-4 mr-2" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface LabelProps {
  htmlFor?: string
  children: React.ReactNode
}

function Label({ htmlFor, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block"
    >
      {children}
    </label>
  )
}
