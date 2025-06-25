"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { FaGoogle } from "react-icons/fa"
import { authLogger } from "@/lib/auth-logger"

export function SignInButton({ providerId, providerName }: { providerId: string, providerName: string }) {
  const handleSignIn = async () => {
    try {
      authLogger.signInAttempt(providerId, "/dashboard");
      authLogger.info("User clicked sign-in button", {
        providerId,
        providerName,
        callbackUrl: "/dashboard",
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }, 'SIGNIN_BUTTON');

      const result = await signIn(providerId, { callbackUrl: "/dashboard" });
      
      authLogger.info("Sign-in method called", {
        providerId,
        result,
        timestamp: Date.now()
      }, 'SIGNIN_BUTTON');
    } catch (error) {
      authLogger.error("Sign-in button error", error, 'SIGNIN_BUTTON');
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      className="w-full py-4 text-lg font-bold rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg flex items-center justify-center gap-3 transition-transform transform hover:scale-105 hover:from-blue-600 hover:to-blue-500 focus:ring-4 focus:ring-blue-300 focus:outline-none"
    >
      <span className="bg-white rounded-full p-1 mr-2 flex items-center justify-center"><FaGoogle className="text-blue-500" size={24} /></span>
      Sign in with {providerName}
    </Button>
  )
} 