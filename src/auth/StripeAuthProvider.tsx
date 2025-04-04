import React, { createContext, useState, useContext, useEffect } from 'react';
import { SubscriptionTier, UserProfile } from '../contexts/AuthContext';
import axios from 'axios';
import { getEnv } from '../services/system/envService';

// Create a Stripe auth context type
interface StripeAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: Error | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  hasFeature: (featureName: string) => boolean;
  hasSubscriptionTier: (minimumTier: SubscriptionTier) => boolean;
  refreshUserProfile: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<boolean>;
  verifyMagicLink: (token: string) => Promise<boolean>;
}

// Initial auth state
const initialState: StripeAuthContextType = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  login: async () => {},
  logout: () => {},
  getAccessToken: async () => null,
  updateUserProfile: async () => false,
  hasFeature: () => false,
  hasSubscriptionTier: () => false,
  refreshUserProfile: async () => {},
  sendMagicLink: async () => false,
  verifyMagicLink: async () => false,
};

// Create the Stripe auth context
const StripeAuthContext = createContext<StripeAuthContextType>(initialState);

// API URL from environment
const API_URL = getEnv().API_URL;

// Stripe auth provider component
export const StripeAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check for token in localStorage
        const savedToken = localStorage.getItem('lark_auth_token');
        if (savedToken) {
          setToken(savedToken);
          await validateToken(savedToken);
        } else {
          // Check URL for magic link token
          const urlParams = new URLSearchParams(window.location.search);
          const magicToken = urlParams.get('token');
          if (magicToken) {
            const valid = await verifyMagicLink(magicToken);
            if (valid) {
              // Clean up URL after successful verification
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }
      } catch (err) {
        console.error('Session validation error:', err);
        setError(err instanceof Error ? err : new Error('Unknown session error'));
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Validate token and fetch user profile
  const validateToken = async (authToken: string): Promise<boolean> => {
    try {
      // Set auth header for the request
      const response = await axios.get(`${API_URL}/auth/validate`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.data.valid) {
        setIsAuthenticated(true);
        setUser(response.data.user);
        return true;
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('lark_auth_token');
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        return false;
      }
    } catch (err) {
      console.error('Token validation error:', err);
      // Clear invalid token
      localStorage.removeItem('lark_auth_token');
      setToken(null);
      setIsAuthenticated(false);
      setUser(null);
      return false;
    }
  };

  // Send a magic link to the user's email
  const sendMagicLink = async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/auth/magic-link`, { email });
      return response.data.success;
    } catch (err) {
      console.error('Error sending magic link:', err);
      setError(err instanceof Error ? err : new Error('Failed to send magic link'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Verify a magic link token
  const verifyMagicLink = async (magicToken: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/auth/verify-magic-link`, { token: magicToken });
      
      if (response.data.success) {
        // Save the JWT token
        const authToken = response.data.token;
        localStorage.setItem('lark_auth_token', authToken);
        setToken(authToken);
        
        // Set authenticated state and user profile
        setIsAuthenticated(true);
        setUser(response.data.user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error verifying magic link:', err);
      setError(err instanceof Error ? err : new Error('Failed to verify magic link'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login function that sends a magic link
  const login = async (email: string): Promise<void> => {
    await sendMagicLink(email);
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('lark_auth_token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
  };

  // Get access token function
  const getAccessToken = async (): Promise<string | null> => {
    return token;
  };

  // Update user profile function
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    try {
      if (!token) return false;
      
      const response = await axios.patch(`${API_URL}/user/profile`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(prev => prev ? { ...prev, ...updates } : null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating profile:', err);
      return false;
    }
  };

  // Check if user has access to a feature
  const hasFeature = (featureName: string): boolean => {
    if (!user) return false;
    return user.features.includes(featureName);
  };

  // Check if user has required subscription tier
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

  // Refresh user profile
  const refreshUserProfile = async (): Promise<void> => {
    if (!token) return;
    
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const contextValue: StripeAuthContextType = {
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
    refreshUserProfile,
    sendMagicLink,
    verifyMagicLink,
  };

  return (
    <StripeAuthContext.Provider value={contextValue}>
      {children}
    </StripeAuthContext.Provider>
  );
};

// Custom hook to use the Stripe auth context
export const useStripeAuth = () => useContext(StripeAuthContext);

export default StripeAuthContext;
