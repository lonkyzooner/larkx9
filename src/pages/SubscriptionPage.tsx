import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/DevAuthContext';
import { useSubscription, SubscriptionPlan } from '../services/subscription/SubscriptionService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useNavigate } from 'react-router-dom';

export const SubscriptionPage: React.FC = () => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const { 
    subscriptionTier, 
    subscriptionStatus, 
    apiQuota,
    subscribeToPlan,
    manageSubscription,
    cancelSubscription,
    getSubscriptionPlans,
    getCurrentSubscription,
    getUsageData
  } = useSubscription();
  
  const { error, handleError, clearError } = useErrorHandler();
  const navigate = useNavigate();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [usageData, setUsageData] = useState<{ used: number; total: number; resetDate: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  
  // Load subscription data
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      
      try {
        setIsLoading(true);
        clearError();
        
        // Load subscription plans
        const plansData = await getSubscriptionPlans();
        setPlans(plansData);
        
        // Load current subscription
        const currentSubscription = await getCurrentSubscription();
        setCurrentPlan(currentSubscription);
        
        // Load usage data
        const usage = await getUsageData();
        setUsageData(usage);
      } catch (err) {
        handleError({
          message: `Failed to load subscription data: ${err instanceof Error ? err.message : 'Unknown error'}`,
          source: 'SubscriptionPage',
          recoverable: true
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!authLoading) {
      loadData();
    }
  }, [isAuthenticated, authLoading, navigate, getSubscriptionPlans, getCurrentSubscription, getUsageData, handleError, clearError]);
  
  // Handle subscription to a plan
  const handleSubscribe = async (planId: string) => {
    try {
      setProcessingPlanId(planId);
      clearError();
      
      const success = await subscribeToPlan(planId);
      
      if (!success) {
        throw new Error('Failed to subscribe to plan');
      }
    } catch (err) {
      handleError({
        message: `Failed to subscribe: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'SubscriptionPage',
        recoverable: true
      });
    } finally {
      setProcessingPlanId(null);
    }
  };
  
  // Handle opening the customer portal
  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      clearError();
      
      await manageSubscription();
    } catch (err) {
      handleError({
        message: `Failed to open customer portal: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'SubscriptionPage',
        recoverable: true
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle cancellation of subscription
  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? Your access will continue until the end of your current billing period.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      clearError();
      
      const success = await cancelSubscription();
      
      if (success) {
        alert('Your subscription has been canceled. You will continue to have access until the end of your current billing period.');
      } else {
        throw new Error('Failed to cancel subscription');
      }
    } catch (err) {
      handleError({
        message: `Failed to cancel subscription: ${err instanceof Error ? err.message : 'Unknown error'}`,
        source: 'SubscriptionPage',
        recoverable: true
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calculate days remaining in subscription
  const getDaysRemaining = (): number => {
    if (!user?.subscriptionExpiry) return 0;
    
    const expiryDate = new Date(user.subscriptionExpiry);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // Calculate API usage percentage
  const getApiUsagePercentage = (): number => {
    if (!apiQuota || apiQuota.total === 0) return 0;
    return Math.min(100, Math.round((apiQuota.used / apiQuota.total) * 100));
  };
  
  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Render loading state
  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading subscription information...</h1>
          <div className="animate-pulse flex flex-col space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error loading subscription information</h1>
          <div className="p-4 bg-red-100 text-red-800 rounded-md mb-4">
            {error.message}
          </div>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Subscription Management</h1>
      
      {/* Current Subscription */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Your Subscription</h2>
        <Card>
          <CardHeader>
            <CardTitle>
              {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} Plan
            </CardTitle>
            <CardDescription>
              Status: <span className={`font-semibold ${
                subscriptionStatus === 'active' ? 'text-green-600' : 
                subscriptionStatus === 'trialing' ? 'text-blue-600' : 
                subscriptionStatus === 'past_due' ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.subscriptionExpiry && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Subscription renews in {getDaysRemaining()} days</p>
                <p className="text-sm text-gray-500">
                  Next billing date: {formatDate(user.subscriptionExpiry.toString())}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-sm text-gray-500 mb-1">API Usage</p>
              <Progress value={getApiUsagePercentage()} className="h-2 mb-1" />
              <p className="text-xs text-gray-500">
                {apiQuota?.used || 0} / {apiQuota?.total || 0} API calls used
                {apiQuota?.reset && ` (Resets on ${formatDate(apiQuota.reset.toString())})`}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={isLoading || subscriptionStatus === 'inactive'}
            >
              Manage Subscription
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelSubscription}
              disabled={isLoading || subscriptionStatus !== 'active'}
            >
              Cancel Subscription
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={`${
              plan.tier === subscriptionTier ? 'border-2 border-blue-500' : ''
            }`}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  ${plan.price.toFixed(2)}
                  <span className="text-sm font-normal text-gray-500">
                    /{plan.interval}
                  </span>
                </div>
                
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={
                    isLoading || 
                    processingPlanId === plan.id || 
                    plan.tier === subscriptionTier
                  }
                  variant={plan.tier === subscriptionTier ? "outline" : "default"}
                >
                  {processingPlanId === plan.id ? 'Processing...' : 
                   plan.tier === subscriptionTier ? 'Current Plan' : 
                   'Subscribe'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
