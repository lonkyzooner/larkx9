// Vercel API endpoint for authentication
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');
require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later'
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  departmentId: String,
  badgeNumber: String,
  subscriptionTier: { 
    type: String, 
    enum: ['free', 'basic', 'standard', 'premium', 'enterprise'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'trial', 'past_due', 'canceled'],
    default: 'inactive'
  },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  features: [String],
  apiQuota: {
    total: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    reset: Date
  },
  lastLogin: Date,
  metadata: {
    preferredVoice: String,
    uiTheme: String,
    deviceId: String
  },
  magicLinkToken: String,
  magicLinkExpiry: Date
});

const User = mongoose.model('User', userSchema);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Email transporter
const transporter = nodemailer.createTransport({
  // Configure your email provider here
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      sub: user._id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Send magic link email
const sendMagicLinkEmail = async (email, token, origin) => {
  const magicLink = `${origin}/login?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Your LARK Login Link',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #003087;">LARK - Law Enforcement Assistance and Response Kit</h2>
        <p>Click the button below to sign in to your LARK account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLink}" style="background-color: #003087; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Sign In to LARK</a>
        </div>
        <p>This link will expire in 15 minutes and can only be used once.</p>
        <p>If you didn't request this link, you can safely ignore this email.</p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
};

// API Routes

// Send magic link
app.post('/api/auth/magic-link', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user with free tier
      user = new User({
        email,
        subscriptionTier: 'free',
        subscriptionStatus: 'inactive',
        features: ['miranda_rights', 'basic_statutes'],
        apiQuota: {
          total: 10,
          used: 0,
          reset: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      await user.save();
    }
    
    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 15); // 15 minutes expiry
    
    // Save token to user
    user.magicLinkToken = token;
    user.magicLinkExpiry = expiry;
    await user.save();
    
    // Get origin from request or use default
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Send magic link email
    await sendMagicLinkEmail(email, token, origin);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Magic link error:', error);
    return res.status(500).json({ success: false, error: 'Failed to send magic link' });
  }
});

// Verify magic link
app.post('/api/auth/verify-magic-link', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }
    
    // Find user with this token
    const user = await User.findOne({ 
      magicLinkToken: token,
      magicLinkExpiry: { $gt: new Date() } // Token not expired
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    
    // Clear the magic link token
    user.magicLinkToken = null;
    user.magicLinkExpiry = null;
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT
    const authToken = generateToken(user);
    
    // Return user info and token
    return res.json({
      success: true,
      token: authToken,
      user: {
        sub: user._id,
        email: user.email,
        name: user.name,
        departmentId: user.departmentId,
        badgeNumber: user.badgeNumber,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        features: user.features,
        apiQuota: user.apiQuota,
        lastLogin: user.lastLogin,
        metadata: user.metadata
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify token' });
  }
});

// Validate JWT token
app.get('/api/auth/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user
    const user = await User.findById(decoded.sub);
    
    if (!user) {
      return res.status(401).json({ valid: false, error: 'User not found' });
    }
    
    // Return user info
    return res.json({
      valid: true,
      user: {
        sub: user._id,
        email: user.email,
        name: user.name,
        departmentId: user.departmentId,
        badgeNumber: user.badgeNumber,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        features: user.features,
        apiQuota: user.apiQuota,
        lastLogin: user.lastLogin,
        metadata: user.metadata
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Update user profile
app.patch('/api/user/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user
    const user = await User.findById(decoded.sub);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    // Update allowed fields
    const allowedFields = ['name', 'departmentId', 'badgeNumber', 'metadata'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'metadata') {
          user.metadata = { ...user.metadata, ...req.body.metadata };
        } else {
          user[field] = req.body[field];
        }
      }
    }
    
    await user.save();
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Create Stripe Checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl, userId } = req.body;
    
    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Price ID, success URL, and cancel URL are required' 
      });
    }
    
    // Find user if userId is provided
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    
    // Create or retrieve Stripe customer
    let customerId;
    if (user && user.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user ? user.email : null,
        metadata: {
          userId: userId || 'anonymous'
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user if available
      if (user) {
        user.stripeCustomerId = customerId;
        await user.save();
      }
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });
    
    return res.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create checkout session' 
    });
  }
});

// Stripe webhook handler
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      // Get customer and subscription details
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      
      // Get subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;
      
      // Map price ID to subscription tier
      let subscriptionTier = 'basic';
      let features = ['miranda_rights', 'basic_statutes', 'voice_activation'];
      let apiQuota = 100;
      
      // Map price IDs to tiers (replace with your actual price IDs)
      if (priceId === process.env.STRIPE_PRICE_STANDARD_MONTHLY || 
          priceId === process.env.STRIPE_PRICE_STANDARD_ANNUAL) {
        subscriptionTier = 'standard';
        features = [
          'miranda_rights',
          'advanced_statutes',
          'voice_activation',
          'threat_detection',
          'multilingual',
          'tactical_feedback',
        ];
        apiQuota = 500;
      } else if (priceId === process.env.STRIPE_PRICE_PREMIUM_MONTHLY || 
                priceId === process.env.STRIPE_PRICE_PREMIUM_ANNUAL) {
        subscriptionTier = 'premium';
        features = [
          'miranda_rights',
          'advanced_statutes',
          'voice_activation',
          'threat_detection',
          'multilingual',
          'tactical_feedback',
          'training_mode',
          'analytics',
          'department_integrations',
        ];
        apiQuota = 2000;
      } else if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 
                priceId === process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL) {
        subscriptionTier = 'enterprise';
        features = [
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
        ];
        apiQuota = -1; // Unlimited
      }
      
      // Find user by Stripe customer ID
      const user = await User.findOne({ stripeCustomerId: customerId });
      
      if (user) {
        // Update user subscription details
        user.subscriptionTier = subscriptionTier;
        user.subscriptionStatus = 'active';
        user.stripeSubscriptionId = subscriptionId;
        user.features = features;
        user.apiQuota.total = apiQuota;
        user.apiQuota.reset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Reset in 30 days
        
        await user.save();
      }
      
      break;
    }
    
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;
      
      // Find user by Stripe customer ID
      const user = await User.findOne({ stripeCustomerId: customerId });
      
      if (user) {
        // Update subscription status
        user.subscriptionStatus = status === 'active' ? 'active' : 
                                 status === 'trialing' ? 'trial' : 
                                 status === 'past_due' ? 'past_due' : 'inactive';
        
        await user.save();
      }
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Find user by Stripe customer ID
      const user = await User.findOne({ stripeCustomerId: customerId });
      
      if (user) {
        // Downgrade to free tier
        user.subscriptionTier = 'free';
        user.subscriptionStatus = 'canceled';
        user.features = ['miranda_rights', 'basic_statutes'];
        user.apiQuota.total = 10;
        
        await user.save();
      }
      
      break;
    }
  }
  
  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

// LiveKit token generation endpoint
app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, userId } = req.body;
    
    if (!roomName || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Room name and user ID are required' 
      });
    }
    
    // Get LiveKit credentials from environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'LiveKit credentials not configured' 
      });
    }
    
    // Create LiveKit access token
    const { AccessToken } = require('livekit-server-sdk');
    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: 24 * 60 * 60, // 24 hours
    });
    
    // Add grants to the token
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    
    // Generate the token string
    const jwt = token.toJwt();
    
    return res.json({ 
      success: true, 
      token: jwt 
    });
  } catch (error) {
    console.error('LiveKit token error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate LiveKit token' 
    });
  }
});

// Export for Vercel serverless functions
module.exports = app;
