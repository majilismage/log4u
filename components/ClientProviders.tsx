'use client';

import type React from 'react';
import { LoadingProvider } from '@/lib/LoadingContext';
import { UnitsProvider } from '@/lib/UnitsContext';
import { ProcessingModal } from '@/components/ProcessingModal';
import AuthWrapper from '@/components/auth/AuthWrapper';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useLoading } from '@/lib/LoadingContext';

function LoadingResetOnRouteChange() {
  const pathname = usePathname();
  const { setLoading } = useLoading();
  useEffect(() => {
    // Ensure any stale loading overlay is cleared on navigation
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LoadingProvider>
          <UnitsProvider>
            <div className="flex-grow">
              <AuthWrapper>{children}</AuthWrapper>
            </div>
            <ProcessingModal />
            <LoadingResetOnRouteChange />
          </UnitsProvider>
        </LoadingProvider>
        <Toaster />
      </ThemeProvider>
      <Footer />
    </>
  );
} 
