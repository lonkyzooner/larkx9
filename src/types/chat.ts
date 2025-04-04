/**
 * Chat-related type definitions
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type ChatHistory = Message[];

export interface ChatState {
  messages: ChatHistory;
  isLoading: boolean;
  error: string | null;
}

export interface EmotionData {
  emotion: string;
  score: number;
}

export interface SentimentData {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}
