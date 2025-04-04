# LARK Vercel Deployment Guide

This guide provides step-by-step instructions for deploying the LARK (Law Enforcement Assistance and Response Kit) application to Vercel with Stripe authentication.

## Prerequisites

Before deploying, ensure you have:

1. A [Vercel account](https://vercel.com/signup)
2. A [MongoDB Atlas account](https://www.mongodb.com/cloud/atlas/register)
3. A [Stripe account](https://dashboard.stripe.com/register)
4. A [LiveKit account](https://livekit.io/)
5. An email service account (Gmail, SendGrid, etc.)

## Step 1: Prepare Your Environment Variables

1. Copy `.env.example` to `.env.local` for local development
2. Fill in all required environment variables with your actual credentials

## Step 2: Set Up MongoDB Atlas

1. Create a new MongoDB Atlas cluster
2. Create a database named `lark`
3. Create a database user with read/write permissions
4. Add your IP address to the IP access list (or allow access from anywhere for development)
5. Get your MongoDB connection string from Atlas

## Step 3: Configure Stripe

1. Create subscription products and prices in the Stripe dashboard
2. Note the price IDs for each subscription tier
3. Set up a webhook endpoint in Stripe dashboard pointing to `https://your-vercel-deployment-url.vercel.app/api/webhook`
4. Get your webhook signing secret

## Step 4: Configure LiveKit

1. Set up a LiveKit project
2. Get your API key and secret
3. Configure CORS settings to allow your Vercel deployment URL

## Step 5: Deploy to Vercel

1. Install the Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Log in to Vercel:
   ```
   vercel login
   ```

3. Deploy the project:
   ```
   vercel
   ```

4. During deployment, you'll be prompted to set environment variables. Add all variables from your `.env.local` file.

5. Once deployed, update your environment variables in the Vercel dashboard with the correct production URLs.

## Step 6: Configure Email Service

1. Set up an email service for sending magic links
2. Update the email configuration in your Vercel environment variables

## Step 7: Update Stripe Webhook

1. Update your Stripe webhook endpoint to point to your production Vercel URL
2. Verify the webhook is working by testing a subscription

## Step 8: Test the Deployment

1. Visit your deployed application
2. Test the authentication flow with a magic link
3. Test the subscription process
4. Verify LiveKit voice functionality

## Troubleshooting

### Authentication Issues

- Check the Vercel function logs for any errors
- Verify your JWT_SECRET is set correctly
- Ensure your email service is configured properly

### Stripe Integration Issues

- Verify your Stripe webhook is configured correctly
- Check that your price IDs match those in your environment variables
- Ensure your Stripe API keys are correct

### LiveKit Issues

- Verify your LiveKit API keys are correct
- Check CORS settings in LiveKit dashboard
- Ensure your frontend URL is using the correct LiveKit server URL

## Security Considerations

1. **API Keys**: All API keys are stored securely in Vercel environment variables
2. **MongoDB**: Use a strong password and restrict IP access if possible
3. **JWT**: Use a strong, random JWT secret
4. **Email**: Use app-specific passwords if using Gmail

## Monitoring and Maintenance

1. Set up Vercel Analytics to monitor application performance
2. Configure alerts for any API failures
3. Regularly check Stripe dashboard for subscription status
4. Monitor MongoDB Atlas for database performance

---

For any questions or issues, please contact the development team.
