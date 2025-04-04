/**
 * Environment Variable Service
 * 
 * This service provides secure access to environment variables and configuration
 * with proper fallbacks and validation.
 */

// Environment variable configuration with validation and defaults
interface EnvConfig {
  // API URLs
  API_URL: string;
  LIVEKIT_URL: string;
  
  // Stripe configuration
  STRIPE_PUBLISHABLE_KEY: string;
  
  // Application settings
  APP_VERSION: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

// Get environment variables with validation
export function getEnv(): EnvConfig {
  // Get environment from Vite
  const env = import.meta.env;
  
  // Validate required environment variables
  const requiredVars = [
    'VITE_API_URL',
    'VITE_LIVEKIT_URL',
    'VITE_STRIPE_PUBLISHABLE_KEY'
  ];
  
  // In production, throw errors for missing required variables
  if (env.PROD) {
    for (const varName of requiredVars) {
      if (!env[varName]) {
        console.error(`Missing required environment variable: ${varName}`);
        // In production, we'll log the error but use fallbacks
        // This prevents the app from crashing but logs the issue
      }
    }
  }
  
  // Return environment config with fallbacks
  return {
    API_URL: env.VITE_API_URL || 'http://localhost:3000/api',
    LIVEKIT_URL: env.VITE_LIVEKIT_URL || 'wss://lark-za4hpayr.livekit.cloud',
    STRIPE_PUBLISHABLE_KEY: env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
    APP_VERSION: env.VITE_APP_VERSION || '1.0.0',
    NODE_ENV: env.MODE as 'development' | 'production' | 'test'
  };
}

// Check if we're in development mode
export const isDevelopment = (): boolean => {
  return getEnv().NODE_ENV === 'development';
};

// Check if we're in production mode
export const isProduction = (): boolean => {
  return getEnv().NODE_ENV === 'production';
};

// Check if we're in test mode
export const isTest = (): boolean => {
  return getEnv().NODE_ENV === 'test';
};
