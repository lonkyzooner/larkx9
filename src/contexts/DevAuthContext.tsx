import React, { createContext, useContext, useState } from 'react';

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

// Create a mock user profile for development
const mockUserProfile: UserProfile = {
  sub: 'mock-user-123',
  email: 'officer@lark-demo.com',
  name: 'Demo Officer',
  picture: 'https://i.pravatar.cc/150?u=officer@lark-demo.com',
  departmentId: 'LAPD-12345',
  badgeNumber: 'B-9876',
  role: 'patrol',
  subscriptionTier: 'premium', // Give full access in development
  subscriptionStatus: 'active',
  subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  features: [
    'voice_control', 
    'threat_detection', 
    'miranda_rights', 
    'statute_lookup',
    'tactical_feedback',
    'training_mode'
  ],
  apiQuota: {
    total: 5000,
    used: 150,
    reset: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  lastLogin: new Date(),
  metadata: {
    preferredVoice: 'ash',
    uiTheme: 'dark',
    deviceId: 'UniHiker-M10-98765'
  }
};

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

// Create the auth context with default values
const DevAuthContext = createContext<AuthContextType>({
  isAuthenticated: true,
  isLoading: false,
  user: mockUserProfile,
  error: null,
  login: () => {},
  logout: () => {},
  getAccessToken: async () => 'mock-token-123',
  updateUserProfile: async () => true,
  hasFeature: () => true,
  hasSubscriptionTier: () => true,
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

// Auth provider component for development
export const DevAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(mockUserProfile);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Mock login function
  const login = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setUser(mockUserProfile);
      setIsLoading(false);
    }, 500);
  };

  // Mock logout function
  const logout = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
    }, 500);
  };

  // Mock get access token function
  const getAccessToken = async (): Promise<string | null> => {
    return 'mock-token-123';
  };

  // Mock update user profile function
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
    return true;
  };

  // Mock has feature function
  const hasFeature = (featureName: string): boolean => {
    if (!user) return false;
    return user.features.includes(featureName);
  };

  // Mock has subscription tier function
  const hasSubscriptionTier = (minimumTier: SubscriptionTier): boolean => {
    if (!user) return false;
    
    const userTierLevel = tierHierarchy[user.subscriptionTier];
    const requiredTierLevel = tierHierarchy[minimumTier];
    
    return userTierLevel >= requiredTierLevel;
  };

  // Mock refresh user profile function
  const refreshUserProfile = async (): Promise<void> => {
    setIsLoading(true);
    setTimeout(() => {
      setUser(mockUserProfile);
      setIsLoading(false);
    }, 500);
  };

  // Context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    getAccessToken,
    updateUserProfile,
    hasFeature,
    hasSubscriptionTier,
    refreshUserProfile
  };

  return (
    <DevAuthContext.Provider value={contextValue}>
      {children}
    </DevAuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(DevAuthContext);

export default DevAuthContext;
