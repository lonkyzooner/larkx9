import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/DevAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredFeature?: string;
  requiredSubscriptionTier?: 'free' | 'basic' | 'standard' | 'premium' | 'enterprise';
}

/**
 * Protected Route Component
 * 
 * This component protects routes by checking if the user is authenticated.
 * It can also check for specific features or subscription tiers.
 * 
 * @param children - The components to render if access is granted
 * @param requiredFeature - Optional feature name that the user must have access to
 * @param requiredSubscriptionTier - Optional minimum subscription tier required
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredFeature,
  requiredSubscriptionTier
}) => {
  const { isAuthenticated, isLoading, user, hasFeature, hasSubscriptionTier } = useAuth();
  const location = useLocation();

  // If still loading auth state, show loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-foreground font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    // Save the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for required feature
  if (requiredFeature && !hasFeature(requiredFeature)) {
    return <Navigate to="/subscription" state={{ 
      message: `You need access to ${requiredFeature} to view this page.`,
      requiredFeature
    }} replace />;
  }

  // Check for required subscription tier
  if (requiredSubscriptionTier && !hasSubscriptionTier(requiredSubscriptionTier)) {
    return <Navigate to="/subscription" state={{ 
      message: `You need a ${requiredSubscriptionTier} subscription to view this page.`,
      requiredSubscriptionTier
    }} replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
