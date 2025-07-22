'use client'

import type React from "react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-border/50">
      <div className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WanderNote. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms-of-use" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Use
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact Us
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
} 