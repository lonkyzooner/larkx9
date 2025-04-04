
import React from 'react';
import { Mic } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onClick }) => {
  return (
    <button 
      className={`record-button ${isRecording ? 'active' : ''} w-16 h-16 rounded-full 
                 bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg
                 hover:shadow-xl hover:scale-105 transition-all duration-300`} 
      onClick={onClick}
      aria-label="Activate LARK"
    >
      <div className="flex flex-col items-center justify-center">
        <Mic size={24} className={isRecording ? 'text-white animate-pulse' : 'text-white'} />
        <span className="text-xs mt-1 font-medium">{isRecording ? 'Listening...' : 'LARK'}</span>
      </div>
      {isRecording && <div className="listening-indicator absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white animate-pulse"></div>}
    </button>
  );
};

export default RecordButton;
