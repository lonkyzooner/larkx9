# LARK - Law Enforcement Assistance and Response Kit

## Project info

LARK is a body-mounted AI assistant designed specifically for solo police officers, providing real-time assistance, information access, and communication capabilities to enhance officer safety and effectiveness in the field.

## Key Features

- Voice-activated interaction using LiveKit and OpenAI Realtime API
- Multilingual Miranda Rights delivery
- Louisiana Statute Lookups
- Audio-based threat detection
- Proactive tactical feedback
- Training mode
- IoT integration with UniHiker M10 hardware

## Deploying to Vercel

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b0cde990-0f31-4c17-aa32-3beb1cc2d015) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Vercel Deployment Instructions

1. Push your code to GitHub
   ```sh
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. Connect your GitHub repository to Vercel
   - Create a Vercel account at https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project settings

3. Set Environment Variables in Vercel
   - In your Vercel project settings, go to the "Environment Variables" tab
   - Add the following environment variables:

   ```
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_LIVEKIT_URL=wss://lark-za4hpayr.livekit.cloud
   VITE_LIVEKIT_API_KEY=APIriVQTTMAvLQ4
   VITE_LIVEKIT_API_SECRET=fleSOaoOdQ0v5fOatkISxYqvNygclQAeSilRMZ1kLbwB
   ```

4. Deploy your application
   - Click "Deploy" and wait for the build to complete
   - Your app will be available at the provided Vercel URL

## Hardware Integration

This application is designed to work with the DFRobot UniHiker M10 hardware, featuring:
- 2.8-inch touchscreen 
- Microphone
- USB speaker

The voice implementation uses OpenAI's "Ash" voice for speech-to-text and text-to-speech capabilities.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b0cde990-0f31-4c17-aa32-3beb1cc2d015) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
