import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LoadingProvider } from "@/lib/LoadingContext"
import { ProcessingModal } from "@/components/ProcessingModal"
import { Providers } from "@/components/providers"
import AuthWrapper from "@/components/auth/AuthWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WanderNote",
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
        <Providers>
          <LoadingProvider>
            <AuthWrapper>{children}</AuthWrapper>
            <ProcessingModal />
          </LoadingProvider>
        </Providers>
      </body>
    </html>
  )
}
