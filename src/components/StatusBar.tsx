
import React from 'react';
import { Wifi, Battery, SignalHigh } from 'lucide-react';

interface StatusBarProps {
  status: string;
  time?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ status, time }) => {
  const currentTime = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div className="lark-status-bar">
      <div className="flex items-center">
        <SignalHigh size={14} className="mr-2" />
        <Wifi size={14} className="mr-2" />
        <span>{currentTime}</span>
      </div>
      <div className="text-center flex-1">
        {status}
      </div>
      <div className="flex items-center">
        <Battery size={14} className="ml-2" />
      </div>
    </div>
  );
};

export default StatusBar;
