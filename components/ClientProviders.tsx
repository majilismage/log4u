'use client';

import type React from 'react';
import { LoadingProvider } from '@/lib/LoadingContext';
import { ProcessingModal } from '@/components/ProcessingModal';
import AuthWrapper from '@/components/auth/AuthWrapper';
import { Footer } from '@/components/Footer';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LoadingProvider>
        <div className="flex-grow">
          <AuthWrapper>{children}</AuthWrapper>
        </div>
        <ProcessingModal />
      </LoadingProvider>
      <Footer />
    </>
  );
} 