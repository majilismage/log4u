"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FaExclamationTriangle, FaShieldAlt } from "react-icons/fa"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  
  const isAccessDenied = error === 'AccessDenied'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center text-4xl text-red-500">
            {isAccessDenied ? <FaShieldAlt /> : <FaExclamationTriangle />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {isAccessDenied ? "Permissions Required" : "Authentication Error"}
          </CardTitle>
          <CardDescription>
            {isAccessDenied ? (
              <>
                To use WanderNote, you must grant access to Google Sheets and Google Drive. 
                These permissions are essential for saving your travel logs and uploading photos.
              </>
            ) : (
              <>
                An error occurred during the authentication process. This can happen if you
                did not grant the necessary permissions.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {isAccessDenied && (
            <div className="w-full rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Required Permissions:</h4>
              <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <li>• <strong>Google Sheets:</strong> Save your travel log entries</li>
                <li>• <strong>Google Drive:</strong> Store your travel photos and videos</li>
              </ul>
            </div>
          )}
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            {isAccessDenied 
              ? "Please try signing in again and make sure to grant both permissions when prompted."
              : "Please try signing in again."
            }
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/signin">Return to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  )
} 