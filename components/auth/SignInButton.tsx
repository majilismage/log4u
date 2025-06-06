"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { FaGoogle } from "react-icons/fa"

export function SignInButton({ providerId, providerName }: { providerId: string, providerName: string }) {
  const handleSignIn = () => {
    signIn(providerId, { callbackUrl: "/" })
  }

  return (
    <Button
      onClick={handleSignIn}
      variant="outline"
      className="w-full"
    >
      <FaGoogle className="mr-2 h-4 w-4" />
      Sign in with {providerName}
    </Button>
  )
} 