import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message } from '../types/chat';
import { MessageBubble } from './MessageBubble';

interface VirtualMessageListProps {
  messages: Message[];
  onSpeakText: (text: string) => void;
}

export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({ 
  messages, 
  onSpeakText 
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  
  // Set up virtualizer
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 5, // Number of items to render outside of the visible area
  });
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);
  
  return (
    <div 
      ref={parentRef}
      className="flex-1 overflow-auto p-4 rounded-lg border border-gray-200 bg-white shadow-sm"
      style={{ height: '100%', maxHeight: 'calc(80vh - 180px)' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageBubble 
                message={message} 
                onSpeakText={onSpeakText} 
              />
            </div>
          );
        })}
      </div>
      <div ref={endRef} />
    </div>
  );
};
