import React, { memo } from 'react';
import { VolumeIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Message } from '../types/chat';

interface MessageBubbleProps {
  message: Message;
  onSpeakText: (text: string) => void;
}

export const MessageBubble = memo(({ message, onSpeakText }: MessageBubbleProps) => {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 mr-2">
          <div className="w-10 h-10 rounded-full bg-[#003087] flex items-center justify-center text-white font-semibold shadow-md">
            L
          </div>
        </div>
      )}
      <div
        className={`max-w-[80%] p-4 rounded-lg shadow-sm ${
          message.role === 'user'
            ? 'bg-[#003087] text-white rounded-tr-none'
            : 'bg-gray-100 text-gray-900 rounded-tl-none'
        }`}
        data-message-id={message.timestamp.toString()}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.role === 'assistant' && (
          <div className="mt-3 flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => onSpeakText(message.content)}
                    className="text-xs text-gray-600 hover:text-[#003087] flex items-center bg-white px-2 py-1 rounded-full shadow-sm transition-colors"
                  >
                    <VolumeIcon className="h-3 w-3 mr-1" />
                    Listen
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Read this message aloud</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the message content or timestamp changes
  return prevProps.message.content === nextProps.message.content && 
         prevProps.message.timestamp === nextProps.message.timestamp;
});
