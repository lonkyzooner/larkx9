import React, { useEffect, useState } from 'react';
import { commandPredictor } from '../lib/command-predictor';
import { commandAnalytics } from '../lib/command-analytics';
import { useVoiceFeedback } from '../hooks/useVoiceFeedback';

interface CommandSuggestion {
  command: string;
  confidence: number;
  context: string;
}

export const SmartCommandSuggestions: React.FC<{
  onSuggestionSelect: (command: string) => void;
  isListening: boolean;
}> = ({ onSuggestionSelect, isListening }) => {
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const { generateAudioFeedback } = useVoiceFeedback();
  
  useEffect(() => {
    if (isListening) {
      const predictions = commandPredictor.predictNextCommand();
      setSuggestions(predictions);
    }
  }, [isListening]);
  
  const handleSuggestionClick = async (suggestion: CommandSuggestion) => {
    // Use Josh voice to acknowledge the selection
    await generateAudioFeedback('acknowledge', `Executing command: ${suggestion.command}`);
    onSuggestionSelect(suggestion.command);
    
    // Record the suggestion usage
    commandAnalytics.recordCommand({
      command: suggestion.command,
      success: true,
      responseTime: 0,
      confidence: suggestion.confidence,
      offline: false
    });
  };
  
  if (!isListening || suggestions.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 left-4 p-4 bg-gray-800 rounded-lg shadow-lg max-w-md">
      <h3 className="text-white text-lg font-semibold mb-2">Suggested Commands</h3>
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            className="w-full flex items-center justify-between p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <div className="flex-1">
              <p className="text-white text-left">{suggestion.command}</p>
              <p className="text-gray-400 text-sm text-left">{suggestion.context}</p>
            </div>
            <div className="ml-2 px-2 py-1 bg-gray-600 rounded">
              {Math.round(suggestion.confidence * 100)}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
