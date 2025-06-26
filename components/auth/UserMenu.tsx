"use client";

import React, { useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { authLogger } from "@/lib/auth-logger";

const UserMenu = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const lastSessionRef = useRef<any>(null);

  // Log session changes in UserMenu
  useEffect(() => {
    if (JSON.stringify(lastSessionRef.current) !== JSON.stringify(session)) {
      authLogger.info("UserMenu session changed", {
        status,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        hasAccessToken: !!(session as any)?.accessToken,
        hasRefreshToken: !!(session as any)?.refreshToken,
        timestamp: Date.now()
      }, 'USER_MENU');
      lastSessionRef.current = session;
    }
  }, [session, status]);

  const handleSignOut = async () => {
    try {
      console.log("handleSignOut function called");
      const logoutStartTime = Date.now();
      
      // Store logout start in sessionStorage for debugging
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('logout-debug', JSON.stringify({
          startTime: logoutStartTime,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Use specialized logout logging
      authLogger.logoutInitiated(session?.user?.id || undefined, 'user_menu');
      authLogger.info("User initiated sign-out", {
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        logoutStartTime,
        timestamp: Date.now()
      }, 'USER_MENU');

      // Perform server-side cleanup first
      authLogger.info("Starting server-side logout cleanup", {
        userId: session?.user?.id,
        timestamp: Date.now()
      }, 'LOGOUT_CLEANUP');

      try {
        const cleanupResponse = await fetch('/api/auth/clear-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (cleanupResponse.ok) {
          authLogger.info("Server-side cleanup completed", {
            userId: session?.user?.id,
            timestamp: Date.now()
          }, 'LOGOUT_CLEANUP');
        } else {
          authLogger.warn("Server-side cleanup failed", {
            status: cleanupResponse.status,
            userId: session?.user?.id,
            timestamp: Date.now()
          }, 'LOGOUT_CLEANUP');
        }
      } catch (error) {
        authLogger.warn("Server-side cleanup request failed", error, 'LOGOUT_CLEANUP');
      }

      // Perform client-side cleanup
      authLogger.info("Starting client-side logout cleanup", {
        userId: session?.user?.id,
        timestamp: Date.now()
      }, 'LOGOUT_CLEANUP');

      // Clear any client-side auth session storage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('auth-session-id');
          authLogger.info("Cleared client auth session storage", {
            timestamp: Date.now()
          }, 'LOGOUT_CLEANUP');
        } catch (error) {
          authLogger.warn("Failed to clear session storage", error, 'LOGOUT_CLEANUP');
        }
      }

      // Call NextAuth signOut WITHOUT redirect first
      authLogger.info("Calling NextAuth signOut (no redirect)", {
        callbackUrl: "/auth/signin",
        timestamp: Date.now()
      }, 'USER_MENU');

      await signOut({ 
        callbackUrl: "/auth/signin",
        redirect: false 
      });

      authLogger.info("NextAuth signOut completed - handling manual redirect", {
        logoutDuration: Date.now() - logoutStartTime,
        timestamp: Date.now()
      }, 'USER_MENU');

      // Give a brief moment for logs to be forwarded to server
      await new Promise(resolve => setTimeout(resolve, 50));

      authLogger.info("Manual redirect to sign-in page", {
        finalLogoutDuration: Date.now() - logoutStartTime,
        timestamp: Date.now()
      }, 'USER_MENU');

      // Manual redirect
      window.location.href = '/auth/signin';

    } catch (error) {
      authLogger.error("Sign-out error", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
        timestamp: Date.now()
      }, 'USER_MENU');
      
      // Even if there's an error, try to redirect manually
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/signin';
      }
    }
  };

  const handleSettingsNavigation = () => {
    authLogger.info("User navigating to settings", {
      userId: session?.user?.id,
      timestamp: Date.now()
    }, 'USER_MENU');
    router.push("/settings");
  };

  if (status === "loading") {
    authLogger.debug("UserMenu showing loading spinner", {
      timestamp: Date.now()
    }, 'USER_MENU');
    return <LoadingSpinner size="sm" />;
  }

  if (status === "unauthenticated" || !session?.user) {
    authLogger.debug("UserMenu rendering null (unauthenticated)", {
      status,
      hasSession: !!session,
      timestamp: Date.now()
    }, 'USER_MENU');
    return null; // Or a sign-in button, but for now we'll render nothing.
  }

  const { user } = session;
  const userInitial = user.name?.charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-neutral-700">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? "User"} />
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSettingsNavigation}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {
          console.log("Sign Out menu item clicked - starting logout process");
          authLogger.info("Sign Out dropdown item clicked", {
            userId: session?.user?.id,
            timestamp: Date.now()
          }, 'USER_MENU');
          handleSignOut();
        }}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu; 