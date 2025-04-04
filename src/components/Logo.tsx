
import React from 'react';

interface LogoProps {
  listening?: boolean;
}

const Logo: React.FC<LogoProps> = ({ listening = false }) => {
  return (
    <div className="flex flex-col items-center justify-center mb-4 relative">
      <h1 className="text-4xl font-bold text-lark-light-blue tracking-widest">LARK</h1>
      <div className="text-xs text-gray-400 mt-1">
        Law Enforcement Assistance and Response Kit
      </div>
      {listening && (
        <div className="listening-indicator"></div>
      )}
    </div>
  );
};

export default Logo;
