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

  // Log session status changes for protected routes
  useEffect(() => {
    if (lastStatusRef.current !== status) {
      const isLogout = lastStatusRef.current === 'authenticated' && status === 'unauthenticated';
      
      authLogger.sessionChange(status as any, session);
      authLogger.info(`AuthWrapper session status change${isLogout ? ' (LOGOUT DETECTED)' : ''}`, {
        previousStatus: lastStatusRef.current,
        newStatus: status,
        pathname,
        isPublicRoute: false, // This is always false for protected routes
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        isLogout,
        timestamp: Date.now()
      }, 'AUTH_WRAPPER');

      if (isLogout) {
        authLogger.info("User logout detected in AuthWrapper", {
          pathname,
          previousStatus: lastStatusRef.current,
          redirectWillOccur: true,
          timestamp: Date.now()
        }, 'LOGOUT_DETECTED');
      }

      lastStatusRef.current = status;
    }
  }, [status, session, pathname]);

  useEffect(() => {
    authLogger.info("AuthWrapper route evaluation", {
      pathname,
      isPublicRoute: false, // This is always false for protected routes
      status,
      willRedirect: status === "unauthenticated",
      timestamp: Date.now()
    }, 'AUTH_WRAPPER');

    // If user is unauthenticated, redirect them to sign-in
    if (status === "unauthenticated") {
      authLogger.info("Redirecting unauthenticated user to sign-in", {
        currentPath: pathname,
        redirectTo: `/auth/signin?callbackUrl=${pathname}`,
        timestamp: Date.now()
      }, 'AUTH_WRAPPER');
      router.push(`/auth/signin?callbackUrl=${pathname}`);
    }
  }, [status, router, pathname]);

  if (status === "loading") {
    authLogger.debug("Showing loading spinner for auth verification", {
      pathname,
      timestamp: Date.now()
    }, 'AUTH_WRAPPER');
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" message="Verifying session..." />
      </div>
    );
  }

  if (status === "authenticated") {
    authLogger.debug("Rendering authenticated content", {
      pathname,
      userId: session?.user?.id,
      timestamp: Date.now()
    }, 'AUTH_WRAPPER');
    return <>{children}</>;
  }

  authLogger.debug("Rendering null (awaiting auth)", {
    pathname,
    status,
    timestamp: Date.now()
  }, 'AUTH_WRAPPER');
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
    authLogger.debug("Rendering public route - no auth processing", {
      pathname,
      timestamp: Date.now()
    }, 'AUTH_WRAPPER');
    return <>{children}</>;
  }

  // For protected routes, wrap with SessionProvider and use ProtectedRouteWrapper
  authLogger.debug("Rendering protected route - wrapping with SessionProvider", {
    pathname,
    timestamp: Date.now()
  }, 'AUTH_WRAPPER');
  
  return (
    <SessionProvider>
      <ProtectedRouteWrapper>{children}</ProtectedRouteWrapper>
    </SessionProvider>
  );
};

export default AuthWrapper; 