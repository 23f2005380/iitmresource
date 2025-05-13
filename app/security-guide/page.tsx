"use client"

import { useState } from "react"
import { Shield, Lock, AlertTriangle, CheckCircle, Copy } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SecurityGuidePage() {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white">
      <Navbar />
      <main className="flex-1 container py-8">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Security Guide</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Follow these steps to secure your IITM BS Resource Hub application
          </p>
        </div>

        <Alert variant="destructive" className="mb-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important Security Notice</AlertTitle>
          <AlertDescription>
            Your Firebase project is currently in test mode. This means anyone can read and write to your database.
            Follow the steps below to secure your application.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="firebase" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="firebase" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Firebase Security
            </TabsTrigger>
            <TabsTrigger value="app" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Application Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="firebase">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>1. Secure Firestore Rules</CardTitle>
                  <CardDescription>Replace your current Firestore rules with these secure rules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                      {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read subjects and resources
    match /subjects/{subjectId} {
      allow read: if true;
    }
    
    match /resources/{resourceId} {
      allow read: if true;
    }
    
    match /comments/{commentId} {
      allow read: if true;
    }
    
    // Users collection rules
    match /users/{userId} {
      // Users can only write their own document
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Resources collection rules
    match /resources/{resourceId} {
      // Only authenticated users can create resources
      allow create: if request.auth != null;
      
      // Users can only update/delete their own resources or admin can do it
      allow update, delete: if request.auth != null && 
        (resource.data.createdBy == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Comments collection rules
    match /comments/{commentId} {
      // Only authenticated users can create comments
      allow create: if request.auth != null;
      
      // Users can only delete their own comments or admin can do it
      allow delete: if request.auth != null && 
        (resource.data.createdBy == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Chats collection rules
    match /chats/{chatId} {
      allow read: if true;
      // Only authenticated users can create chat messages
      allow create: if request.auth != null;
      
      // Users can only delete their own messages or admin can do it
      allow delete: if request.auth != null && 
        (resource.data.sender == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
  }
}`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() =>
                        copyToClipboard(
                          `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read subjects and resources
    match /subjects/{subjectId} {
      allow read: if true;
    }
    
    match /resources/{resourceId} {
      allow read: if true;
    }
    
    match /comments/{commentId} {
      allow read: if true;
    }
    
    // Users collection rules
    match /users/{userId} {
      // Users can only write their own document
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Resources collection rules
    match /resources/{resourceId} {
      // Only authenticated users can create resources
      allow create: if request.auth != null;
      
      // Users can only update/delete their own resources or admin can do it
      allow update, delete: if request.auth != null && 
        (resource.data.createdBy == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Comments collection rules
    match /comments/{commentId} {
      // Only authenticated users can create comments
      allow create: if request.auth != null;
      
      // Users can only delete their own comments or admin can do it
      allow delete: if request.auth != null && 
        (resource.data.createdBy == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Chats collection rules
    match /chats/{chatId} {
      allow read: if true;
      // Only authenticated users can create chat messages
      allow create: if request.auth != null;
      
      // Users can only delete their own messages or admin can do it
      allow delete: if request.auth != null && 
        (resource.data.sender == request.auth.token.email || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
  }
}`,
                          "firestore-rules",
                        )
                      }
                    >
                      {copied === "firestore-rules" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">How to apply these rules:</h4>
                    <ol className="list-decimal pl-5 space-y-2 text-sm">
                      <li>Go to your Firebase Console</li>
                      <li>Select your project</li>
                      <li>Navigate to Firestore Database</li>
                      <li>Click on the "Rules" tab</li>
                      <li>Replace the existing rules with the ones above</li>
                      <li>Click "Publish"</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Secure Storage Rules</CardTitle>
                  <CardDescription>Apply these rules to secure your Firebase Storage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                      {`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only authenticated users can read files
    match /{allPaths=**} {
      allow read: if request.auth != null;
    }
    
    // User profile images
    match /users/{userId}/{fileName} {
      // Users can only upload their own profile images
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Resource files
    match /resources/{resourceId}/{fileName} {
      // Only authenticated users can upload resource files
      allow create: if request.auth != null;
      
      // Only the creator or admin can modify or delete files
      allow update, delete: if request.auth != null && 
        (request.resource.metadata.createdBy == request.auth.token.email || 
         request.auth.token.role == 'admin');
    }
  }
}`}
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() =>
                        copyToClipboard(
                          `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only authenticated users can read files
    match /{allPaths=**} {
      allow read: if request.auth != null;
    }
    
    // User profile images
    match /users/{userId}/{fileName} {
      // Users can only upload their own profile images
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Resource files
    match /resources/{resourceId}/{fileName} {
      // Only authenticated users can upload resource files
      allow create: if request.auth != null;
      
      // Only the creator or admin can modify or delete files
      allow update, delete: if request.auth != null && 
        (request.resource.metadata.createdBy == request.auth.token.email || 
         request.auth.token.role == 'admin');
    }
  }
}`,
                          "storage-rules",
                        )
                      }
                    >
                      {copied === "storage-rules" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">How to apply these rules:</h4>
                    <ol className="list-decimal pl-5 space-y-2 text-sm">
                      <li>Go to your Firebase Console</li>
                      <li>Select your project</li>
                      <li>Navigate to Storage</li>
                      <li>Click on the "Rules" tab</li>
                      <li>Replace the existing rules with the ones above</li>
                      <li>Click "Publish"</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Configure Authentication</CardTitle>
                  <CardDescription>Set up proper authentication settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Email/Password Authentication:</h4>
                      <ol className="list-decimal pl-5 space-y-2 text-sm">
                        <li>Go to Firebase Console &rarr; Authentication</li>
                        <li>Under "Sign-in method", enable Email/Password</li>
                        <li>Consider enabling Email verification</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Password Requirements:</h4>
                      <ol className="list-decimal pl-5 space-y-2 text-sm">
                        <li>Set minimum password length to at least 8 characters</li>
                        <li>Require at least one uppercase letter, one lowercase letter, and one number</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Session Management:</h4>
                      <ol className="list-decimal pl-5 space-y-2 text-sm">
                        <li>Set appropriate session timeouts</li>
                        <li>Enable multi-factor authentication for admin accounts</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>4. Restrict API Access</CardTitle>
                  <CardDescription>Secure your Firebase API keys and access</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">API Key Restrictions:</h4>
                      <ol className="list-decimal pl-5 space-y-2 text-sm">
                        <li>Go to Firebase Console</li>
                        <li>Navigate to Project Settings</li>
                        <li>Scroll down to "Your apps" section</li>
                        <li>Click on the "Web API Key" to configure restrictions</li>
                        <li>Add HTTP referrer restrictions to only allow your domain</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Environment Variables:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your Firebase configuration is already using environment variables, which is good practice. Make
                        sure these variables are properly set in your production environment.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="app">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>1. Input Validation</CardTitle>
                  <CardDescription>Implement proper input validation to prevent attacks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Client-Side Validation:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Add validation to all forms to ensure data integrity:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>Validate email format</li>
                        <li>Check for minimum/maximum lengths</li>
                        <li>Sanitize inputs to prevent XSS attacks</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Server-Side Validation:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Always validate data on the server side before storing in the database:
                      </p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          {`// Example server-side validation
const validateResource = (data) => {
  const errors = {};
  
  if (!data.title || data.title.trim().length < 3) {
    errors.title = "Title must be at least 3 characters";
  }
  
  if (!data.description) {
    errors.description = "Description is required";
  }
  
  if (data.type === "youtube" && !data.url.includes("youtube.com")) {
    errors.url = "Invalid YouTube URL";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. Content Security</CardTitle>
                  <CardDescription>Implement measures to secure user-generated content</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Content Sanitization:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Sanitize all user-generated content to prevent XSS attacks:
                      </p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          {`// Install DOMPurify
// npm install dompurify

import DOMPurify from 'dompurify';

// Sanitize content before rendering
const sanitizedContent = DOMPurify.sanitize(userContent);`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">URL Validation:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Validate all URLs before storing or displaying them:
                      </p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          {`const isValidUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (e) {
    return false;
  }
};`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>3. Role-Based Access Control</CardTitle>
                  <CardDescription>Implement proper role-based access control</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">User Roles:</h4>
                      <p className="text-sm text-muted-foreground mb-2">Define clear roles and permissions:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>
                          <strong>Admin:</strong> Full access to all features
                        </li>
                        <li>
                          <strong>Student:</strong> Can create and manage their own content
                        </li>
                        <li>
                          <strong>Guest:</strong> Read-only access
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Access Control Checks:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Implement access control checks in your components:
                      </p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          {`// Example access control hook
const useAccessControl = () => {
  const [user] = useAuthState(auth);
  const [userRole, setUserRole] = useState(null);
  
  useEffect(() => {
    if (user) {
      const fetchUserRole = async () => {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      };
      fetchUserRole();
    }
  }, [user]);
  
  const canEdit = (resourceCreator) => {
    return user && (user.email === resourceCreator || userRole === 'admin');
  };
  
  const isAdmin = () => userRole === 'admin';
  
  return { canEdit, isAdmin };
};`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>4. Regular Security Audits</CardTitle>
                  <CardDescription>Implement a security audit schedule</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Regular Checks:</h4>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>Review Firebase security rules monthly</li>
                        <li>Check for unused or unnecessary permissions</li>
                        <li>Monitor authentication logs for suspicious activity</li>
                        <li>Keep all dependencies updated to patch security vulnerabilities</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Dependency Management:</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Regularly update dependencies to patch security vulnerabilities:
                      </p>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                          {`# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Fix vulnerabilities
npm audit fix`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-center mt-8">
          <Button asChild>
            <a href="/admin">Return to Admin Dashboard</a>
          </Button>
        </div>
      </main>
      <footer className="border-t py-6 bg-sky-50">
        <div className="container flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Built by students, for students. IITM BS Resource Hub.</p>
        </div>
      </footer>
    </div>
  )
}
