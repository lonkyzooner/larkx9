import React from 'react';
import { Button } from '../components/ui/button';
import { ArrowRight, Shield, Mic, Book, AlertTriangle, BarChart, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-from-r from-blue-100 to-blue-300">
            LARK
          </h1>
          <p className="text-2xl md:text-3xl font-light mb-8 text-blue-200">
            Law Enforcement Assistance and Response Kit
          </p>
          <p className="text-xl max-w-3xl mx-auto mb-10 text-blue-100">
            The AI-powered assistant designed specifically for law enforcement officers in the field.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8">
              <Link to="/pricing">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-blue-400 text-blue-200 hover:bg-blue-800/20">
              <Link to="/demo">Watch Demo</Link>
            </Button>
          </div>
        </div>

        {/* Hero Image */}
        <div className="rounded-lg overflow-hidden shadow-2xl mx-auto max-w-4xl bg-blue-950/50 border border-blue-800/50 p-4">
          <div className="aspect-video rounded bg-blue-900/50 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-24 h-24 bg-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic size={48} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white">Voice-activated AI assistant for law enforcement</h3>
              <p className="text-blue-200 mt-2">Demo video would appear here in production</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-white">Key Features</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <Mic className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Voice Activation</h3>
            <p className="text-blue-200">
              Hands-free operation lets you focus on the situation while getting real-time assistance.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <Book className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Miranda Rights Delivery</h3>
            <p className="text-blue-200">
              Accurate, consistent delivery of Miranda rights in multiple languages with documentation.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <Shield className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Statute Lookups</h3>
            <p className="text-blue-200">
              Instant access to Louisiana statutes and legal information when you need it most.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Threat Detection</h3>
            <p className="text-blue-200">
              Audio-based threat detection provides early warning of potentially dangerous situations.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <BarChart className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Analytics</h3>
            <p className="text-blue-200">
              Track usage, response times, and effectiveness with detailed analytics and reporting.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-6 hover:shadow-lg transition-all">
            <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center mb-4">
              <Award className="text-white h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3 text-white">Training Mode</h3>
            <p className="text-blue-200">
              Practice scenarios and improve skills with the built-in training and simulation mode.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-white">Trusted by Law Enforcement</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Testimonial 1 */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-700 rounded-full mr-4"></div>
              <div>
                <h3 className="font-semibold text-white">Officer J. Martinez</h3>
                <p className="text-blue-300 text-sm">Baton Rouge PD</p>
              </div>
            </div>
            <p className="text-blue-200 italic">
              "LARK has completely changed how I approach my daily patrol. Having instant access to information while keeping my hands free has improved my situational awareness."
            </p>
          </div>
          
          {/* Testimonial 2 */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-700 rounded-full mr-4"></div>
              <div>
                <h3 className="font-semibold text-white">Sgt. T. Johnson</h3>
                <p className="text-blue-300 text-sm">Louisiana State Police</p>
              </div>
            </div>
            <p className="text-blue-200 italic">
              "The Miranda rights delivery in multiple languages has been invaluable for our diverse community. It ensures we're following proper procedure every time."
            </p>
          </div>
          
          {/* Testimonial 3 */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-700 rounded-full mr-4"></div>
              <div>
                <h3 className="font-semibold text-white">Lt. S. Williams</h3>
                <p className="text-blue-300 text-sm">Lafayette Sheriff's Office</p>
              </div>
            </div>
            <p className="text-blue-200 italic">
              "The threat detection feature alerted me to a potential weapon during a routine traffic stop. LARK may have saved my life that night."
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-white">Ready to transform your law enforcement operations?</h2>
          <p className="text-xl mb-8 text-blue-200">
            Join departments across Louisiana who are using LARK to enhance officer safety and effectiveness.
          </p>
          <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500 px-8">
            <Link to="/pricing" className="flex items-center">
              Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-blue-950 border-t border-blue-900/50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4 text-white">LARK</h3>
            <p className="text-blue-300">Law Enforcement Assistance and Response Kit</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-white">Product</h4>
            <ul className="space-y-2 text-blue-300">
              <li><Link to="/features" className="hover:text-blue-200">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-blue-200">Pricing</Link></li>
              <li><Link to="/demo" className="hover:text-blue-200">Demo</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-white">Support</h4>
            <ul className="space-y-2 text-blue-300">
              <li><Link to="/help" className="hover:text-blue-200">Help Center</Link></li>
              <li><Link to="/contact" className="hover:text-blue-200">Contact Us</Link></li>
              <li><Link to="/faq" className="hover:text-blue-200">FAQs</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4 text-white">Legal</h4>
            <ul className="space-y-2 text-blue-300">
              <li><Link to="/terms" className="hover:text-blue-200">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-blue-200">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-blue-900/30 text-center">
          <p className="text-blue-400 text-sm">
            &copy; {new Date().getFullYear()} LARK. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
