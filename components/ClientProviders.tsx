'use client';

import type React from 'react';
import { LoadingProvider } from '@/lib/LoadingContext';
import { UnitsProvider } from '@/lib/UnitsContext';
import { ProcessingModal } from '@/components/ProcessingModal';
import AuthWrapper from '@/components/auth/AuthWrapper';
import { Footer } from '@/components/Footer';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LoadingProvider>
        <UnitsProvider>
          <div className="flex-grow">
            <AuthWrapper>{children}</AuthWrapper>
          </div>
          <ProcessingModal />
        </UnitsProvider>
      </LoadingProvider>
      <Footer />
    </>
  );
} 