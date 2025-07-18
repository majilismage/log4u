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
import Image from "next/image"
import { authLogger } from "@/lib/auth-logger"


export default function SignInPage() {
  const [providers, setProviders] = useState<Record<
    LiteralUnion<BuiltInProviderType>,
    ClientSafeProvider
  > | null>(null)

  useEffect(() => {
    // Check for logout debug info
    const logoutDebug = sessionStorage.getItem('logout-debug');
    if (logoutDebug) {
      try {
        const debugData = JSON.parse(logoutDebug);
        authLogger.info("Sign-in page visited after logout", {
          userAgent: navigator.userAgent,
          url: window.location.href,
          referrer: document.referrer,
          logoutDebugData: debugData,
          timeSinceLogout: Date.now() - debugData.startTime,
          timestamp: Date.now()
        }, 'SIGNIN_PAGE');
        
        // Clear the debug data
        sessionStorage.removeItem('logout-debug');
        
        console.log("Logout debug info found:", debugData);
      } catch (error) {
        console.warn("Failed to parse logout debug data:", error);
      }
    } else {
      // Log signin page visit normally
      authLogger.info("Sign-in page visited", {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: Date.now()
      }, 'SIGNIN_PAGE');
    }

    const fetchProviders = async () => {
      authLogger.info("Fetching OAuth providers", {
        timestamp: Date.now()
      }, 'SIGNIN_PAGE');

      const res = await getProviders()
      
      authLogger.info("OAuth providers fetched", {
        providerCount: res ? Object.keys(res).length : 0,
        providerNames: res ? Object.values(res).map(p => p.name) : [],
        timestamp: Date.now()
      }, 'SIGNIN_PAGE');

      setProviders(res)
    }
    fetchProviders()
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background Scene */}
      <div className="absolute inset-0 h-screen bg-gradient-to-b from-sky-300 via-sky-200 to-amber-100 dark:from-sky-500 dark:via-sky-400 dark:to-amber-700">
        {/* Sun */}
        <div className="absolute top-16 right-16 w-20 h-20 md:w-24 md:h-24">
          <div className="w-full h-full bg-yellow-400 dark:bg-yellow-300 rounded-full shadow-lg animate-pulse">
            <div className="absolute inset-0 bg-yellow-300 dark:bg-yellow-200 rounded-full animate-ping opacity-20"></div>
          </div>
        </div>

        {/* Flying Plane */}
        <div className="absolute top-24 -left-20 opacity-80 dark:opacity-60">
          <div className="plane animate-fly-plane">
            <div className="text-4xl">✈️</div>
          </div>
        </div>

        {/* Ocean */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 sm:h-1/3 bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-900 dark:to-blue-700">
          <div className="absolute inset-0 opacity-30">
            <div className="wave wave-1"></div>
            <div className="wave wave-2"></div>
            <div className="wave wave-3"></div>
          </div>
        </div>

        {/* Sailboat */}
        <div className="absolute bottom-8 sm:bottom-16 right-0 opacity-80 dark:opacity-60">
          <div className="sailboat animate-sail-across">
            <div className="text-6xl sm:text-8xl">⛵</div>
          </div>
        </div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border-0 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center mb-2">
              <Image
                src="/wandernote-logo.png"
                alt="WanderNote Logo"
                width={80}
                height={80}
                className="rounded-xl shadow-lg"
              />
            </div>
            
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 dark:from-blue-400 dark:to-teal-400 bg-clip-text text-transparent">
              Welcome to WanderNote
            </CardTitle>
          
                <CardDescription className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                A modern day, digital travel log.
                <br />
               <span className="font-semibold text-blue-600 dark:text-blue-400">Capture every adventure.</span>
               
             </CardDescription>

          </CardHeader>

          <CardContent className="space-y-4">
            {providers &&
              Object.values(providers).map((provider) => (
                <div key={provider.name}>
                  <SignInButton providerId={provider.id} providerName={provider.name} />
                </div>
              ))}
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-green-600 dark:text-green-400">🔒</span>
                <span className="font-semibold text-green-800 dark:text-green-300">Your Data Stays Safe</span>
              </div>
              <p className="text-green-700 dark:text-green-400">
                Everything is stored securely in your own Google Drive. We never see or store your personal information.
              </p>
            </div>

            <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
              Start your journey in seconds • No downloads required • Works everywhere
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`

        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }
        
        @keyframes sail-across-mobile {
          0% { transform: translateX(50px) translateY(0px) rotate(0deg); }
          25% { transform: translateX(-25vw) translateY(-3px) rotate(1deg); }
          50% { transform: translateX(-50vw) translateY(-6px) rotate(-1deg); }
          75% { transform: translateX(-75vw) translateY(-3px) rotate(1deg); }
          100% { transform: translateX(calc(-100vw - 150px)) translateY(0px) rotate(0deg); }
        }
        
        @keyframes sail-across-desktop {
          0% { transform: translateX(100px) translateY(0px) rotate(0deg); }
          25% { transform: translateX(-25vw) translateY(-6px) rotate(1deg); }
          50% { transform: translateX(-50vw) translateY(-12px) rotate(-1deg); }
          75% { transform: translateX(-75vw) translateY(-6px) rotate(1deg); }
          100% { transform: translateX(calc(-100vw - 200px)) translateY(0px) rotate(0deg); }
        }
        
        @keyframes wave {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(20px) translateY(-10px); }
        }
        

        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-sail-across { animation: sail-across-mobile 45s linear infinite; }
        .animate-fly-plane { animation: fly-plane 30s linear infinite 20s; }
        
        @media (min-width: 640px) {
          .animate-sail-across { animation: sail-across-desktop 45s linear infinite; }
        }
        
        .wave {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: wave 3s ease-in-out infinite;
        }
        
        .wave-2 { animation-delay: 1s; }
        .wave-3 { animation-delay: 2s; }
      `}</style>
    </div>
  )
} 