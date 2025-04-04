import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { AuthProvider } from '../contexts/AuthContext';
import auth0Config, { isAuth0Configured } from './auth0-config';

interface AuthProviderWrapperProps {
  children: React.ReactNode;
}

/**
 * Auth Provider Wrapper
 * 
 * This component wraps the application with Auth0Provider and our custom AuthProvider.
 * It handles the integration between Auth0 and our application's authentication context.
 */
export const AuthProviderWrapper: React.FC<AuthProviderWrapperProps> = ({ children }) => {
  // Check if Auth0 is configured
  const isConfigured = isAuth0Configured();
  
  // If Auth0 is not configured, render children with a mock AuthProvider
  if (!isConfigured) {
    console.warn('[Auth] Auth0 is not configured. Using mock authentication for development.');
    return (
      <div className="auth-mock-wrapper">
        {/* Add a small indicator for development mode */}
        {process.env.NODE_ENV !== 'production' && (
          <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            background: 'rgba(255, 193, 7, 0.8)',
            color: '#000',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 9999
          }}>
            DEV MODE: Auth0 Not Configured
          </div>
        )}
        {children}
      </div>
    );
  }
  
  // Log Auth0 configuration for debugging
  console.log('[Auth] Auth0 configuration:', {
    domain: auth0Config.domain,
    clientId: auth0Config.clientId,
    redirectUri: window.location.origin,
    audience: auth0Config.audience
  });
  
  // Alert if any required Auth0 configuration is missing
  if (!auth0Config.domain || !auth0Config.clientId) {
    console.error('[Auth] Missing required Auth0 configuration. Please check your .env file.');
  }
  
  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Config.audience,
        scope: 'openid profile email',
        // Add response_type for clearer authentication flow
        response_type: 'token id_token',
        // Ensure proper connection with Auth0
        connection: 'Username-Password-Authentication'
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <AuthProvider>
        {children}
      </AuthProvider>
    </Auth0Provider>
  );
};

export default AuthProviderWrapper;
