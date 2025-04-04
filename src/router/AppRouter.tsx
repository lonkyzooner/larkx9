import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from '../App';
import ProtectedRoute from '../auth/ProtectedRoute';
import SubscriptionPage from '../pages/SubscriptionPage';
import StripePricingPage from '../pages/StripePricingPage';
import LandingPage from '../pages/LandingPage';
import AccountPage from '../pages/AccountPage';
import StripeLoginPage from '../pages/StripeLoginPage';
import DashboardPage from '../pages/DashboardPage';
import { useStripeAuth } from '../auth/StripeAuthProvider';



// Create a layout component for authenticated pages
const AuthenticatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
};

// Define props interface for the App components
interface AppProps {
  initialTab?: string;
}

// Main router component
export const AppRouter: React.FC = () => {
  const { isAuthenticated } = useStripeAuth();
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Temporarily use development authentication by default
  // TODO: Replace with proper authentication once payment integration is complete
  const urlParams = new URLSearchParams(window.location.search);
  const skipAuth = urlParams.get('skipAuth') !== 'false'; // Default to true unless explicitly set to false
  
  // Use App component for all cases
  const AppComponent = App as React.ComponentType<AppProps>;
    
  // Create a development version of ProtectedRoute that doesn't require authentication
  const DevProtectedRoute: React.FC<{children: React.ReactNode}> = ({ children }) => {
    return <>{children}</>;
  };
  
  // Use the appropriate ProtectedRoute component
  const RouteGuard = skipAuth ? DevProtectedRoute : ProtectedRoute;
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<StripeLoginPage />} />
        
        {/* Protected routes */}
        <Route path="/dashboard" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <DashboardPage />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        
        {/* Subscription and Pricing Pages */}
        <Route path="/pricing" element={<StripePricingPage />} />
        <Route path="/account" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <AccountPage />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        <Route path="/subscription" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <SubscriptionPage />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        
        {/* Premium features */}
        <Route path="/threat-detection" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <AppComponent initialTab="threat" />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        
        <Route path="/miranda" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <AppComponent initialTab="miranda" />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        
        <Route path="/statutes" element={
          <RouteGuard>
            <AuthenticatedLayout>
              <AppComponent initialTab="statutes" />
            </AuthenticatedLayout>
          </RouteGuard>
        } />
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
