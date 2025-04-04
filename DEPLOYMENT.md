# LARK Web Deployment Guide

This guide provides instructions for deploying the LARK (Law Enforcement Assistance and Response Kit) application to a web server.

## Prerequisites

- Node.js 16+ and npm
- A hosting service (Vercel, Netlify, AWS, etc.)
- API keys for:
  - LiveKit
  - OpenAI
  - Hugging Face

## Project Structure

The LARK application consists of:

1. **Frontend**: A React application built with Vite
2. **Backend**: A Node.js Express server that handles API key security and token generation

## Environment Setup

### 1. Frontend Environment Variables

Create a `.env` file in the project root with the following variables:

```
# LiveKit Configuration
VITE_LIVEKIT_URL=wss://lark-za4hpayr.livekit.cloud

# API URL (points to your backend)
VITE_API_BASE_URL=https://your-backend-url.com
```

### 2. Backend Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```
# Server Configuration
PORT=3000
NODE_ENV=production

# LiveKit Credentials
VITE_LIVEKIT_URL=wss://lark-za4hpayr.livekit.cloud
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret

# OpenAI API Key
VITE_OPENAI_API_KEY=your_openai_api_key

# Hugging Face API Key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key
```

## Deployment Options

### Option 1: Vercel Deployment (Frontend + Serverless Functions)

1. **Prepare for Vercel deployment**:
   
   Create a `vercel.json` file in the project root:

   ```json
   {
     "version": 2,
     "builds": [
       { "src": "server/index.js", "use": "@vercel/node" },
       { "src": "package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
     ],
     "routes": [
       { "src": "/api/(.*)", "dest": "server/index.js" },
       { "src": "/(.*)", "dest": "/dist/$1" }
     ]
   }
   ```

2. **Update package.json**:

   Add the following script to your root `package.json`:

   ```json
   "scripts": {
     "vercel-build": "npm run build"
   }
   ```

3. **Deploy to Vercel**:

   ```bash
   npm install -g vercel
   vercel
   ```

### Option 2: Separate Frontend and Backend Deployment

#### Frontend Deployment (Netlify, Vercel, or similar)

1. **Build the frontend**:

   ```bash
   npm run build
   ```

2. **Deploy the `dist` directory** to your chosen static hosting service.

#### Backend Deployment (Heroku, AWS, Digital Ocean, etc.)

1. **Install dependencies**:

   ```bash
   cd server
   npm install
   ```

2. **Start the server**:

   ```bash
   npm start
   ```

3. **For Heroku deployment**:

   Create a `Procfile` in the server directory:
   ```
   web: node index.js
   ```

   Then deploy:
   ```bash
   heroku create lark-backend
   git subtree push --prefix server heroku main
   ```

## Security Considerations

1. **API Keys**: Never expose API keys in the frontend code. All API calls should be proxied through the backend.

2. **CORS Configuration**: Update the CORS settings in `server/index.js` to only allow requests from your frontend domain.

3. **Rate Limiting**: The server includes rate limiting to prevent abuse. Adjust the limits as needed.

4. **Environment Variables**: Ensure all sensitive information is stored in environment variables, not in the code.

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your backend CORS settings allow requests from your frontend domain.

2. **API Key Issues**: Verify that all API keys are correctly set in the environment variables.

3. **LiveKit Connection Problems**: Check that your LiveKit URL and credentials are correct.

4. **Microphone Access**: The application has fallback mechanisms for when microphone access is denied, but users should be encouraged to grant permission for the best experience.

## Monitoring and Maintenance

1. **Health Checks**: The backend includes a `/api/health` endpoint that can be used for monitoring.

2. **Logging**: Server logs are available through your hosting provider's dashboard.

3. **Updates**: Regularly update dependencies to ensure security and compatibility.

## Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Hugging Face API Documentation](https://huggingface.co/docs/api-inference/index)
