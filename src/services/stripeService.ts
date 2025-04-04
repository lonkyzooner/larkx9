/**
 * Stripe Service for LARK
 * 
 * This service handles Stripe payment integrations for the LARK application.
 * It provides functionality for creating checkout sessions, managing subscriptions,
 * and handling webhooks.
 */

// Stripe subscription tiers mapped to LARK features
export const SUBSCRIPTION_TIERS = {
  basic: {
    features: [
      'miranda_rights',
      'basic_statutes',
      'voice_activation',
    ],
    apiQuota: 100,
  },
  standard: {
    features: [
      'miranda_rights',
      'advanced_statutes',
      'voice_activation',
      'threat_detection',
      'multilingual',
      'tactical_feedback',
    ],
    apiQuota: 500,
  },
  premium: {
    features: [
      'miranda_rights',
      'advanced_statutes',
      'voice_activation',
      'threat_detection',
      'multilingual',
      'tactical_feedback',
      'training_mode',
      'analytics',
      'department_integrations',
    ],
    apiQuota: 2000,
  },
  enterprise: {
    features: [
      'miranda_rights',
      'advanced_statutes',
      'voice_activation',
      'threat_detection',
      'multilingual',
      'tactical_feedback',
      'training_mode',
      'analytics',
      'department_integrations',
      'custom_solutions',
      'dedicated_support',
    ],
    apiQuota: -1, // Unlimited
  },
};

// Stripe price IDs (replace with your actual Stripe price IDs)
export const STRIPE_PRICE_IDS = {
  basic_monthly: import.meta.env.VITE_STRIPE_PRICE_BASIC_MONTHLY || 'price_basic_monthly',
  standard_monthly: import.meta.env.VITE_STRIPE_PRICE_STANDARD_MONTHLY || 'price_standard_monthly',
  premium_monthly: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_MONTHLY || 'price_premium_monthly',
  enterprise_monthly: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_enterprise_monthly',
  basic_annual: import.meta.env.VITE_STRIPE_PRICE_BASIC_ANNUAL || 'price_basic_annual',
  standard_annual: import.meta.env.VITE_STRIPE_PRICE_STANDARD_ANNUAL || 'price_standard_annual',
  premium_annual: import.meta.env.VITE_STRIPE_PRICE_PREMIUM_ANNUAL || 'price_premium_annual',
  enterprise_annual: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_ANNUAL || 'price_enterprise_annual',
};

import axios from 'axios';
import { getCurrentUser } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Function to create a checkout session with our backend
export async function createCheckoutSession(priceId: string, successUrl: string, cancelUrl: string) {
  try {
    // Get the current user from our auth service
    const user = getCurrentUser();
    
    const response = await axios.post(`${API_URL}/create-checkout-session`, {
      priceId,
      successUrl,
      cancelUrl,
      userId: user?.id, // Include user ID if available
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Get subscription status from MongoDB
export async function getSubscriptionStatus() {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const response = await axios.get(`${API_URL}/user/${user.id}`);
    
    if (response.data.success) {
      return {
        tier: response.data.user.subscriptionTier,
        status: response.data.user.subscriptionStatus,
        features: response.data.user.features,
        expiresAt: response.data.user.subscriptionExpiry
      };
    }
    
    throw new Error('Failed to get subscription status');
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
}

// Utility function to check if a user has access to a feature based on their subscription
export function hasFeatureAccess(userTier: string, featureName: string): boolean {
  const tier = SUBSCRIPTION_TIERS[userTier as keyof typeof SUBSCRIPTION_TIERS];
  if (!tier) return false;
  
  return tier.features.includes(featureName);
}

// Using the user's actual features from database via authService
export function hasUserFeatureAccess(featureName: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  return user.features.includes(featureName);
}

// Utility function to get user's API quota based on subscription
export function getApiQuota(userTier: string): number {
  const tier = SUBSCRIPTION_TIERS[userTier as keyof typeof SUBSCRIPTION_TIERS];
  if (!tier) return 0;
  
  return tier.apiQuota;
}
