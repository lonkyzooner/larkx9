const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  // Basic user information
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  departmentId: {
    type: String,
    trim: true
  },
  badgeNumber: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['officer', 'supervisor', 'admin', 'dispatch'],
    default: 'officer'
  },
  
  // Authentication information - keeping this simple for now
  // We're currently using development authentication per previous discussion
  passwordHash: {
    type: String
  },
  authToken: {
    type: String
  },
  
  // Subscription information
  subscriptionTier: {
    type: String,
    enum: ['free', 'basic', 'standard', 'premium', 'enterprise'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'past_due', 'canceled', 'trialing', 'inactive'],
    default: 'inactive'
  },
  subscriptionId: {
    type: String
  },
  stripeCustomerId: {
    type: String
  },
  subscriptionExpiry: {
    type: Date
  },
  
  // Features and quotas
  features: {
    type: [String],
    default: []
  },
  apiQuota: {
    total: {
      type: Number,
      default: 0
    },
    used: {
      type: Number,
      default: 0
    },
    reset: {
      type: Date,
      default: Date.now
    }
  },
  
  // Timestamps and metadata
  lastLogin: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  settings: {
    voicePreferences: {
      type: Schema.Types.Mixed,
      default: {
        volume: 80,
        speed: 1.0,
        voice: 'ash' // Default OpenAI "Ash" voice
      }
    },
    uiPreferences: {
      type: Schema.Types.Mixed,
      default: {
        theme: 'dark',
        fontSize: 'medium'
      }
    },
    notificationPreferences: {
      type: Schema.Types.Mixed,
      default: {
        email: true,
        app: true
      }
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Method to check if user has a specific feature
UserSchema.methods.hasFeature = function(featureName) {
  return this.features.includes(featureName);
};

// Method to check if user has required subscription tier or higher
UserSchema.methods.hasSubscriptionTier = function(minimumTier) {
  const tierLevels = {
    'free': 0,
    'basic': 1,
    'standard': 2,
    'premium': 3,
    'enterprise': 4
  };
  
  return tierLevels[this.subscriptionTier] >= tierLevels[minimumTier];
};

module.exports = mongoose.model('User', UserSchema);
