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

  // Track session changes for error handling only
  useEffect(() => {
    lastSessionRef.current = session;
  }, [session, status]);

  const handleSignOut = async () => {
    try {
      // Perform server-side cleanup
      try {
        await fetch('/api/auth/clear-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        // Silent cleanup failure
      }

      // Clear client-side storage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('auth-session-id');
        } catch (error) {
          // Silent storage clear failure
        }
      }

      // NextAuth signOut without redirect
      await signOut({ 
        callbackUrl: "/auth/signin",
        redirect: false 
      });

      // Brief pause for cleanup completion
      await new Promise(resolve => setTimeout(resolve, 50));

      // Manual redirect
      window.location.href = '/auth/signin';

    } catch (error) {
      authLogger.error("Sign-out error", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        userId: session?.user?.id,
        timestamp: Date.now()
      }, 'AUTH_ERROR');
      
      // Even if there's an error, try to redirect manually
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/signin';
      }
    }
  };

  const handleSettingsNavigation = () => {
    router.push("/settings");
  };

  if (status === "loading") {
    return <LoadingSpinner size="sm" />;
  }

  if (status === "unauthenticated" || !session?.user) {
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
        <DropdownMenuSeparator />
        <div className="py-2"></div>
        <DropdownMenuItem onSelect={handleSignOut}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu; 