import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStripe } from '../contexts/StripeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle2, ArrowRight, Shield } from 'lucide-react';
import App from '../App';

const DashboardPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { subscriptionTier } = useStripe();
  const [showSuccess, setShowSuccess] = useState(false);
  
  useEffect(() => {
    // Check if we're coming from a successful subscription
    const urlParams = new URLSearchParams(location.search);
    const isSuccess = urlParams.get('subscription') === 'success';
    
    if (isSuccess) {
      setShowSuccess(true);
      
      // Remove the query parameter after a delay
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [location, navigate]);
  
  // Determine subscription level for display
  const subscriptionName = subscriptionTier === 'premium' 
    ? 'Premium' 
    : subscriptionTier === 'standard'
      ? 'Standard'
      : subscriptionTier === 'enterprise'
        ? 'Enterprise'
        : 'Basic';
  
  // If showing success message, render that first
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-green-500 bg-blue-950/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-green-500/20 p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-white">Subscription Activated!</CardTitle>
            <CardDescription className="text-blue-200">
              Your {subscriptionName} plan is now active
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-blue-100">
            <p>Thank you for subscribing to LARK. You now have access to all {subscriptionName} features.</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              onClick={() => setShowSuccess(false)}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Continue to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Otherwise show the main dashboard with the App component
  return (
    <div className="min-h-screen">
      {/* Modern header with law enforcement blue gradient */}
      <div className="p-4 bg-gradient-to-r from-[#002166] to-[#003087]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide"></h1>
              <p className="text-blue-100 text-sm">
                {subscriptionTier ? `LARK ${subscriptionName}` : 'LARK Assistant'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-2 md:mt-0">
            {/* Status badge */}
            <div className="bg-white/10 px-3 py-1.5 rounded-full flex items-center text-sm text-blue-100 border border-white/5 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
              Active
            </div>
            
            {/* Account button with improved styling */}
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate('/account')}
              className="text-blue-950 bg-white/90 border-blue-200 hover:bg-white rounded-full px-4 font-medium shadow-md"
            >
              My Account
            </Button>
          </div>
        </div>
      </div>
      
      <App />
    </div>
  );
};

export default DashboardPage;
