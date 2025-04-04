require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:8084', 'https://lark-law.com']
}));
app.use(bodyParser.json());

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
      success_url: successUrl || 'http://localhost:8080/dashboard?subscription=success',
      cancel_url: cancelUrl || 'http://localhost:8080/pricing',
    });
    
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook for subscription events
app.post('/api/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
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
      // Here you would update your database with the subscription status
      break;
    case 'customer.subscription.deleted':
      const cancelledSubscription = event.data.object;
      console.log(`Subscription ${cancelledSubscription.id} was cancelled`);
      // Here you would update your database to reflect cancelled subscription
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

// Get subscription status
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

// Start the server
app.listen(port, () => {
  console.log(`LARK API Server running on port ${port}`);
});
