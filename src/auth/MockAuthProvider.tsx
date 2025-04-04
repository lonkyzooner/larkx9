import React, { createContext, useState, useContext, useEffect } from 'react';
import { SubscriptionTier, UserProfile } from '../contexts/AuthContext';
import { registerUser, loginUser, getCurrentUser, getUserProfile, logoutUser, hasFeatureAccess } from '../services/authService';

// Create a mock auth context type
interface MockAuthContextType {
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

// Create mock user profile for development
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

// Create the mock auth context
const MockAuthContext = createContext<MockAuthContextType>({
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

// Mock auth provider component
export const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(mockUserProfile);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Login function that uses MongoDB authentication
  const login = async () => {
    setIsLoading(true);
    try {
      // For development, we'll use a simplified login with just email
      const result = await loginUser('officer@lark-demo.com');
      
      if (result.success) {
        setIsAuthenticated(true);
        // Convert MongoDB user to UserProfile type
        const userProfile: UserProfile = {
          ...mockUserProfile,
          sub: result.user.id, // Map MongoDB _id to Auth0-style sub
          email: result.user.email,
          name: result.user.name,
          subscriptionTier: (result.user.subscriptionTier as SubscriptionTier) || 'free',
          features: result.user.features || []
        };
        setUser(userProfile);
      } else {
        setError(new Error('Login failed'));
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err : new Error('Unknown login error'));
      
      // Fall back to mock user if MongoDB auth fails
      setIsAuthenticated(true);
      setUser(mockUserProfile);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function that uses our auth service
  const logout = () => {
    setIsLoading(true);
    try {
      logoutUser();
      setIsAuthenticated(false);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
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

  // Check feature access using our auth service
  const hasFeature = (featureName: string): boolean => {
    // First check MongoDB user features
    const hasAccess = hasFeatureAccess(featureName);
    if (hasAccess) return true;
    
    // Fall back to mock user features if needed
    if (!user) return false;
    return user.features.includes(featureName);
  };

  // Mock has subscription tier function
  const hasSubscriptionTier = (minimumTier: SubscriptionTier): boolean => {
    if (!user) return false;
    
    const tierHierarchy: Record<SubscriptionTier, number> = {
      'free': 0,
      'basic': 1,
      'standard': 2,
      'premium': 3,
      'enterprise': 4
    };
    
    const userTierLevel = tierHierarchy[user.subscriptionTier];
    const requiredTierLevel = tierHierarchy[minimumTier];
    
    return userTierLevel >= requiredTierLevel;
  };

  // Refresh user profile from MongoDB
  const refreshUserProfile = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const currentUser = getCurrentUser();
      
      if (currentUser?.id) {
        const userData = await getUserProfile(currentUser.id);
        // Convert MongoDB user to UserProfile type
        const userProfile: UserProfile = {
          ...mockUserProfile, // Keep mock data for fields not in MongoDB
          sub: userData.id, // Map MongoDB _id to Auth0-style sub
          email: userData.email,
          name: userData.name,
          subscriptionTier: (userData.subscriptionTier as SubscriptionTier) || 'free',
          features: userData.features || []
        };
        setUser(userProfile);
      } else {
        // Fall back to mock user if no current user
        setUser(mockUserProfile);
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
      // Fall back to mock user on error
      setUser(mockUserProfile);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const contextValue: MockAuthContextType = {
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

  // Initialize auth on component mount
  useEffect(() => {
    const initAuth = async () => {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setIsAuthenticated(true);
        // Convert MongoDB user to UserProfile type
        const userProfile: UserProfile = {
          ...mockUserProfile,
          sub: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          subscriptionTier: (currentUser.subscriptionTier as SubscriptionTier) || 'free',
          features: currentUser.features || []
        };
        setUser(userProfile);
        
        // Refresh user profile from MongoDB
        refreshUserProfile();
      } else {
        // No stored user, use mock user for development
        setIsAuthenticated(true);
        setUser(mockUserProfile);
      }
    };
    
    initAuth();
  }, []);

  return (
    <MockAuthContext.Provider value={contextValue}>
      {children}
    </MockAuthContext.Provider>
  );
};

// Custom hook to use the mock auth context
export const useMockAuth = () => useContext(MockAuthContext);

// Export the mock auth context
export default MockAuthContext;
