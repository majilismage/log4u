import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  message,
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div
        className={`animate-spin rounded-full border-slate-300 dark:border-neutral-600 border-t-sky-500 dark:border-t-sky-400 ${sizeClasses[size]}`}
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {message && <p className="mt-3 text-sm text-slate-500 dark:text-neutral-400">{message}</p>}
    </div>
  );
};

export default LoadingSpinner; 