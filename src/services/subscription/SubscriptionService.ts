import { loadStripe, Stripe } from '@stripe/stripe-js';
import { useAuth } from '../../contexts/AuthContext';
import { useErrorHandler } from '../../hooks/useErrorHandler';

// Define subscription plan types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  interval: 'month' | 'year';
  tier: 'free' | 'basic' | 'standard' | 'premium' | 'enterprise';
  apiQuota: number;
  trialDays?: number;
  metadata?: Record<string, any>;
}

// Define subscription status types
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive';

// Define subscription event types
export type SubscriptionEvent = 
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'subscription_trial_ending'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'invoice_created';

// Subscription service class
class SubscriptionService {
  private stripePromise: Promise<Stripe | null>;
  private apiBaseUrl: string;
  
  constructor() {
    // Load Stripe with your publishable key
    this.stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    this.apiBaseUrl = '/api/subscription';
  }
  
  /**
   * Get available subscription plans
   */
  public async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/plans`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscription plans');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubscriptionService] Error fetching plans:', error);
      throw error;
    }
  }
  
  /**
   * Get current subscription details
   */
  public async getCurrentSubscription(token: string): Promise<{
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/current`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch current subscription');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubscriptionService] Error fetching current subscription:', error);
      return null;
    }
  }
  
  /**
   * Create a checkout session for a new subscription
   */
  public async createCheckoutSession(
    token: string,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId,
          successUrl,
          cancelUrl
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { sessionId } = await response.json();
      return sessionId;
    } catch (error) {
      console.error('[SubscriptionService] Error creating checkout session:', error);
      throw error;
    }
  }
  
  /**
   * Create a customer portal session for managing subscription
   */
  public async createCustomerPortalSession(
    token: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          returnUrl
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create customer portal session');
      }
      
      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('[SubscriptionService] Error creating portal session:', error);
      throw error;
    }
  }
  
  /**
   * Cancel current subscription
   */
  public async cancelSubscription(token: string, atPeriodEnd: boolean = true): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          atPeriodEnd
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }
      
      return true;
    } catch (error) {
      console.error('[SubscriptionService] Error canceling subscription:', error);
      return false;
    }
  }
  
  /**
   * Update subscription plan
   */
  public async updateSubscription(token: string, newPlanId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: newPlanId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }
      
      return true;
    } catch (error) {
      console.error('[SubscriptionService] Error updating subscription:', error);
      return false;
    }
  }
  
  /**
   * Get subscription usage
   */
  public async getUsage(token: string): Promise<{
    used: number;
    total: number;
    resetDate: string;
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/usage`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubscriptionService] Error fetching usage data:', error);
      throw error;
    }
  }
  
  /**
   * Redirect to Stripe Checkout
   */
  public async redirectToCheckout(sessionId: string): Promise<void> {
    const stripe = await this.stripePromise;
    
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }
    
    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      throw new Error(error.message);
    }
  }
  
  /**
   * Get invoice history
   */
  public async getInvoiceHistory(token: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/invoices`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoice history');
      }
      
      return await response.json();
    } catch (error) {
      console.error('[SubscriptionService] Error fetching invoice history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();

// Custom hook for subscription management
export function useSubscription() {
  const { user, getAccessToken, refreshUserProfile } = useAuth();
  const { handleError } = useErrorHandler();
  
  /**
   * Subscribe to a plan
   */
  const subscribeToPlan = async (planId: string): Promise<boolean> => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Create checkout session
      const sessionId = await subscriptionService.createCheckoutSession(
        token,
        planId,
        `${window.location.origin}/subscription/success`,
        `${window.location.origin}/subscription/canceled`
      );
      
      // Redirect to Stripe Checkout
      await subscriptionService.redirectToCheckout(sessionId);
      
      return true;
    } catch (error) {
      handleError({
        message: `Failed to subscribe to plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return false;
    }
  };
  
  /**
   * Manage subscription
   */
  const manageSubscription = async (): Promise<boolean> => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Create customer portal session
      const url = await subscriptionService.createCustomerPortalSession(
        token,
        `${window.location.origin}/subscription/manage`
      );
      
      // Redirect to customer portal
      window.location.href = url;
      
      return true;
    } catch (error) {
      handleError({
        message: `Failed to manage subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return false;
    }
  };
  
  /**
   * Cancel subscription
   */
  const cancelSubscription = async (): Promise<boolean> => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Cancel subscription
      const success = await subscriptionService.cancelSubscription(token);
      
      if (success) {
        // Refresh user profile to update subscription status
        await refreshUserProfile();
      }
      
      return success;
    } catch (error) {
      handleError({
        message: `Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return false;
    }
  };
  
  /**
   * Get subscription plans
   */
  const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
    try {
      return await subscriptionService.getSubscriptionPlans();
    } catch (error) {
      handleError({
        message: `Failed to get subscription plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return [];
    }
  };
  
  /**
   * Get current subscription
   */
  const getCurrentSubscription = async () => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      return await subscriptionService.getCurrentSubscription(token);
    } catch (error) {
      handleError({
        message: `Failed to get current subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return null;
    }
  };
  
  /**
   * Get usage data
   */
  const getUsageData = async () => {
    try {
      const token = await getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      return await subscriptionService.getUsage(token);
    } catch (error) {
      handleError({
        message: `Failed to get usage data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SubscriptionService',
        recoverable: true
      });
      return { used: 0, total: 0, resetDate: new Date().toISOString() };
    }
  };
  
  return {
    // Current subscription info
    subscriptionTier: user?.subscriptionTier || 'free',
    subscriptionStatus: user?.subscriptionStatus || 'inactive',
    subscriptionExpiry: user?.subscriptionExpiry,
    
    // API quota
    apiQuota: user?.apiQuota,
    
    // Methods
    subscribeToPlan,
    manageSubscription,
    cancelSubscription,
    getSubscriptionPlans,
    getCurrentSubscription,
    getUsageData
  };
}
