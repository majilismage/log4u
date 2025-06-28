import Link from "next/link"
import { ArrowLeft } from "lucide-react"

function PrivacyPolicyContent() {
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

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            WanderNote Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: 12 June 2025
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-quoteless prose-neutral dark:prose-invert max-w-none">
          <PrivacyPolicyContent />
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <Link 
              href="/terms-of-use"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Use →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 