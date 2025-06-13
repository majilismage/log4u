import type React from "react"
import Link from "next/link"
import { PrivacyPolicyModal, TermsOfUseModal } from "./PrivacyPolicyModal"

export function Footer() {
  return (
    <footer className="w-full bg-background border-t border-border/50">
      <div className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WanderNote. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
            <PrivacyPolicyModal />
            <TermsOfUseModal />
            <span className="text-sm text-muted-foreground">Contact Info</span>
            <span className="text-sm text-muted-foreground">About Us</span>
          </nav>
        </div>
      </div>
    </footer>
  )
} 