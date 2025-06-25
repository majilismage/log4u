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
      authLogger.info("User initiated sign-out", {
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        timestamp: Date.now()
      }, 'USER_MENU');

      await signOut({ callbackUrl: "/auth/signin" });

      authLogger.info("Sign-out completed", {
        timestamp: Date.now()
      }, 'USER_MENU');
    } catch (error) {
      authLogger.error("Sign-out error", error, 'USER_MENU');
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
        <DropdownMenuItem onSelect={handleSignOut}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu; 