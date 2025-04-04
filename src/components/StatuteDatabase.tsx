import React, { useState, useRef } from 'react';
import { handleStatuteLookup } from './RSCodes';
import { useVoice } from '../contexts/VoiceContext';

interface StatuteProps {
  statute: string;
  description: string;
}

const StatuteDatabase: React.FC<StatuteProps> = ({ statute, description }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [suggestedCharges, setSuggestedCharges] = useState<string[]>([]);
  const [statuteUrl, setStatuteUrl] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { speak } = useVoice();
  
  // Call the handleStatuteLookup function with all required parameters
  const handleStatuteLookupLocal = () => {
    handleStatuteLookup(
      statute,
      setIsLoading,
      setResult,
      setSuggestedCharges,
      speak,
      resultRef,
      setStatuteUrl
    );
  };

  return (
    <div className="glass-panel mb-4 border-l-4 border-l-lark-light-blue">
      <h3 className="lark-section-title">RS CODE REFERENCE</h3>
      <div className="text-sm font-medium mb-1 text-lark-light-blue">
        {statute}
      </div>
      <div className="text-xs text-slate-800 mb-3 font-medium">
        {description}
      </div>
      <button 
        onClick={handleStatuteLookupLocal}
        className="px-3 py-1.5 text-xs bg-lark-light-blue/20 hover:bg-lark-light-blue/30 text-white rounded-md transition-colors"
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Lookup Statute'}
      </button>
      
      {/* Hidden result container for scrolling */}
      <div ref={resultRef} className="hidden"></div>
      
      {/* Show results if available */}
      {result && (
        <div className="mt-3 p-2 bg-slate-100 rounded text-xs text-slate-800 border border-slate-200">
          {result}
          {statuteUrl && (
            <a href={statuteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-2">
              <small>View Statute</small>
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default StatuteDatabase;
