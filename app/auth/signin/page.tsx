"use client"

import { getProviders, LiteralUnion, ClientSafeProvider } from "next-auth/react"
import { BuiltInProviderType } from "next-auth/providers/index"
import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignInButton } from "@/components/auth/SignInButton"
import { FaCompass } from "react-icons/fa"

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<
    LiteralUnion<BuiltInProviderType>,
    ClientSafeProvider
  > | null>(null)

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders()
      setProviders(res)
    }
    fetchProviders()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center text-4xl text-blue-500">
            <FaCompass />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to WanderNote</CardTitle>
          <CardDescription>
            Your personal travel log, powered by your own Google account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers &&
            Object.values(providers).map((provider) => (
              <div key={provider.name}>
                <SignInButton providerId={provider.id} providerName={provider.name} />
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
} 