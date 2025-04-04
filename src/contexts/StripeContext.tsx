import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { SUBSCRIPTION_TIERS } from '../services/stripeService';

// Load Stripe outside of component to avoid recreating it on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Define the context type
interface StripeContextType {
  isLoading: boolean;
  createCheckoutSession: (priceId: string, successUrl?: string, cancelUrl?: string) => Promise<void>;
  subscriptionTier: string | null;
  hasFeature: (featureName: string) => boolean;
}

// Create the context
const StripeContext = createContext<StripeContextType>({
  isLoading: false,
  createCheckoutSession: async () => {},
  subscriptionTier: null,
  hasFeature: () => false,
});

// Define subscription tier types
export type SubscriptionTier = 'basic' | 'standard' | 'premium' | 'enterprise';

// Provider component
export const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);

  // On mount, check if there's a stored subscription
  useEffect(() => {
    // In a real app, you'd fetch the user's subscription from your backend
    // For demo purposes, we'll check local storage
    const storedTier = localStorage.getItem('lark_subscription_tier');
    if (storedTier) {
      setSubscriptionTier(storedTier);
    }
    
    // Also check URL parameters (for demo mode)
    const urlParams = new URLSearchParams(window.location.search);
    const tierParam = urlParams.get('subscription');
    if (tierParam && tierParam !== 'success') {
      setSubscriptionTier(tierParam);
      localStorage.setItem('lark_subscription_tier', tierParam);
    }
  }, []);

  // Function to create a checkout session
  const createCheckoutSession = async (
    priceId: string, 
    successUrl: string = `${window.location.origin}/dashboard?subscription=success`,
    cancelUrl: string = `${window.location.origin}/pricing`
  ) => {
    try {
      setIsLoading(true);
      
      // For development/demo mode
      // Always use the demo mode for now since we're not in production
      // if (process.env.NODE_ENV !== 'production') {
      {
        // Simulate successful checkout
        console.log('[Stripe] Creating demo checkout session for:', priceId);
        
        // Extract tier from priceId (this is just for demo)
        const tier = priceId.includes('basic') ? 'basic' : 
                   priceId.includes('standard') ? 'standard' : 
                   priceId.includes('premium') ? 'premium' : 'basic';
                   
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Set subscription tier
        setSubscriptionTier(tier);
        localStorage.setItem('lark_subscription_tier', tier);
        
        // Redirect to success URL
        console.log('[Stripe] Redirecting to:', successUrl);
        window.location.href = successUrl;
        return;
      }
      
      // For production: Call your backend to create a Checkout Session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId,
          successUrl,
          cancelUrl
        }),
      });
      
      const session = await response.json();
      
      // Redirect to Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        console.error('[Stripe] Stripe object is null');
        return;
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      if (error) {
        console.error('[Stripe] Error redirecting to checkout:', error);
      }
    } catch (error) {
      console.error('[Stripe] Error creating checkout session:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to check if user has a feature
  const hasFeature = (featureName: string): boolean => {
    if (!subscriptionTier) return false;
    
    const tier = SUBSCRIPTION_TIERS[subscriptionTier as keyof typeof SUBSCRIPTION_TIERS];
    if (!tier) return false;
    
    return tier.features.includes(featureName);
  };

  // Return the provider
  return (
    <StripeContext.Provider value={{
      isLoading,
      createCheckoutSession,
      subscriptionTier,
      hasFeature,
    }}>
      {children}
    </StripeContext.Provider>
  );
};

// Create a hook to use the context
export const useStripe = () => useContext(StripeContext);
