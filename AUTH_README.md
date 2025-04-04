# LARK Authentication & Subscription System

## Overview

This document provides an overview of the authentication and subscription system implemented for the LARK (Law Enforcement Assistance and Response Kit) application. The system uses Auth0 for authentication and Stripe for subscription management.

## Features

- **Secure Authentication**: JWT-based authentication using Auth0
- **Role-Based Access Control**: Different access levels based on user roles
- **Subscription Management**: Tiered subscription plans with different feature sets
- **Usage-Based Billing**: API call quotas based on subscription tier
- **Protected Routes**: Route protection based on authentication and subscription status

## Configuration

### Auth0 Setup

1. Create an Auth0 account at [auth0.com](https://auth0.com)
2. Create a new application in Auth0 dashboard
3. Configure the following settings:
   - Application Type: Single Page Application
   - Allowed Callback URLs: `http://localhost:5173, https://your-production-domain.com`
   - Allowed Logout URLs: `http://localhost:5173, https://your-production-domain.com`
   - Allowed Web Origins: `http://localhost:5173, https://your-production-domain.com`
4. Create an API in Auth0 dashboard
5. Update the `.env` file with your Auth0 credentials:
   ```
   VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
   VITE_AUTH0_CLIENT_ID=your-client-id
   VITE_AUTH0_AUDIENCE=your-api-identifier
   ```

### Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create subscription products and prices in Stripe dashboard
3. Update the `.env` file with your Stripe credentials:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key
   STRIPE_SECRET_KEY=sk_test_your-secret-key
   STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
   ```

## Architecture

### Frontend Components

- **AuthContext**: Provides authentication state and methods throughout the app
- **AuthProviderWrapper**: Integrates Auth0 with our custom auth context
- **ProtectedRoute**: Component for route protection based on auth status
- **LoginForm/RegisterForm**: UI components for authentication
- **SubscriptionPage**: UI for managing subscriptions

### Backend Routes

- **/api/auth/**: Authentication endpoints
- **/api/subscription/**: Subscription management endpoints
- **/api/health**: System health check endpoint

## Subscription Tiers

The LARK application offers the following subscription tiers:

1. **Basic** ($9.99/month)
   - Voice control
   - Miranda rights delivery
   - Basic statute lookup
   - 500 API calls per month

2. **Standard** ($19.99/month)
   - All Basic features
   - Threat detection
   - Advanced statute lookup
   - Multilingual support
   - 1,000 API calls per month

3. **Premium** ($39.99/month)
   - All Standard features
   - Real-time tactical feedback
   - Advanced threat detection
   - Training mode
   - Unlimited API calls

4. **Enterprise** ($499.99/year)
   - All Premium features
   - Custom integration
   - Department-wide analytics
   - Dedicated support
   - Custom hardware options
   - Unlimited everything

## Usage

### Protected Routes

To protect a route based on authentication:

```tsx
<Route path="/protected" element={
  <ProtectedRoute>
    <ProtectedComponent />
  </ProtectedRoute>
} />
```

To protect a route based on subscription tier:

```tsx
<Route path="/premium-feature" element={
  <ProtectedRoute requiredSubscriptionTier="premium">
    <PremiumFeatureComponent />
  </ProtectedRoute>
} />
```

To protect a route based on specific feature access:

```tsx
<Route path="/threat-detection" element={
  <ProtectedRoute requiredFeature="threat_detection">
    <ThreatDetectionComponent />
  </ProtectedRoute>
} />
```

### Authentication Hooks

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { 
    isAuthenticated, 
    user, 
    login, 
    logout, 
    hasFeature,
    hasSubscriptionTier
  } = useAuth();

  // Use authentication state and methods
}
```

### Subscription Hooks

```tsx
import { useSubscription } from '../services/subscription/SubscriptionService';

function MyComponent() {
  const { 
    subscriptionTier,
    subscriptionStatus,
    apiQuota,
    subscribeToPlan,
    manageSubscription,
    cancelSubscription
  } = useSubscription();

  // Use subscription state and methods
}
```

## Security Considerations

- JWT tokens are stored in browser localStorage
- API keys are never exposed to the client
- CORS is configured to restrict access to the API
- Rate limiting is implemented to prevent abuse
- All API requests are authenticated with JWT tokens

## Deployment

When deploying to production:

1. Update the Auth0 configuration with production URLs
2. Update the Stripe webhook endpoint with production URL
3. Set up proper CORS configuration for production domains
4. Configure proper SSL certificates for secure communication
5. Update the `.env` file with production credentials

## Troubleshooting

- **Authentication Issues**: Check Auth0 logs for detailed error information
- **Subscription Issues**: Check Stripe dashboard for payment and subscription status
- **API Access Issues**: Verify JWT token validity and permissions
- **Rate Limiting**: Check API quota usage in user profile
