/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Keys
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_ELEVENLABS_API_KEY: string
  readonly VITE_ELEVENLABS_VOICE_ID: string
  readonly VITE_GROQ_API_KEY: string
  readonly VITE_HUGGINGFACE_API_KEY: string
  
  // LiveKit Configuration
  readonly VITE_LIVEKIT_URL: string
  readonly VITE_LIVEKIT_API_KEY: string
  readonly VITE_LIVEKIT_API_SECRET: string
  
  // Auth0 Configuration
  readonly VITE_AUTH0_DOMAIN: string
  readonly VITE_AUTH0_CLIENT_ID: string
  readonly VITE_AUTH0_AUDIENCE: string
  
  // Stripe Configuration
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
