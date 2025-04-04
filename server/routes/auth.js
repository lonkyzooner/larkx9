const express = require('express');
const router = express.Router();
const { auth } = require('express-oauth2-jwt-bearer');
const NodeCache = require('node-cache');
const axios = require('axios');

// Cache for user profiles (30 min TTL)
const userProfileCache = new NodeCache({ stdTTL: 1800 });

// Configure Auth0 middleware
const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

// Auth0 Management API helper
const getManagementApiToken = async () => {
  try {
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
      {
        client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
        client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
        audience: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/`,
        grant_type: 'client_credentials'
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Auth0 management token:', error);
    throw error;
  }
};

// Get user from Auth0 Management API
const getUserFromAuth0 = async (userId) => {
  try {
    const token = await getManagementApiToken();
    
    const response = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting user from Auth0:', error);
    throw error;
  }
};

// Get user metadata from database
const getUserMetadata = async (userId) => {
  // This would normally query your database
  // For now, we'll return mock data
  return {
    departmentId: 'LAPD-12345',
    badgeNumber: 'B-9876',
    role: 'patrol',
    subscriptionTier: 'standard',
    subscriptionStatus: 'active',
    subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    features: ['voice_control', 'threat_detection', 'miranda_rights', 'statute_lookup'],
    apiQuota: {
      total: 1000,
      used: 150,
      reset: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    metadata: {
      preferredVoice: 'ash',
      uiTheme: 'dark',
      deviceId: 'UniHiker-M10-98765'
    }
  };
};

// Routes
// Check if authenticated
router.get('/check', jwtCheck, (req, res) => {
  res.json({ authenticated: true });
});

// Get user profile
router.get('/user/profile', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    
    // Check cache first
    const cachedProfile = userProfileCache.get(userId);
    if (cachedProfile) {
      return res.json(cachedProfile);
    }
    
    // Get user from Auth0
    const auth0User = await getUserFromAuth0(userId);
    
    // Get user metadata from database
    const userMetadata = await getUserMetadata(userId);
    
    // Combine data
    const userProfile = {
      sub: auth0User.user_id,
      email: auth0User.email,
      name: auth0User.name,
      picture: auth0User.picture,
      email_verified: auth0User.email_verified,
      ...userMetadata
    };
    
    // Cache the profile
    userProfileCache.set(userId, userProfile);
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user profile
router.patch('/user/profile', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const updates = req.body;
    
    // Validate updates
    const allowedUpdates = ['departmentId', 'badgeNumber', 'metadata'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    // Update user in database
    // This would normally update your database
    // For now, we'll just return the updates
    
    // Clear cache
    userProfileCache.del(userId);
    
    res.json({
      ...filteredUpdates,
      updated: true
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get user permissions
router.get('/user/permissions', jwtCheck, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    
    // Get user metadata from database
    const userMetadata = await getUserMetadata(userId);
    
    // Extract permissions based on subscription tier and features
    const permissions = {
      canAccessVoiceControl: userMetadata.features.includes('voice_control'),
      canAccessThreatDetection: userMetadata.features.includes('threat_detection'),
      canAccessMirandaRights: userMetadata.features.includes('miranda_rights'),
      canAccessStatuteLookup: userMetadata.features.includes('statute_lookup'),
      maxApiCalls: userMetadata.apiQuota.total,
      remainingApiCalls: userMetadata.apiQuota.total - userMetadata.apiQuota.used
    };
    
    res.json(permissions);
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ error: 'Failed to get user permissions' });
  }
});

module.exports = router;
