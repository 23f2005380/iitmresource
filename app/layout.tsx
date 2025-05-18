import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { FloatingNotificationButton } from "@/components/floating-notification-button"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "IITM BS Resource Hub",
  description: "A community-driven platform for IITM BS in Data Science and Applications students",
    generator: 'v0.dev'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <FloatingNotificationButton />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
