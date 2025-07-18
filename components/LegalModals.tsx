"use client"

import React, { useState, useEffect, Suspense } from "react"
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

// ------------------------------
// Privacy Policy Components
// ------------------------------

function PrivacyPolicyText() {
  return (
    <>
      <p>
        3 G International Supplies LLC (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy
        and is committed to protecting the personal information you share with us
        through WanderNote.
      </p>
      <h3 className="text-xl font-semibold mt-6 mb-3">1. Information We Access</h3>
      <p>
        WanderNote integrates with your Google account to help you store and manage
        your travel logs and associated media. We request access to the following
        Google services:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Google Drive</strong> (
          <Link
            href="https://www.googleapis.com/auth/drive.file"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            https://www.googleapis.com/auth/drive.file
          </Link>
          )<br />
          We access and manage only those files and folders you create or open using
          WanderNote. This access is used to upload, organize, and retrieve media
          files such as images or documents tied to your travel logs.
        </li>
        <li>
          <strong>Google Sheets</strong> (
          <Link
            href="https://www.googleapis.com/auth/spreadsheets"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            https://www.googleapis.com/auth/spreadsheets
          </Link>
          )<br />
          We use this access to read from and write to a travel log spreadsheet that
          stores your journey details and metadata.
        </li>
      </ul>
      <p>
        We do not access or view your entire Google Drive or any files not created with
        or opened by the app.
      </p>
      <h3 className="text-xl font-semibold mt-6 mb-3">2. Data Storage and Handling</h3>
      <p>
        WanderNote does not store your files or content. All media and logs are saved
        directly in your Google Drive and Sheets.
      </p>
      <p>
        We do not collect or retain the content of your travel logs or media.
      </p>
      <p>
        Minimal metadata (such as user preferences or app-related settings) may be
        stored securely in our servers to enhance your experience.
      </p>
      <p>All data transmissions are encrypted using HTTPS.</p>
      <h3 className="text-xl font-semibold mt-6 mb-3">3. Data Sharing</h3>
      <p>
        We do not sell your data or share personal content with third parties. Limited
        anonymized data may be used for:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Service analytics (e.g., crash reports, usage metrics)</li>
        <li>Improving app functionality</li>
        <li>
          Optional advertising-related metrics (only if applicable and disclosed
          separately)
        </li>
      </ul>
      <h3 className="text-xl font-semibold mt-6 mb-3">4. Use of Google User Data</h3>
      <p>
        Use and transfer of Google user data to any other app will adhere to:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Google API Services User Data Policy:{" "}
          <Link
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            https://developers.google.com/terms/api-services-user-data-policy
          </Link>
        </li>
        <li>
          Limited Use requirements: We only use your Google data to provide
          WanderNote's core functionality.
        </li>
      </ul>
      <h3 className="text-xl font-semibold mt-6 mb-3">5. User Consent and Control</h3>
      <p>
        You may revoke access to WanderNote at any time via your Google Account
        settings:{" "}
        <Link
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          https://myaccount.google.com/permissions
        </Link>
      </p>
      <h3 className="text-xl font-semibold mt-6 mb-3">6. Contact Us</h3>
      <p>
        If you have any questions or concerns about this Privacy Policy or your data,
        please contact:
      </p>
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

function PrivacyPolicyModalContent() {
  const [isOpen, setIsOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(searchParams.get("modal") === "privacy-policy")
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
    router.push(`${pathname}?modal=privacy-policy`, { scroll: false })
  }

  return (
    <>
      <button
        onClick={handleTriggerClick}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Privacy Policy
      </button>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pr-12">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              WanderNote Privacy Policy
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Effective Date: 12 June 2025
            </p>
          </DialogHeader>
          <div className="prose prose-quoteless prose-neutral dark:prose-invert max-w-none flex-grow overflow-y-auto pr-6">
            <PrivacyPolicyText />
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

export function PrivacyPolicyModal() {
  return (
    <Suspense fallback={
      <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Privacy Policy
      </button>
    }>
      <PrivacyPolicyModalContent />
    </Suspense>
  )
}

// ------------------------------
// Terms of Use Components
// ------------------------------

function TermsOfUseText() {
  const router = useRouter()
  const pathname = usePathname()

  const handlePrivacyPolicyClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
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

function TermsOfUseModalContent() {
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

export function TermsOfUseModal() {
  return (
    <Suspense fallback={
      <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        Terms of Use
      </button>
    }>
      <TermsOfUseModalContent />
    </Suspense>
  )
} 