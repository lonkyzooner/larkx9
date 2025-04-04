import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';

const LoginPage: React.FC = () => {
  const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();

  const handleLogin = async () => {
    console.log('[LoginPage] Initiating Auth0 login');
    try {
      await loginWithRedirect({
        appState: {
          returnTo: '/',
          timestamp: new Date().getTime()
        }
      });
    } catch (err) {
      console.error('[LoginPage] Auth0 login error:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-900 to-blue-950">
      <Card className="w-full max-w-md mx-auto bg-white/10 backdrop-blur-md text-white border-blue-700">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">LARK</CardTitle>
          <CardDescription className="text-blue-200">
            Law Enforcement Assistance and Response Kit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-semibold">Welcome</h3>
            <p className="text-sm text-blue-200">
              Sign in to access your LARK assistant
            </p>
          </div>
          
          {isLoading ? (
            <div className="text-center py-4">Loading authentication...</div>
          ) : isAuthenticated ? (
            <div className="text-center py-4">
              You are already authenticated. Redirecting...
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-sm">
                  Authentication error: {error.message}
                </div>
              )}
              
              <Button 
                className="w-full bg-blue-700 hover:bg-blue-600" 
                onClick={handleLogin}
              >
                Sign in with Auth0
              </Button>
              
              <div className="text-xs text-center text-blue-300 mt-4">
                <p>Auth0 Domain: {import.meta.env.VITE_AUTH0_DOMAIN}</p>
                <p>Client ID: {import.meta.env.VITE_AUTH0_CLIENT_ID.substring(0, 6)}...</p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t border-blue-800 pt-4">
          <p className="text-xs text-blue-300">
            © 2025 LARK - Secure Authentication
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
