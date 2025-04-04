import React from 'react';

interface LarkLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * LARK Logo component
 * Displays the LARK (Law Enforcement Assistance and Response Kit) logo
 */
const LarkLogo: React.FC<LarkLogoProps> = ({ 
  width = 200, 
  height = 100,
  className = ''
}) => {
  return (
    <div className={`lark-logo ${className}`}>
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 800 400" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M123.5 365C123.5 365 42 365 42 365C42 365 42 283.5 42 283.5C42 283.5 123.5 283.5 123.5 283.5M123.5 283.5C123.5 283.5 205 283.5 205 283.5C205 283.5 205 202 205 202M205 202C205 202 286.5 202 286.5 202C286.5 202 286.5 120.5 286.5 120.5M286.5 120.5C286.5 120.5 368 120.5 368 120.5C368 120.5 368 39 368 39M368 39C368 39 449.5 39 449.5 39C449.5 39 449.5 120.5 449.5 120.5M449.5 120.5C449.5 120.5 531 120.5 531 120.5C531 120.5 531 202 531 202M531 202C531 202 612.5 202 612.5 202C612.5 202 612.5 283.5 612.5 283.5M612.5 283.5C612.5 283.5 694 283.5 694 283.5C694 283.5 694 365 694 365C694 365 612.5 365 612.5 365M612.5 365C612.5 365 531 365 531 365C531 365 531 283.5 531 283.5M531 283.5C531 283.5 449.5 283.5 449.5 283.5C449.5 283.5 449.5 202 449.5 202M449.5 202C449.5 202 368 202 368 202C368 202 368 120.5 368 120.5M368 120.5C368 120.5 286.5 120.5 286.5 120.5M286.5 120.5C286.5 120.5 205 120.5 205 120.5C205 120.5 205 202 205 202M205 202C205 202 123.5 202 123.5 202C123.5 202 123.5 283.5 123.5 283.5" 
          stroke="currentColor" 
          strokeWidth="24" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        <circle cx="368" cy="120.5" r="10" fill="currentColor" />
        <path 
          d="M450 120L450 365" 
          stroke="currentColor" 
          strokeWidth="24" 
          strokeLinecap="round"
        />
        <path 
          d="M530 200L700 200" 
          stroke="currentColor" 
          strokeWidth="24" 
          strokeLinecap="round"
        />
        <path 
          d="M530 280L700 280" 
          stroke="currentColor" 
          strokeWidth="24" 
          strokeLinecap="round"
        />
        <path 
          d="M530 360L700 360" 
          stroke="currentColor" 
          strokeWidth="24" 
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default React.memo(LarkLogo);
