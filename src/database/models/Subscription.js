const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubscriptionSchema = new Schema({
  // Link to user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Stripe information
  stripeCustomerId: {
    type: String,
    required: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true
  },
  stripePriceId: {
    type: String,
    required: true
  },
  
  // Subscription details
  tier: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing', 'incomplete', 'incomplete_expired'],
    required: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  
  // Payment details
  paymentMethod: {
    type: String
  },
  latestInvoice: {
    type: String
  },
  amount: {
    type: Number
  },
  currency: {
    type: String,
    default: 'usd'
  },
  
  // Feature access
  features: {
    type: [String],
    default: []
  },
  
  // Usage metrics 
  // These are specific to LARK's law enforcement features
  usage: {
    mirandaRightsDeliveries: {
      type: Number,
      default: 0
    },
    statuteLookups: {
      type: Number,
      default: 0
    },
    threatDetections: {
      type: Number, 
      default: 0
    },
    voiceCommandsProcessed: {
      type: Number,
      default: 0
    },
    trainingSessionsCompleted: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
