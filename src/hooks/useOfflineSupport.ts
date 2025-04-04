import { useState, useEffect, useCallback } from 'react';

export interface OfflineState {
  isOnline: boolean;
  lastOnline: number | null;
  lastOffline: number | null;
  pendingActions: PendingAction[];
}

export interface PendingAction {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Custom hook for handling offline support
 * 
 * @returns Offline support utilities
 */
export function useOfflineSupport() {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    lastOnline: navigator.onLine ? Date.now() : null,
    lastOffline: navigator.onLine ? null : Date.now(),
    pendingActions: []
  });

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOnline: true,
        lastOnline: Date.now()
      }));
      
      // Process pending actions when coming back online
      processPendingActions();
    };

    const handleOffline = () => {
      setOfflineState(prev => ({
        ...prev,
        isOnline: false,
        lastOffline: Date.now()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending actions from localStorage on mount
  useEffect(() => {
    try {
      const storedActions = localStorage.getItem('lark_pending_actions');
      if (storedActions) {
        const actions = JSON.parse(storedActions) as PendingAction[];
        setOfflineState(prev => ({
          ...prev,
          pendingActions: actions
        }));
      }
    } catch (error) {
      console.error('[OfflineSupport] Error loading pending actions:', error);
    }
  }, []);

  // Save pending actions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('lark_pending_actions', JSON.stringify(offlineState.pendingActions));
    } catch (error) {
      console.error('[OfflineSupport] Error saving pending actions:', error);
    }
  }, [offlineState.pendingActions]);

  /**
   * Add a pending action to be processed when online
   */
  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'createdAt'>) => {
    const newAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    setOfflineState(prev => ({
      ...prev,
      pendingActions: [...prev.pendingActions, newAction]
    }));

    return newAction.id;
  }, []);

  /**
   * Remove a pending action
   */
  const removePendingAction = useCallback((actionId: string) => {
    setOfflineState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(action => action.id !== actionId)
    }));
  }, []);

  /**
   * Process all pending actions
   */
  const processPendingActions = useCallback(async () => {
    if (!offlineState.isOnline || offlineState.pendingActions.length === 0) {
      return;
    }

    // Sort actions by priority and creation time
    const sortedActions = [...offlineState.pendingActions].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.createdAt - b.createdAt;
    });

    // Process each action
    for (const action of sortedActions) {
      try {
        // Dispatch the action based on its type
        await processAction(action);
        
        // Remove the action after successful processing
        removePendingAction(action.id);
      } catch (error) {
        console.error(`[OfflineSupport] Error processing action ${action.id}:`, error);
        // Keep the action in the queue for retry
      }
    }
  }, [offlineState.isOnline, offlineState.pendingActions, removePendingAction]);

  /**
   * Process a single action
   */
  const processAction = async (action: PendingAction): Promise<void> => {
    // This is where you would implement the logic to process different action types
    // For example, sending API requests that were queued while offline
    
    console.log(`[OfflineSupport] Processing action: ${action.type}`);
    
    switch (action.type) {
      case 'message':
        // Example: Send a message that was created while offline
        await sendOfflineMessage(action.payload);
        break;
        
      case 'log':
        // Example: Send logs that were collected while offline
        await sendOfflineLogs(action.payload);
        break;
        
      default:
        console.warn(`[OfflineSupport] Unknown action type: ${action.type}`);
    }
  };

  /**
   * Example function to send a message that was created while offline
   */
  const sendOfflineMessage = async (payload: any): Promise<void> => {
    // Implementation would depend on your API
    console.log('[OfflineSupport] Sending offline message:', payload);
    // await api.sendMessage(payload);
  };

  /**
   * Example function to send logs that were collected while offline
   */
  const sendOfflineLogs = async (payload: any): Promise<void> => {
    // Implementation would depend on your API
    console.log('[OfflineSupport] Sending offline logs:', payload);
    // await api.sendLogs(payload);
  };

  return {
    isOnline: offlineState.isOnline,
    lastOnline: offlineState.lastOnline,
    lastOffline: offlineState.lastOffline,
    pendingActions: offlineState.pendingActions,
    addPendingAction,
    removePendingAction,
    processPendingActions
  };
}
