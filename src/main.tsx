import React from 'react'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { StripeAuthProvider } from './auth/StripeAuthProvider'
import { StripeProvider } from './contexts/StripeContext'
import AppRouter from './router/AppRouter'
import './index.css'
import './styles/globals.css'

// Check for development mode
const isDevelopment = import.meta.env.DEV;

// Create a root element
const rootElement = document.getElementById("root");

// Render the application
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <StripeAuthProvider>
        <StripeProvider>
          <AppRouter />
        </StripeProvider>
      </StripeAuthProvider>
    </StrictMode>
  );
} else {
  console.error('Root element not found. Cannot mount application.');
}
