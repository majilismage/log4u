'use client';

import type React from 'react';
import { LoadingProvider } from '@/lib/LoadingContext';
import { UnitsProvider } from '@/lib/UnitsContext';
import { ProcessingModal } from '@/components/ProcessingModal';
import AuthWrapper from '@/components/auth/AuthWrapper';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

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
          </UnitsProvider>
        </LoadingProvider>
        <Toaster />
      </ThemeProvider>
      <Footer />
    </>
  );
} 