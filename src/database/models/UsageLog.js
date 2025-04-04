const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// This model tracks detailed usage of LARK's law enforcement features
const UsageLogSchema = new Schema({
  // Link to user
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Feature used
  featureType: {
    type: String,
    enum: ['miranda_rights', 'statute_lookup', 'threat_detection', 'voice_command', 'training'],
    required: true
  },
  
  // Detailed information about usage
  details: {
    // For Miranda rights
    language: String,  // Language used for Miranda rights delivery
    completed: Boolean, // Whether the full Miranda rights were delivered
    
    // For statute lookups
    statuteCode: String, // Code of statute looked up
    queryText: String,   // The actual query text
    
    // For threat detection
    threatType: String,  // Type of threat detected
    confidence: Number,  // Confidence score of the detection (0-1)
    
    // For voice commands
    commandText: String, // The voice command processed
    successful: Boolean, // Whether command was successfully processed
    
    // For training sessions
    trainingModule: String, // Which training module was used
    completionScore: Number, // Score/performance in training (0-100)
    
    // For any additional metadata
    additionalData: Schema.Types.Mixed
  },
  
  // Device information
  deviceInfo: {
    deviceType: {
      type: String,
      enum: ['unihiker_m10', 'mobile', 'desktop', 'tablet', 'other'],
      default: 'unihiker_m10' // Default to the UniHiker M10 hardware
    },
    osVersion: String,
    appVersion: String,
    batteryLevel: Number,
    connectionType: String
  },
  
  // Location information (if available and permitted)
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    locationName: String
  },
  
  // Timing data
  processingTimeMs: Number, // How long the feature took to process
  
  // Success/failure status
  status: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    required: true
  },
  
  // Error information if applicable
  error: {
    code: String,
    message: String,
    stack: String
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Index for faster queries by user and feature type
UsageLogSchema.index({ userId: 1, featureType: 1, createdAt: -1 });

module.exports = mongoose.model('UsageLog', UsageLogSchema);
