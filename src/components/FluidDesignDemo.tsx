import React, { useState } from 'react';
import '../styles/fluid-theme.css';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ShieldIcon, ArrowUpRight, BookOpenIcon, UserIcon, MenuIcon, ZapIcon, BellIcon } from 'lucide-react';

export function FluidDesignDemo() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="fluid-background min-h-screen">
      {/* Decorative wave elements */}
      <div className="fluid-wave"></div>
      <div className="fluid-wave-gold"></div>
      
      {/* Header */}
      <header className="flex justify-between items-center p-6 relative z-10">
        <div className="flex items-center gap-2">
          <ShieldIcon className="h-6 w-6 text-[var(--evoke-dark-blue)]" />
          <h1 className="fluid-heading text-xl font-bold">LARK</h1>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-[var(--evoke-text)] hover:text-[var(--evoke-dark-blue)] transition-colors">Our Work</a>
          <a href="#" className="text-[var(--evoke-text)] hover:text-[var(--evoke-dark-blue)] transition-colors">Pricing</a>
          <a href="#" className="text-[var(--evoke-text)] hover:text-[var(--evoke-dark-blue)] transition-colors">The Team</a>
          <a href="#" className="text-[var(--evoke-text)] hover:text-[var(--evoke-dark-blue)] transition-colors">FAQs</a>
        </nav>
        <div className="flex items-center gap-4">
          <Button className="rounded-full bg-white text-black border border-gray-200 hover:bg-gray-50 px-4 py-2 text-sm font-medium">
            Book a Call
          </Button>
          <Button className="rounded-full bg-black text-white px-4 py-2 text-sm font-medium">
            See Pricing
          </Button>
          <button className="md:hidden">
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>
      </header>
      
      {/* Main content */}
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <div className="fluid-card p-4 mb-6">
            <h2 className="fluid-heading text-lg mb-4">Command Center</h2>
            <nav className="space-y-2">
              <button 
                className={`w-full text-left p-3 rounded-lg transition flex items-center ${
                  activeTab === 'dashboard' 
                    ? 'le-blue-accent' 
                    : 'hover:bg-white/60'
                }`}
                onClick={() => setActiveTab('dashboard')}
              >
                <ZapIcon className="h-4 w-4 mr-3" />
                Dashboard
              </button>
              <button 
                className={`w-full text-left p-3 rounded-lg transition flex items-center ${
                  activeTab === 'threats' 
                    ? 'le-blue-accent' 
                    : 'hover:bg-white/60'
                }`}
                onClick={() => setActiveTab('threats')}
              >
                <ShieldIcon className="h-4 w-4 mr-3" />
                Threat Detection
              </button>
              <button 
                className={`w-full text-left p-3 rounded-lg transition flex items-center ${
                  activeTab === 'alerts' 
                    ? 'le-blue-accent' 
                    : 'hover:bg-white/60'
                }`}
                onClick={() => setActiveTab('alerts')}
              >
                <BellIcon className="h-4 w-4 mr-3" />
                Alerts
              </button>
            </nav>
          </div>
          
          <div className="fluid-glass p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">System Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Battery</span>
                <div className="w-24 h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Signal</span>
                <div className="w-24 h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Storage</span>
                <div className="w-24 h-2 bg-white/50 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main panel */}
        <div className="md:col-span-2">
          <div className="fluid-card p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="fluid-heading text-xl">Threat Assessment</h2>
              <Badge className="bg-green-500">Normal</Badge>
            </div>
            
            <div className="space-y-4">
              <div className="fluid-glass p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Current Environment</h3>
                <p className="text-sm text-gray-700">
                  No immediate threats detected. Environment is secure with normal activity levels.
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="fluid-glass p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">72°F</div>
                  <div className="text-xs text-gray-600">Temperature</div>
                </div>
                <div className="fluid-glass p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">43%</div>
                  <div className="text-xs text-gray-600">Humidity</div>
                </div>
                <div className="fluid-glass p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">2</div>
                  <div className="text-xs text-gray-600">Persons Detected</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="fluid-card p-6">
            <h2 className="fluid-heading text-xl mb-4">Voice Command</h2>
            <div className="flex gap-4">
              <Input 
                className="fluid-input flex-1" 
                placeholder="Enter a command or ask a question..." 
              />
              <Button className="fluid-button">
                Send
              </Button>
            </div>
            
            <div className="mt-6 p-4 rounded-lg bg-white/40">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700">Officer</div>
                  <div className="text-sm text-gray-600 mt-1">Check for threats in the area</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <ShieldIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-700">LARK</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Scanning complete. No immediate threats detected in your vicinity. 
                    All systems operating normally.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
