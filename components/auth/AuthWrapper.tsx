"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import React, { useEffect } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Define public routes that don't require authentication
  const isPublicRoute = pathname.startsWith("/auth") || pathname === "/contact" || pathname === "/";

  useEffect(() => {
    // If it's not a public route and user is unauthenticated, redirect them
    if (!isPublicRoute && status === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${pathname}`);
    }
  }, [status, router, pathname, isPublicRoute]);

  // Immediately render children for public routes
  if (isPublicRoute) {
    return <>{children}</>;
  }

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

export default AuthWrapper; 