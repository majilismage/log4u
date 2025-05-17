"use client"

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
}

interface LoadingContextType {
  loadingState: LoadingState;
  setLoading: (state: boolean, message?: string) => void;
  setProgress: (progress: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: '',
    progress: undefined,
  });

  const setLoading = useCallback((state: boolean, message: string = '') => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: state,
      message: message,
      progress: state ? prev.progress : undefined,
    }));
  }, [setLoadingState]);

  const setProgress = useCallback((progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
    }));
  }, [setLoadingState]);

  const contextValue = useMemo(() => ({
    loadingState,
    setLoading,
    setProgress,
  }), [loadingState, setLoading, setProgress]);

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
} 