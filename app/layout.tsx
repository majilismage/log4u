import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { LoadingProvider } from "@/lib/LoadingContext"
import { ProcessingModal } from "@/components/ProcessingModal"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Travel Log",
  description: "Track your travel journeys"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LoadingProvider>
            {children}
            <ProcessingModal />
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
