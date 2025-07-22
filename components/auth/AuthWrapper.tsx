"use client";

import { useSession, SessionProvider } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect, useRef } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { authLogger } from "@/lib/auth-logger";

interface AuthWrapperProps {
  children: React.ReactNode;
}

// Component for handling protected routes with authentication
const ProtectedRouteWrapper = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const lastStatusRef = useRef<string>('');

  // Track session status for error handling
  useEffect(() => {
    if (lastStatusRef.current !== status) {
      const isLogout = lastStatusRef.current === 'authenticated' && status === 'unauthenticated';
      lastStatusRef.current = status;
      
      // Only log critical auth errors
      if (isLogout) {
        authLogger.sessionChange(status as any, session);
      }
    }
  }, [status, session, pathname]);

  useEffect(() => {
    // If user is unauthenticated, redirect them to sign-in
    if (status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${pathname}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" message="Verifying session..." />
      </div>
    );
  }

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return null;
};

const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const pathname = usePathname();

  // Define public routes that don't require authentication
  const isPublicRoute = pathname.startsWith("/auth") || 
                       pathname === "/contact" || 
                       pathname === "/" ||
                       pathname === "/privacy-policy" ||
                       pathname === "/terms-of-use" ||
                       pathname.startsWith("/.well-known/");

  // Immediately render children for public routes WITHOUT any auth processing
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, wrap with SessionProvider and use ProtectedRouteWrapper
  
  return (
    <SessionProvider>
      <ProtectedRouteWrapper>{children}</ProtectedRouteWrapper>
    </SessionProvider>
  );
};

export default AuthWrapper; 