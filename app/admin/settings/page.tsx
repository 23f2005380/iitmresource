"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, SettingsIcon } from "lucide-react"

import { db } from "@/app/firebase"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAdminCheck } from "@/hooks/use-admin-check"

interface SiteSettings {
  siteName: string
  siteDescription: string
  allowRegistration: boolean
  requireEmailVerification: boolean
  maxUploadSizeMB: number
  contactEmail: string
  welcomeMessage: string
  footerText: string
  maintenanceMode: boolean
  maintenanceMessage: string
}

const defaultSettings: SiteSettings = {
  siteName: "IITM BS Resource Hub",
  siteDescription: "A platform for IITM BS in Data Science and Applications students to share learning resources",
  allowRegistration: true,
  requireEmailVerification: false,
  maxUploadSizeMB: 10,
  contactEmail: "admin@iitm.ac.in",
  welcomeMessage: "Welcome to the IITM BS Resource Hub! Share and discover resources with your peers.",
  footerText: "Built by students, for students. IITM BS Resource Hub.",
  maintenanceMode: false,
  maintenanceMessage: "The site is currently undergoing maintenance. Please check back later.",
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const { isAdmin, loading: adminLoading } = useAdminCheck()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "site"))
        if (settingsDoc.exists()) {
          setSettings({ ...defaultSettings, ...settingsDoc.data() } as SiteSettings)
        }
        setLoading(false)
      } catch (error) {
        console.error("Error fetching settings:", error)
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        })
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchSettings()
    }
  }, [isAdmin, toast])

  const handleChange = (field: keyof SiteSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "settings", "site"), settings)
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
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
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Platform Settings</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">Configure global settings for the platform</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading settings...</span>
          </div>
        ) : (
          <Card className="hover-card-animation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                Platform Settings
              </CardTitle>
              <CardDescription>Configure global settings for your platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input
                      id="siteName"
                      value={settings.siteName}
                      onChange={(e) => handleChange("siteName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteDescription">Site Description</Label>
                    <Textarea
                      id="siteDescription"
                      value={settings.siteDescription}
                      onChange={(e) => handleChange("siteDescription", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => handleChange("contactEmail", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="footerText">Footer Text</Label>
                    <Input
                      id="footerText"
                      value={settings.footerText}
                      onChange={(e) => handleChange("footerText", e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="welcomeMessage">Welcome Message</Label>
                    <Textarea
                      id="welcomeMessage"
                      value={settings.welcomeMessage}
                      onChange={(e) => handleChange("welcomeMessage", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      This message will be displayed to users on the homepage
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxUploadSize">Maximum Upload Size (MB)</Label>
                    <Input
                      id="maxUploadSize"
                      type="number"
                      min="1"
                      max="100"
                      value={settings.maxUploadSizeMB}
                      onChange={(e) => handleChange("maxUploadSizeMB", Number(e.target.value))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowRegistration" className="block mb-1">
                        Allow Registration
                      </Label>
                      <p className="text-sm text-muted-foreground">When disabled, new users cannot register</p>
                    </div>
                    <Switch
                      id="allowRegistration"
                      checked={settings.allowRegistration}
                      onCheckedChange={(checked) => handleChange("allowRegistration", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="requireEmailVerification" className="block mb-1">
                        Require Email Verification
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, users must verify their email before accessing the site
                      </p>
                    </div>
                    <Switch
                      id="requireEmailVerification"
                      checked={settings.requireEmailVerification}
                      onCheckedChange={(checked) => handleChange("requireEmailVerification", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="maintenanceMode" className="block mb-1">
                        Maintenance Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, the site will be inaccessible to regular users
                      </p>
                    </div>
                    <Switch
                      id="maintenanceMode"
                      checked={settings.maintenanceMode}
                      onCheckedChange={(checked) => handleChange("maintenanceMode", checked)}
                    />
                  </div>

                  {settings.maintenanceMode && (
                    <div className="space-y-2">
                      <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                      <Textarea
                        id="maintenanceMessage"
                        value={settings.maintenanceMessage}
                        onChange={(e) => handleChange("maintenanceMessage", e.target.value)}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  )
}
