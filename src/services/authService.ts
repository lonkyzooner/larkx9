import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface User {
  id: string;
  email: string;
  name: string;
  departmentId?: string;
  badgeNumber?: string;
  role?: string;
  subscriptionTier: string;
  subscriptionStatus?: string;
  features: string[];
  lastLogin?: Date;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  message?: string;
}

// Register a new user
export const registerUser = async (userData: {
  email: string;
  name: string;
  departmentId?: string;
  badgeNumber?: string;
}): Promise<AuthResponse> => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    
    if (response.data.success) {
      // Store user in localStorage
      localStorage.setItem('lark_user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Login user (development mode)
export const loginUser = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email });
    
    if (response.data.success) {
      // Store user in localStorage
      localStorage.setItem('lark_user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Get current user from localStorage
export const getCurrentUser = (): User | null => {
  const userJson = localStorage.getItem('lark_user');
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
    return null;
  }
};

// Get user profile from API
export const getUserProfile = async (userId: string): Promise<User> => {
  try {
    const response = await axios.get(`${API_URL}/user/${userId}`);
    
    if (response.data.success) {
      // Update user in localStorage with latest data
      localStorage.setItem('lark_user', JSON.stringify(response.data.user));
      return response.data.user;
    }
    
    throw new Error('Failed to fetch user profile');
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

// Logout user
export const logoutUser = (): void => {
  localStorage.removeItem('lark_user');
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getCurrentUser();
};

// Check if user has access to a specific feature
export const hasFeatureAccess = (featureName: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  
  return user.features.includes(featureName);
};

// Log feature usage
export const logFeatureUsage = async (
  featureType: 'miranda_rights' | 'statute_lookup' | 'threat_detection' | 'voice_command' | 'training',
  details: any,
  status: 'success' | 'failure' | 'partial'
): Promise<void> => {
  const user = getCurrentUser();
  if (!user) return;
  
  try {
    await axios.post(`${API_URL}/usage/log`, {
      userId: user.id,
      featureType,
      details,
      status,
      processingTimeMs: details.processingTimeMs || 0,
      deviceInfo: {
        deviceType: 'unihiker_m10',
        appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
      }
    });
  } catch (error) {
    console.error('Error logging feature usage:', error);
    // Don't throw - this is a non-critical operation
  }
};
