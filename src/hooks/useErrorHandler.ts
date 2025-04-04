import { useState, useCallback } from 'react';

export interface ErrorState {
  message: string;
  timestamp: number;
  code?: string;
  recoverable?: boolean;
  source?: string;
}

/**
 * Custom hook for centralized error handling
 * 
 * @param initialError Optional initial error state
 * @returns Error handling utilities
 */
export function useErrorHandler(initialError?: ErrorState | null) {
  const [error, setError] = useState<ErrorState | null>(initialError || null);
  const [errorHistory, setErrorHistory] = useState<ErrorState[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  /**
   * Set a new error
   */
  const handleError = useCallback((errorData: Partial<ErrorState> | string | Error) => {
    let newError: ErrorState;

    if (typeof errorData === 'string') {
      newError = {
        message: errorData,
        timestamp: Date.now(),
        recoverable: true,
        source: 'application'
      };
    } else if (errorData instanceof Error) {
      newError = {
        message: errorData.message,
        timestamp: Date.now(),
        code: (errorData as any).code,
        recoverable: true,
        source: errorData.name
      };
    } else {
      newError = {
        message: errorData.message || 'An unknown error occurred',
        timestamp: Date.now(),
        code: errorData.code,
        recoverable: errorData.recoverable !== false,
        source: errorData.source || 'application'
      };
    }

    setError(newError);
    setErrorHistory(prev => [...prev.slice(-9), newError]);
    
    // Log to console for debugging
    console.error(`[ErrorHandler] ${newError.source || 'App'} error:`, newError.message);
    
    return newError;
  }, []);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Attempt to recover from an error
   */
  const recoverFromError = useCallback(async (recoveryFn?: () => Promise<void>) => {
    if (!error) return;
    
    setIsRecovering(true);
    
    try {
      if (recoveryFn) {
        await recoveryFn();
      }
      clearError();
    } catch (recoveryError) {
      handleError({
        message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
        source: 'recovery',
        recoverable: false
      });
    } finally {
      setIsRecovering(false);
    }
  }, [error, clearError, handleError]);

  return {
    error,
    errorHistory,
    isRecovering,
    handleError,
    clearError,
    recoverFromError
  };
}
