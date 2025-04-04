import React, { useState, useCallback, useEffect } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Loader2, Volume, AlertCircle, Mic, MicOff, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Voice options
const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'ash', label: 'Ash' }
];

// Default text for testing
const DEFAULT_TEXT = "Hello, I am LARK, your Law Enforcement Assistance and Response Kit. I'm here to provide real-time support and information. How can I assist you today?";

/**
 * LiveKitRealtimeVoiceTest - Component for testing LiveKit voice synthesis integration
 */
const LiveKitRealtimeVoiceTest: React.FC = () => {
  // State
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<string>('ash');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('test');

  // Get Voice context
  const {
    isSpeaking,
    synthesisState,
    micPermission,
    requestMicrophonePermission,
    speak,
    stopSpeaking,
    debugInfo
  } = useVoice();
  
  // Since VoiceContext doesn't have these properties that LiveKitVoiceContext had
  // We'll create local state to simulate them for the UI
  const [isConnected, setIsConnected] = useState<boolean>(true); // Assume connected
  const [roomName, setRoomName] = useState<string>('lark-voice-room');
  const [contextError, setContextError] = useState<any>(null);

  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  // Handle voice change
  const handleVoiceChange = useCallback((value: string) => {
    setSelectedVoice(value);
  }, []);

  // Handle speak button click
  const handleSpeak = useCallback(async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await speak(text, selectedVoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while speaking');
    } finally {
      setIsLoading(false);
    }
  }, [text, selectedVoice, speak]);

  // Handle stop button click
  const handleStop = useCallback(() => {
    stopSpeaking();
  }, [stopSpeaking]);

  // Handle microphone permission request
  const handleRequestMicPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await requestMicrophonePermission();
      if (!result) {
        setError('Microphone permission denied. Please enable microphone access in your browser settings.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while requesting microphone permission');
    } finally {
      setIsLoading(false);
    }
  }, [requestMicrophonePermission]);

  // Handle connect button click - simulated since we're using VoiceContext
  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate connection to LiveKit
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsConnected(true);
      setRoomName('lark-voice-room');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while connecting');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle disconnect button click - simulated since we're using VoiceContext
  const handleDisconnect = useCallback(() => {
    // Simulate disconnection from LiveKit
    setIsConnected(false);
    setRoomName('');
  }, []);

  // Get synthesis state label
  const getSynthesisStateLabel = useCallback(() => {
    switch (synthesisState) {
      case 'idle':
        return 'Idle';
      case 'synthesizing':
        return 'Synthesizing';
      case 'speaking':
        return 'Speaking';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }, [synthesisState]);

  // Get synthesis state color
  const getSynthesisStateColor = useCallback(() => {
    switch (synthesisState) {
      case 'idle':
        return 'bg-gray-500';
      case 'synthesizing':
        return 'bg-yellow-500';
      case 'speaking':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  }, [synthesisState]);

  // Render
  return (
    <div className="container mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">LiveKit Voice Test</CardTitle>
          <CardDescription>
            Test the LiveKit voice synthesis integration
          </CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="test">Voice Test</TabsTrigger>
              <TabsTrigger value="debug">Debug Info</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="test">
            <CardContent className="space-y-4 pt-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Microphone Permission Status */}
              <div className="mb-4 p-4 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Microphone Permission</h3>
                  {micPermission === 'granted' ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Mic className="h-3 w-3 mr-1" />
                      Granted
                    </Badge>
                  ) : micPermission === 'denied' ? (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      <MicOff className="h-3 w-3 mr-1" />
                      Denied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <Settings className="h-3 w-3 mr-1" />
                      {micPermission === 'prompt' ? 'Needs Permission' : 'Unknown'}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {micPermission === 'granted' 
                    ? 'Microphone access is granted. You can use voice features.' 
                    : micPermission === 'denied' 
                      ? 'Microphone access is denied. Please enable it in your browser settings.' 
                      : 'Microphone permission is required for voice features.'}
                </p>
                {micPermission !== 'granted' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRequestMicPermission}
                    disabled={isLoading || micPermission === 'denied'}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
                    Request Microphone Access
                  </Button>
                )}
              </div>
              
              {/* Connection status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                {isConnected && (
                  <Badge variant="outline">Room: {roomName}</Badge>
                )}
              </div>
              
              {/* Connection buttons */}
              <div className="flex space-x-2">
                <Button 
                  onClick={handleConnect} 
                  disabled={isConnected || isLoading || micPermission === 'denied'}
                  className="flex-1"
                  title={micPermission === 'denied' ? 'Microphone permission required' : undefined}
                >
                  {isLoading && !isConnected ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Connect
                </Button>
                
                <Button 
                  onClick={handleDisconnect} 
                  disabled={!isConnected || isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  Disconnect
                </Button>
              </div>
              
              {/* Voice selection */}
              <div className="space-y-2">
                <Label htmlFor="voice-select">Voice</Label>
                <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                  <SelectTrigger id="voice-select">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice.value} value={voice.value}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Text input */}
              <div className="space-y-2">
                <Label htmlFor="text-input">Text to speak</Label>
                <Textarea
                  id="text-input"
                  placeholder="Enter text to speak..."
                  value={text}
                  onChange={handleTextChange}
                  rows={5}
                  className="resize-none"
                />
              </div>
              
              {/* Synthesis state */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Synthesis State</Label>
                  <Badge variant="outline">{getSynthesisStateLabel()}</Badge>
                </div>
                <Progress value={isSpeaking ? 100 : 0} className={getSynthesisStateColor()} />
              </div>
              
              {/* Error message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-between">
              <Button 
                onClick={handleSpeak} 
                disabled={!isConnected || isLoading || !text.trim() || isSpeaking || micPermission === 'denied'}
                className="flex-1 mr-2"
                title={micPermission === 'denied' ? 'Microphone permission required' : undefined}
              >
                {isLoading && !isSpeaking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume className="mr-2 h-4 w-4" />}
                Speak
              </Button>
              
              <Button 
                onClick={handleStop} 
                disabled={!isSpeaking}
                variant="outline"
                className="flex-1"
              >
                Stop
              </Button>
            </CardFooter>
          </TabsContent>
          
          <TabsContent value="debug">
            <CardContent className="pt-4">
              <div className="space-y-2">
                <Label>Debug Information</Label>
                <div className="h-80 overflow-y-auto rounded border p-2 text-sm font-mono bg-gray-50">
                  {debugInfo.length === 0 ? (
                    <p className="text-gray-500 p-2">No debug information available. Connect to LiveKit to see debug logs.</p>
                  ) : (
                    <div>
                      {/* Connection Info */}
                      <div className="mb-2 p-2 bg-blue-50 rounded">
                        <strong>Connection Status:</strong> {isConnected ? 'Connected' : 'Disconnected'}<br />
                        {isConnected && <><strong>Room:</strong> {roomName}<br /></>}
                        <strong>Microphone:</strong> {micPermission}<br />
                        <strong>Synthesis State:</strong> {getSynthesisStateLabel()}<br />
                      </div>
                      
                      {/* Debug Logs */}
                      <div className="border-t border-gray-200 pt-2">
                        <strong>Event Logs:</strong>
                        {debugInfo.map((message, index) => (
                          <div key={index} className="py-1 border-b border-gray-100 last:border-0 whitespace-pre-wrap">
                            {message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default LiveKitRealtimeVoiceTest;
