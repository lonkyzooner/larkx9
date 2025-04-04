const express = require('express');
const router = express.Router();
const { auth } = require('express-oauth2-jwt-bearer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const NodeCache = require('node-cache');

// Cache for subscription plans (1 hour TTL)
const plansCache = new NodeCache({ stdTTL: 3600 });

// Configure Auth0 middleware
const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

// Helper to get Stripe customer ID for a user
const getStripeCustomerId = async (userId) => {
  // This would normally query your database to get the Stripe customer ID
  // For now, we'll create a new customer if one doesn't exist
  
  try {
    // Mock database lookup
    const mockCustomerId = `cus_mock_${userId.replace('|', '_')}`;
    
    // In a real implementation, you would check if the customer exists in your database
    // If not, create a new customer in Stripe and store the ID
    
    return mockCustomerId;
  } catch (error) {
    console.error('Error getting Stripe customer ID:', error);
    throw error;
  }
};

// Define subscription plans
const getSubscriptionPlans = async () => {
  // Check cache first
  const cachedPlans = plansCache.get('subscription_plans');
  if (cachedPlans) {
    return cachedPlans;
  }
  
  // In a real implementation, you would fetch these from Stripe
  // For now, we'll use mock data
  const plans = [
    {
      id: 'price_basic_monthly',
      name: 'Basic',
      description: 'Essential features for individual officers',
      features: [
        'Voice control',
        'Miranda rights delivery',
        'Basic statute lookup',
        '500 API calls per month'
      ],
      price: 9.99,
      interval: 'month',
      tier: 'basic',
      apiQuota: 500,
      trialDays: 14
    },
    {
      id: 'price_standard_monthly',
      name: 'Standard',
      description: 'Complete feature set for active duty officers',
      features: [
        'All Basic features',
        'Threat detection',
        'Advanced statute lookup',
        'Multilingual support',
        '1,000 API calls per month'
      ],
      price: 19.99,
      interval: 'month',
      tier: 'standard',
      apiQuota: 1000,
      trialDays: 14
    },
    {
      id: 'price_premium_monthly',
      name: 'Premium',
      description: 'Advanced features for specialized units',
      features: [
        'All Standard features',
        'Real-time tactical feedback',
        'Advanced threat detection',
        'Training mode',
        'Unlimited API calls'
      ],
      price: 39.99,
      interval: 'month',
      tier: 'premium',
      apiQuota: 5000,
      trialDays: 14
    },
    {
      id: 'price_enterprise_yearly',
      name: 'Enterprise',
      description: 'Custom solution for departments',
      features: [
        'All Premium features',
        'Custom integration',
        'Department-wide analytics',
        'Dedicated support',
        'Custom hardware options',
        'Unlimited everything'
      ],
      price: 499.99,
      interval: 'year',
      tier: 'enterprise',
      apiQuota: -1, // Unlimited
      metadata: {
        contactSales: true
      }
    }
  ];
  
  // Cache the plans
  plansCache.set('subscription_plans', plans);
  
  return plans;
};

// Routes
// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await getSubscriptionPlans();
    res.json(plans);
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// Get current subscription
router.get('/current', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would fetch the subscription from Stripe
    // For now, we'll use mock data
    const mockSubscription = {
      status: 'active',
      plan: (await getSubscriptionPlans())[1], // Standard plan
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    };
    
    res.json(mockSubscription);
  } catch (error) {
    console.error('Error getting current subscription:', error);
    res.status(500).json({ error: 'Failed to get current subscription' });
  }
});

// Create checkout session
router.post('/create-checkout-session', jwtCheck, async (req, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.auth.payload.sub;
    
    // Get customer ID
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would create a checkout session with Stripe
    // For now, we'll return a mock session ID
    const mockSessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;
    
    res.json({ sessionId: mockSessionId });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create customer portal session
router.post('/create-portal-session', jwtCheck, async (req, res) => {
  try {
    const { returnUrl } = req.body;
    const userId = req.auth.payload.sub;
    
    // Get customer ID
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would create a portal session with Stripe
    // For now, we'll return a mock URL
    const mockPortalUrl = `${returnUrl}?session_id=cs_test_${Math.random().toString(36).substring(2, 15)}`;
    
    res.json({ url: mockPortalUrl });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Cancel subscription
router.post('/cancel', jwtCheck, async (req, res) => {
  try {
    const { atPeriodEnd } = req.body;
    const userId = req.auth.payload.sub;
    
    // Get customer ID
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would cancel the subscription with Stripe
    // For now, we'll return success
    
    res.json({ success: true, canceledAt: atPeriodEnd ? 'period_end' : 'now' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Update subscription
router.post('/update', jwtCheck, async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.auth.payload.sub;
    
    // Get customer ID
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would update the subscription with Stripe
    // For now, we'll return success
    
    res.json({ success: true, updatedPlanId: planId });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Get usage data
router.get('/usage', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    
    // In a real implementation, you would fetch usage data from your database
    // For now, we'll use mock data
    const mockUsage = {
      used: 150,
      total: 1000,
      resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    res.json(mockUsage);
  } catch (error) {
    console.error('Error getting usage data:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// Get invoice history
router.get('/invoices', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    
    // Get customer ID
    const customerId = await getStripeCustomerId(userId);
    
    // In a real implementation, you would fetch invoices from Stripe
    // For now, we'll use mock data
    const mockInvoices = [
      {
        id: 'in_mock_1',
        amount_paid: 1999,
        currency: 'usd',
        status: 'paid',
        created: Date.now() - 30 * 24 * 60 * 60 * 1000,
        period_start: Date.now() - 30 * 24 * 60 * 60 * 1000,
        period_end: Date.now(),
        lines: {
          data: [
            {
              description: 'Standard Plan',
              amount: 1999,
              period: {
                start: Date.now() - 30 * 24 * 60 * 60 * 1000,
                end: Date.now()
              }
            }
          ]
        }
      },
      {
        id: 'in_mock_2',
        amount_paid: 1999,
        currency: 'usd',
        status: 'paid',
        created: Date.now() - 60 * 24 * 60 * 60 * 1000,
        period_start: Date.now() - 60 * 24 * 60 * 60 * 1000,
        period_end: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lines: {
          data: [
            {
              description: 'Standard Plan',
              amount: 1999,
              period: {
                start: Date.now() - 60 * 24 * 60 * 60 * 1000,
                end: Date.now() - 30 * 24 * 60 * 60 * 1000
              }
            }
          ]
        }
      }
    ];
    
    res.json(mockInvoices);
  } catch (error) {
    console.error('Error getting invoice history:', error);
    res.status(500).json({ error: 'Failed to get invoice history' });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    // In a real implementation, you would verify and process the webhook
    // For now, we'll just acknowledge receipt
    
    console.log('Received Stripe webhook');
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router;
