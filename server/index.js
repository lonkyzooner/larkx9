const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { AccessToken } = require('livekit-server-sdk');
const { promisify } = require('util');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { auth } = require('express-oauth2-jwt-bearer');

// Import route modules
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscription');

// For caching responses
const NodeCache = require('node-cache');
const apiCache = new NodeCache({ stdTTL: 300, checkperiod: 120 }); // 5 minute cache

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Enable response compression
app.use(compression());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://api.openai.com', 'https://api-inference.huggingface.co', 'wss://lark-za4hpayr.livekit.cloud'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some audio APIs
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://lark-app.com', /\.lark-app\.com$/] // Restrict to your domain in production
    : '*', // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Request parsing with size limits to prevent abuse
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging - use combined format in production, dev format in development
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health' // Skip logging health checks
}));

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

// Stricter rate limiting for expensive API calls
const huggingFaceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many AI requests from this IP, please try again later.'
});

// Middleware to add cache headers
const cacheMiddleware = (duration) => (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Cache-Control', `public, max-age=${duration}`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Apply stricter rate limiting to AI model routes
app.use('/api/huggingface/', huggingFaceLimiter);
app.use('/api/openai/', huggingFaceLimiter);

// Serve static files from the React app with caching
app.use(express.static(path.resolve(__dirname, '../dist'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Cache middleware for API responses
const cacheResponse = (req, res, next) => {
  const key = req.originalUrl || req.url;
  const cachedResponse = apiCache.get(key);
  
  if (cachedResponse && process.env.NODE_ENV === 'production') {
    console.log(`[Cache] Serving cached response for ${key}`);
    return res.send(cachedResponse);
  }
  
  // Store the original send method
  const originalSend = res.send;
  
  // Override the send method to cache the response
  res.send = function(body) {
    if (res.statusCode === 200 && req.method === 'GET') {
      console.log(`[Cache] Caching response for ${key}`);
      apiCache.set(key, body);
    }
    
    // Call the original send method
    originalSend.call(this, body);
  };
  
  next();
};

// Proxy routes for API calls
// OpenAI proxy with improved error handling
app.use('/api/openai', createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/openai': ''
  },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Authorization', `Bearer ${process.env.VITE_OPENAI_API_KEY}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log API usage for monitoring
    if (proxyRes.statusCode !== 200) {
      console.warn(`[OpenAI] API error: ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[OpenAI] Proxy error:', err);
    res.status(500).json({
      error: 'OpenAI service unavailable',
      message: process.env.NODE_ENV === 'production' ? 'Service temporarily unavailable' : err.message
    });
  }
}));

// Groq proxy with improved error handling
app.use('/api/groq', createProxyMiddleware({
  target: 'https://api.groq.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/groq': ''
  },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Authorization', `Bearer ${process.env.VITE_GROQ_API_KEY}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode !== 200) {
      console.warn(`[Groq] API error: ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[Groq] Proxy error:', err);
    res.status(500).json({
      error: 'Groq service unavailable',
      message: process.env.NODE_ENV === 'production' ? 'Service temporarily unavailable' : err.message
    });
  }
}));

// Hugging Face proxy with caching and improved error handling
app.use('/api/huggingface', cacheResponse, createProxyMiddleware({
  target: 'https://api-inference.huggingface.co',
  changeOrigin: true,
  pathRewrite: {
    '^/api/huggingface': ''
  },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Authorization', `Bearer ${process.env.VITE_HUGGINGFACE_API_KEY}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.statusCode !== 200) {
      console.warn(`[HuggingFace] API error: ${proxyRes.statusCode}`);
    }
  },
  onError: (err, req, res) => {
    console.error('[HuggingFace] Proxy error:', err);
    res.status(500).json({
      error: 'Hugging Face service unavailable',
      message: process.env.NODE_ENV === 'production' ? 'Service temporarily unavailable' : err.message
    });
  }
}));

// LiveKit token generation endpoint with improved validation and caching
app.post('/api/livekit/token', async (req, res) => {
  const { roomName, userId } = req.body;
  
  // Input validation
  if (!roomName || !userId) {
    return res.status(400).json({ error: 'Missing roomName or userId' });
  }
  
  if (typeof roomName !== 'string' || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid roomName or userId format' });
  }
  
  // Sanitize inputs (strict validation)
  const roomNameRegex = /^[a-zA-Z0-9_-]{3,64}$/;
  const userIdRegex = /^[a-zA-Z0-9_-]{3,64}$/;
  
  if (!roomNameRegex.test(roomName) || !userIdRegex.test(userId)) {
    return res.status(400).json({ 
      error: 'Invalid format', 
      message: 'Room name and user ID must be 3-64 characters and contain only letters, numbers, underscores, and hyphens' 
    });
  }
  
  // Check for cached token
  const cacheKey = `livekit_token:${roomName}:${userId}`;
  const cachedToken = apiCache.get(cacheKey);
  
  if (cachedToken) {
    console.log(`[LiveKit] Using cached token for ${userId} in room ${roomName}`);
    return res.json({ token: cachedToken });
  }
  
  try {
    // Check if API keys are available
    if (!process.env.VITE_LIVEKIT_API_KEY || !process.env.VITE_LIVEKIT_API_SECRET) {
      console.error('[LiveKit] API credentials not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Create token with appropriate permissions
    const token = new AccessToken(
      process.env.VITE_LIVEKIT_API_KEY,
      process.env.VITE_LIVEKIT_API_SECRET,
      { identity: userId }
    );
    
    // Set token to expire after 24 hours
    token.ttl = 60 * 60 * 24;
    
    // Add appropriate grants based on user type
    const isAdmin = userId.startsWith('admin-');
    const isAgent = userId.startsWith('lark-agent');
    
    token.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: isAdmin || isAgent
    });
    
    const jwt = token.toJwt();
    
    // Cache the token for 1 hour
    apiCache.set(cacheKey, jwt, 3600);
    
    console.log(`[LiveKit] Generated token for ${userId} in room ${roomName}`);
    res.json({ token: jwt });
  } catch (error) {
    console.error('[LiveKit] Error generating token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      message: process.env.NODE_ENV === 'production' ? 'Service error' : error.message
    });
  }
});

// Health check endpoint with system status
app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    cache: {
      keys: apiCache.keys().length,
      hits: apiCache.getStats().hits,
      misses: apiCache.getStats().misses
    },
    env: process.env.NODE_ENV || 'development'
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  console.error(`[Error ${errorId}] Server error:`, err);
  
  // Structured error response
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    errorId: errorId,
    status: statusCode,
    path: req.path,
    timestamp: new Date().toISOString()
  });
  
  // Log detailed error information in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Debug]', {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: req.headers,
      stack: err.stack
    });
  }
});

// For any other request, send back the React app with appropriate caching
app.get('*', cacheMiddleware(3600), (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received shutdown signal, closing server...');
  server.close(() => {
    console.log('Server closed, exiting process');
    process.exit(0);
  });
  
  // Force close after 10 seconds if connections are still open
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

// Mount auth and subscription routes
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Health check endpoint with enhanced information
app.get('/api/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(healthData);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Auth and subscription routes enabled');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
