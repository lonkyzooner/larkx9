/**
 * Database Service for LARK
 * 
 * This service provides a clean interface for interacting with the MongoDB database
 * through our backend API. It handles user data, subscriptions, and usage tracking.
 */

import axios from 'axios';
import { getCurrentUser } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// User-related database operations
export const userDb = {
  // Get current user's usage statistics
  getUsageStats: async () => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not authenticated');
      
      const response = await axios.get(`${API_URL}/usage/stats/${user.id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return null;
    }
  },
  
  // Update user profile information
  updateProfile: async (updates: {
    name?: string;
    departmentId?: string;
    badgeNumber?: string;
    settings?: any;
  }) => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not authenticated');
      
      const response = await axios.patch(`${API_URL}/user/${user.id}`, updates);
      return response.data.success;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }
};

// Feature usage tracking
export const featureDb = {
  // Log Miranda rights usage
  logMirandaUsage: async (language: string, completed: boolean) => {
    try {
      const user = getCurrentUser();
      if (!user) return false;
      
      await axios.post(`${API_URL}/usage/log`, {
        userId: user.id,
        featureType: 'miranda_rights',
        details: {
          language,
          completed
        },
        status: completed ? 'success' : 'partial',
        deviceInfo: {
          deviceType: 'unihiker_m10',
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging Miranda usage:', error);
      return false;
    }
  },
  
  // Log statute lookup usage
  logStatuteLookup: async (statuteCode: string, queryText: string) => {
    try {
      const user = getCurrentUser();
      if (!user) return false;
      
      await axios.post(`${API_URL}/usage/log`, {
        userId: user.id,
        featureType: 'statute_lookup',
        details: {
          statuteCode,
          queryText
        },
        status: 'success',
        deviceInfo: {
          deviceType: 'unihiker_m10',
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging statute lookup:', error);
      return false;
    }
  },
  
  // Log threat detection usage
  logThreatDetection: async (threatType: string, confidence: number) => {
    try {
      const user = getCurrentUser();
      if (!user) return false;
      
      await axios.post(`${API_URL}/usage/log`, {
        userId: user.id,
        featureType: 'threat_detection',
        details: {
          threatType,
          confidence
        },
        status: confidence > 0.7 ? 'success' : 'partial',
        deviceInfo: {
          deviceType: 'unihiker_m10',
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging threat detection:', error);
      return false;
    }
  },
  
  // Log voice command usage
  logVoiceCommand: async (commandText: string, successful: boolean) => {
    try {
      const user = getCurrentUser();
      if (!user) return false;
      
      await axios.post(`${API_URL}/usage/log`, {
        userId: user.id,
        featureType: 'voice_command',
        details: {
          commandText,
          successful
        },
        status: successful ? 'success' : 'failure',
        deviceInfo: {
          deviceType: 'unihiker_m10',
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error logging voice command:', error);
      return false;
    }
  }
};

// Subscription-related operations
export const subscriptionDb = {
  // Get current subscription details
  getCurrentSubscription: async () => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not authenticated');
      
      const response = await axios.get(`${API_URL}/subscription/${user.id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  },
  
  // Cancel subscription
  cancelSubscription: async () => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('User not authenticated');
      
      const response = await axios.post(`${API_URL}/subscription/${user.id}/cancel`);
      return response.data.success;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return false;
    }
  }
};
