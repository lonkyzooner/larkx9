import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Check } from 'lucide-react';
import { useStripe } from '../contexts/StripeContext';

// Define subscription tier types and features
interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  buttonText: string;
  recommended?: boolean;
  stripePriceId?: string;
}

const StripePricingPage: React.FC = () => {
  const { isLoading, createCheckoutSession, subscriptionTier } = useStripe();

  // Mock subscription tiers - replace with your actual plans
  const subscriptionTiers: SubscriptionTier[] = [
    {
      id: 'basic',
      name: 'Basic',
      price: 14.99,
      features: [
        'Miranda Rights delivery',
        'Basic statute lookups',
        'Voice activation',
        '24/7 availability'
      ],
      buttonText: 'Start Basic',
      stripePriceId: 'price_basic123'
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 24.99,
      features: [
        'Everything in Basic',
        'Advanced statute lookups',
        'Threat detection',
        'Multi-language support',
        'Proactive tactical feedback'
      ],
      buttonText: 'Start Standard',
      recommended: true,
      stripePriceId: 'price_standard123'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 49.99,
      features: [
        'Everything in Standard',
        'Training mode',
        'Advanced analytics',
        'Custom department integrations',
        'Priority support',
        'Unlimited API usage'
      ],
      buttonText: 'Start Premium',
      stripePriceId: 'price_premium123'
    }
  ];

  // Function to handle subscription checkout
  const handleSubscription = async (tier: SubscriptionTier) => {
    await createCheckoutSession(
      tier.stripePriceId || 'price_placeholder', 
      `${window.location.origin}/dashboard?subscription=success`,
      `${window.location.origin}/pricing`
    );
  };

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-900 to-blue-950 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Choose Your LARK Plan</h1>
          <p className="text-xl text-blue-200 max-w-3xl mx-auto">
            Select the plan that best fits your department's needs
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {subscriptionTiers.map((tier) => (
            <Card 
              key={tier.id} 
              className={`flex flex-col h-full ${
                tier.recommended 
                  ? 'border-2 border-blue-500 bg-blue-950/50' 
                  : 'border border-blue-800/50 bg-blue-950/30'
              }`}
            >
              {tier.recommended && (
                <div className="bg-blue-600 text-white text-center py-1 text-sm font-medium">
                  RECOMMENDED
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                <CardDescription className="text-blue-300">
                  <span className="text-3xl font-bold text-white">${tier.price}</span>
                  <span className="text-blue-300">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3 text-sm">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-5 w-5 mr-2 text-blue-400 shrink-0 mt-0.5" />
                      <span className="text-blue-100">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => handleSubscription(tier)}
                  disabled={isLoading || subscriptionTier === tier.id}
                  className={`w-full ${
                    tier.recommended 
                      ? 'bg-blue-600 hover:bg-blue-500' 
                      : 'bg-blue-800 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? 'Processing...' : tier.buttonText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 text-center text-blue-300 text-sm">
          <p>All plans include a 14-day free trial. No credit card required to start.</p>
          <p className="mt-2">Questions? Contact our sales team at sales@lark-law.com</p>
        </div>
      </div>
    </div>
  );
};

export default StripePricingPage;
