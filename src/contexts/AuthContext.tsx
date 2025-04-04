import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useErrorHandler } from '../hooks/useErrorHandler';

// Define user subscription levels
export type SubscriptionTier = 'free' | 'basic' | 'standard' | 'premium' | 'enterprise';

export interface UserProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
  departmentId?: string;
  badgeNumber?: string;
  role?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive';
  subscriptionExpiry?: Date;
  features: string[];
  apiQuota: {
    total: number;
    used: number;
    reset: Date;
  };
  lastLogin: Date;
  metadata: Record<string, any>;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: Error | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  hasFeature: (featureName: string) => boolean;
  hasSubscriptionTier: (minimumTier: SubscriptionTier) => boolean;
  refreshUserProfile: () => Promise<void>;
}

// Create the auth context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  login: () => {},
  logout: () => {},
  getAccessToken: async () => null,
  updateUserProfile: async () => false,
  hasFeature: () => false,
  hasSubscriptionTier: () => false,
  refreshUserProfile: async () => {},
});

// Subscription tier hierarchy for comparison
const tierHierarchy: Record<SubscriptionTier, number> = {
  'free': 0,
  'basic': 1,
  'standard': 2,
  'premium': 3,
  'enterprise': 4
};

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { handleError } = useErrorHandler();
  
  const {
    isAuthenticated,
    isLoading: auth0Loading,
    user: auth0User,
    error: auth0Error,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently
  } = useAuth0();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Fetch user profile from our backend API
  const fetchUserProfile = useCallback(async () => {
    if (!isAuthenticated || !auth0User) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    try {
      const token = await getAccessTokenSilently();
      
      // Call our backend API to get the full user profile with subscription info
      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const profileData = await response.json();
      
      // Transform API response to UserProfile format
      const userProfile: UserProfile = {
        sub: auth0User.sub || '',
        email: auth0User.email || '',
        name: auth0User.name || '',
        picture: auth0User.picture || '',
        departmentId: profileData.departmentId,
        badgeNumber: profileData.badgeNumber,
        role: profileData.role,
        subscriptionTier: profileData.subscriptionTier || 'free',
        subscriptionStatus: profileData.subscriptionStatus || 'inactive',
        subscriptionExpiry: profileData.subscriptionExpiry ? new Date(profileData.subscriptionExpiry) : undefined,
        features: profileData.features || [],
        apiQuota: profileData.apiQuota || { total: 0, used: 0, reset: new Date() },
        lastLogin: new Date(),
        metadata: profileData.metadata || {}
      };
      
      setUser(userProfile);
    } catch (error) {
      handleError({
        message: `Failed to load user profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'AuthContext',
        recoverable: true
      });
      
      // Set a minimal user profile based on Auth0 data
      if (auth0User) {
        setUser({
          sub: auth0User.sub || '',
          email: auth0User.email || '',
          name: auth0User.name || '',
          picture: auth0User.picture || '',
          subscriptionTier: 'free',
          subscriptionStatus: 'inactive',
          features: [],
          apiQuota: { total: 0, used: 0, reset: new Date() },
          lastLogin: new Date(),
          metadata: {}
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, auth0User, getAccessTokenSilently, handleError]);
  
  // Update user profile in our backend
  const updateUserProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      return false;
    }
    
    try {
      const token = await getAccessTokenSilently();
      
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user profile');
      }
      
      const updatedProfile = await response.json();
      
      // Update local user state
      setUser(prev => prev ? { ...prev, ...updatedProfile } : null);
      
      return true;
    } catch (error) {
      handleError({
        message: `Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'AuthContext',
        recoverable: true
      });
      return false;
    }
  }, [isAuthenticated, user, getAccessTokenSilently, handleError]);
  
  // Check if user has a specific feature
  const hasFeature = useCallback((featureName: string): boolean => {
    if (!user) return false;
    return user.features.includes(featureName);
  }, [user]);
  
  // Check if user has at least the specified subscription tier
  const hasSubscriptionTier = useCallback((minimumTier: SubscriptionTier): boolean => {
    if (!user) return false;
    
    // Only active or trialing subscriptions count
    if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trialing') {
      return false;
    }
    
    const userTierLevel = tierHierarchy[user.subscriptionTier];
    const requiredTierLevel = tierHierarchy[minimumTier];
    
    return userTierLevel >= requiredTierLevel;
  }, [user]);
  
  // Login function
  const login = useCallback(() => {
    console.log('[AuthContext] Initiating Auth0 login, redirecting to:', window.location.origin);
    loginWithRedirect({
      appState: {
        returnTo: window.location.pathname,
        timestamp: new Date().getTime()
      }
    });
  }, [loginWithRedirect]);
  
  // Logout function
  const logout = useCallback(() => {
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }, [auth0Logout]);
  
  // Get access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated) return null;
    
    try {
      return await getAccessTokenSilently();
    } catch (error) {
      handleError({
        message: `Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'AuthContext',
        recoverable: true
      });
      return null;
    }
  }, [isAuthenticated, getAccessTokenSilently, handleError]);
  
  // Refresh user profile
  const refreshUserProfile = useCallback(async (): Promise<void> => {
    await fetchUserProfile();
  }, [fetchUserProfile]);
  
  // Load user profile when authentication state changes
  useEffect(() => {
    if (!auth0Loading) {
      fetchUserProfile();
    }
  }, [auth0Loading, fetchUserProfile]);
  
  // Context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading: auth0Loading || isLoading,
    user,
    error: auth0Error ? new Error(auth0Error.message) : null,
    login,
    logout,
    getAccessToken,
    updateUserProfile,
    hasFeature,
    hasSubscriptionTier,
    refreshUserProfile
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
