require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const connectDB = require('./src/database/connection');

// Import models
const User = require('./src/database/models/User');
const Subscription = require('./src/database/models/Subscription');
const UsageLog = require('./src/database/models/UsageLog');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://livekit-za4hpayr.livekit.cloud"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      imgSrc: ["'self'", "data:", "https://stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Stripe integration
}));

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// More strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 login/register attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again after an hour'
});

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth', authLimiter);

// Special handling for Stripe webhooks (needs raw body)
app.use('/api/webhook', bodyParser.raw({ type: 'application/json' }));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// ===== API ROUTES =====

// Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;
    
    // Create a checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin}/dashboard?subscription=success`,
      cancel_url: cancelUrl || `${req.headers.origin}/pricing`,
    });
    
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// User authentication endpoints

// Register user (simplified for now without proper hashing)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, departmentId, badgeNumber } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const user = new User({
      email,
      name,
      departmentId,
      badgeNumber,
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      features: ['miranda_rights_basic', 'statute_lookup_basic']
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login user (simplified)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email (no password verification in development mode)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        features: user.features
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        departmentId: user.departmentId,
        badgeNumber: user.badgeNumber,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        features: user.features,
        apiQuota: user.apiQuota,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track feature usage
app.post('/api/usage/log', async (req, res) => {
  try {
    const { userId, featureType, details, status } = req.body;
    
    // Create usage log
    const usageLog = new UsageLog({
      userId,
      featureType,
      details,
      status,
      processingTimeMs: req.body.processingTimeMs || 0,
      deviceInfo: req.body.deviceInfo || { deviceType: 'unihiker_m10' }
    });
    
    await usageLog.save();
    
    // Update user's feature usage count in subscription
    if (featureType && status === 'success') {
      await Subscription.findOneAndUpdate(
        { userId },
        { $inc: { [`usage.${featureType}s`]: 1 } },
        { new: true }
      );
    }
    
    res.status(201).json({ success: true, id: usageLog._id });
  } catch (error) {
    console.error('Error logging usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook handler
app.post('/api/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      console.log(`Subscription ${subscription.id} was ${event.type.split('.')[2]}`);
      
      try {
        // Find the user with this Stripe customer ID
        const user = await User.findOne({ stripeCustomerId: subscription.customer });
        
        if (user) {
          // Get product details to determine the tier
          const productId = subscription.items.data[0].price.product;
          const product = await stripe.products.retrieve(productId);
          const tier = product.metadata.tier || 'basic';
          
          // Update the user's subscription info
          user.subscriptionTier = tier;
          user.subscriptionStatus = subscription.status;
          user.subscriptionId = subscription.id;
          user.subscriptionExpiry = new Date(subscription.current_period_end * 1000);
          
          // Update features based on tier
          switch(tier) {
            case 'premium':
              user.features = [
                'miranda_rights_premium', 'statute_lookup_premium', 
                'threat_detection_premium', 'training_premium'
              ];
              break;
            case 'standard':
              user.features = [
                'miranda_rights_standard', 'statute_lookup_standard', 
                'threat_detection_standard', 'training_standard'
              ];
              break;
            case 'basic':
            default:
              user.features = [
                'miranda_rights_basic', 'statute_lookup_basic'
              ];
          }
          
          await user.save();
          
          // Create or update subscription record
          const existingSubscription = await Subscription.findOne({ 
            stripeSubscriptionId: subscription.id 
          });
          
          if (existingSubscription) {
            existingSubscription.status = subscription.status;
            existingSubscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
            existingSubscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            existingSubscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;
            await existingSubscription.save();
          } else {
            // Create new subscription record
            await Subscription.create({
              userId: user._id,
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              tier,
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              features: user.features
            });
          }
          
          console.log(`Updated subscription for user ${user.email}`);
        } else {
          console.log(`No user found with customer ID: ${subscription.customer}`);
        }
      } catch (err) {
        console.error('Error processing subscription webhook:', err);
      }
      break;
      
    case 'customer.subscription.deleted':
      const cancelledSubscription = event.data.object;
      console.log(`Subscription ${cancelledSubscription.id} was cancelled`);
      
      try {
        // Find user and update subscription status
        const user = await User.findOne({ stripeCustomerId: cancelledSubscription.customer });
        
        if (user) {
          user.subscriptionStatus = 'canceled';
          user.subscriptionTier = 'free';
          user.features = ['miranda_rights_basic', 'statute_lookup_basic'];
          await user.save();
          
          // Update subscription record
          await Subscription.findOneAndUpdate(
            { stripeSubscriptionId: cancelledSubscription.id },
            { 
              status: 'canceled',
              cancelAtPeriodEnd: true
            }
          );
          
          console.log(`Updated canceled subscription for user ${user.email}`);
        }
      } catch (err) {
        console.error('Error processing subscription cancellation:', err);
      }
      break;
      
    case 'checkout.session.completed':
      const checkoutSession = event.data.object;
      
      try {
        if (checkoutSession.mode === 'subscription') {
          // Find or create user based on email
          const userEmail = checkoutSession.customer_details.email;
          let user = await User.findOne({ email: userEmail });
          
          if (!user) {
            // Create new user if they don't exist
            user = new User({
              email: userEmail,
              name: checkoutSession.customer_details.name || userEmail.split('@')[0],
              stripeCustomerId: checkoutSession.customer
            });
          } else {
            // Update existing user with Stripe customer ID
            user.stripeCustomerId = checkoutSession.customer;
          }
          
          await user.save();
          console.log(`User ${userEmail} linked to Stripe customer ${checkoutSession.customer}`);
        }
      } catch (err) {
        console.error('Error processing checkout session completion:', err);
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

// Get subscription status by Stripe customer ID
app.get('/api/subscription/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      expand: ['data.default_payment_method'],
    });
    
    if (subscriptions.data.length === 0) {
      return res.json({ active: false });
    }
    
    // Get the subscription details
    const subscription = subscriptions.data[0];
    const product = await stripe.products.retrieve(subscription.items.data[0].price.product);
    
    res.json({
      active: true,
      subscription_id: subscription.id,
      current_period_end: subscription.current_period_end,
      product_name: product.name,
      tier: product.metadata.tier || 'basic',
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscription by user ID (MongoDB)
app.get('/api/subscription/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user in MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find subscription in MongoDB
    const subscription = await Subscription.findOne({ userId });
    
    if (!subscription) {
      return res.json({
        active: false,
        tier: user.subscriptionTier,
        status: user.subscriptionStatus
      });
    }
    
    res.json({
      active: subscription.status === 'active',
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: subscription.features
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
app.post('/api/subscription/:userId/cancel', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user in MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.stripeCustomerId || !user.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    // Cancel subscription in Stripe
    await stripe.subscriptions.update(user.subscriptionId, {
      cancel_at_period_end: true
    });
    
    // Update subscription in MongoDB
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: user.subscriptionId },
      { cancelAtPeriodEnd: true }
    );
    
    res.json({ success: true, message: 'Subscription will be canceled at the end of the billing period' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.patch('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // Only allow specific fields to be updated
    const allowedUpdates = {
      name: updates.name,
      departmentId: updates.departmentId,
      badgeNumber: updates.badgeNumber,
      settings: updates.settings
    };
    
    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key] === undefined) {
        delete allowedUpdates[key];
      }
    });
    
    const user = await User.findByIdAndUpdate(
      userId,
      allowedUpdates,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        departmentId: user.departmentId,
        badgeNumber: user.badgeNumber,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        features: user.features
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get usage statistics
app.get('/api/usage/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get usage logs for the user
    const usageLogs = await UsageLog.find({ userId }).sort({ createdAt: -1 }).limit(100);
    
    // Aggregate usage by feature type
    const usageByFeature = usageLogs.reduce((acc, log) => {
      const featureType = log.featureType;
      if (!acc[featureType]) {
        acc[featureType] = {
          total: 0,
          success: 0,
          failure: 0,
          partial: 0
        };
      }
      
      acc[featureType].total++;
      acc[featureType][log.status]++;
      
      return acc;
    }, {});
    
    // Get recent logs
    const recentLogs = usageLogs.slice(0, 10).map(log => ({
      id: log._id,
      featureType: log.featureType,
      status: log.status,
      createdAt: log.createdAt,
      details: log.details
    }));
    
    res.json({
      success: true,
      usageByFeature,
      recentLogs,
      totalUsage: usageLogs.length
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Connect to MongoDB
connectDB()
  .then(() => {
    // Start the server after successful database connection
    app.listen(PORT, () => {
      console.log(`LARK Server running on port ${PORT}`);
      console.log(`Visit http://localhost:${PORT} to view the application`);
      console.log(`MongoDB connected successfully`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB, starting server anyway:', err);
    // Start server even if DB connection fails
    app.listen(PORT, () => {
      console.log(`LARK Server running on port ${PORT} (without MongoDB)`);
      console.log(`Visit http://localhost:${PORT} to view the application`);
    });
  });
