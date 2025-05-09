import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "@/styles/typography.css"
import { ThemeProvider } from "@/components/theme-provider"
import { FloatingChat } from "@/components/floating-chat"
import { NotificationSystem } from "@/components/notification-system"
import FloatingNotificationButton from "@/components/floating-notification-button"
import { PageTransition } from "@/components/page-transition"
import { Navbar } from "@/components/navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "IITM BS Resource Hub",
  description: "Share and discover resources for IITM BS courses",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PageTransition>
            <Navbar />
            {children}
            <FloatingNotificationButton />
            <FloatingChat />
          </PageTransition>
        </ThemeProvider>
        {/* Notification system */}
        <NotificationSystem />
      </body>
    </html>
  )
}
