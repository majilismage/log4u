"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { X } from "lucide-react"

function TermsOfUseText() {
  const router = useRouter()
  const pathname = usePathname()

  const handlePrivacyPolicyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    // This will close the current modal via its onOpenChange handler
    // and the other modal's useEffect will pick up the new URL to open itself.
    router.push(`${pathname}?modal=privacy-policy`, { scroll: false })
  }

  return (
    <>
      <p>
        These Terms of Use (&quot;Terms&quot;) govern your access to and use of WanderNote,
        a service provided by 3 G International Supplies LLC (&quot;we&quot;, &quot;our&quot;, or
        &quot;us&quot;). By accessing or using WanderNote, you agree to these Terms.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">1. Overview of the Service</h3>
      <p>
        WanderNote is a digital travel log application that enables users to record
        journey details and associated media. It integrates with Google services to store:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Travel log data in Google Sheets</li>
        <li>Media assets in Google Drive</li>
      </ul>
      <p>Your data remains stored in your Google account and is not retained by us.</p>

      <h3 className="text-xl font-semibold mt-6 mb-3">2. Eligibility and Account Access</h3>
      <p>
        You must be at least 13 years old (or the minimum age required in your
        jurisdiction) to use WanderNote. You are responsible for maintaining the
        confidentiality of your Google account and for all activities associated with it.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">3. Use of Google Services</h3>
      <p>
        By using WanderNote, you authorize us to access your Google Drive and Google
        Sheets with your permission via OAuth. We access only:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Files and folders created or opened with WanderNote</li>
        <li>Travel log spreadsheets managed through the app</li>
      </ul>
      <p>
        Use of these services is subject to Google's terms:{" "}
        <Link
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Google Terms of Service
        </Link>
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">4. User Content</h3>
      <p>
        All data, including media and text logs, created through WanderNote is stored in
        your Google account. You retain full ownership of your content.
      </p>
      <p>
        We do not claim ownership, but you grant us a limited license to access and
        process your data solely to deliver core functionality.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">5. Prohibited Uses</h3>
      <p>You agree not to:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Use the service for unlawful, harmful, or abusive activities</li>
        <li>Attempt to interfere with or disrupt the service</li>
        <li>Misuse any features to gain unauthorized access to other users&apos; data</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">6. Service Availability</h3>
      <p>
        WanderNote is provided &quot;as is&quot; and &quot;as available&quot;. We may modify,
        suspend, or discontinue any part of the service at any time, without notice.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">7. Limitation of Liability</h3>
      <p>
        To the extent permitted by law, we disclaim all warranties and shall not be
        liable for any direct, indirect, incidental, or consequential damages arising
        from your use of the app.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">8. Termination</h3>
      <p>
        We reserve the right to suspend or terminate access if you violate these Terms.
        You may stop using the service at any time, and revoke access via your Google
        account settings.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">9. Privacy</h3>
      <p>
        Please review our{" "}
        <button
          onClick={handlePrivacyPolicyClick}
          className="text-primary hover:underline p-0 h-auto bg-transparent"
        >
          Privacy Policy
        </button>{" "}
        to understand how we collect and use data.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">10. Modifications</h3>
      <p>
        We may revise these Terms at any time. Continued use after changes are made
        constitutes acceptance of the revised Terms.
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">11. Contact Information</h3>
      <p>For any questions or legal notices, please contact:</p>
      <address className="not-italic">
        3 G International Supplies LLC
        <br />
        10105 E via Linda Suite 103-123
        <br />
        Scottsdale, AZ, 85258
        <br />
        Email:{" "}
        <Link
          href="mailto:mail@3g-international.com"
          className="text-primary hover:underline"
        >
          mail@3g-international.com
        </Link>
        <br />
        Website:{" "}
        <Link
          href="https://wandernote.3g-international.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          https://wandernote.3g-international.com
        </Link>
      </address>
    </>
  )
}

export function TermsOfUseModal() {
  const [isOpen, setIsOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(searchParams.get("modal") === "terms-of-use")
  }, [searchParams])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      router.push(pathname, { scroll: false })
    }
  }

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsOpen(true)
    router.push(`${pathname}?modal=terms-of-use`, { scroll: false })
  }

  return (
    <>
      <button
        onClick={handleTriggerClick}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Terms of Use
      </button>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pr-12">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              WanderNote Terms of Use
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Effective Date: 12 June 2025
            </p>
          </DialogHeader>
          <div className="prose prose-quoteless prose-neutral dark:prose-invert max-w-none flex-grow overflow-y-auto pr-6">
            <TermsOfUseText />
          </div>
          <DialogClose asChild>
            <button
              className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
} 