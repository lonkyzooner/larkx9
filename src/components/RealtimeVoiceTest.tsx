import React, { useState, useEffect } from 'react';
import VoiceContext from '../contexts/VoiceContext';
import { SynthesisState } from '../services/voice/OpenAIVoiceService'; // Using just the type
import { useContext } from 'react';
import { useLiveKitVoice } from '../contexts/LiveKitVoiceContext';
import { Button, Box, Typography, Alert, CircularProgress, Paper, Stack, Divider, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, LinearProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ErrorIcon from '@mui/icons-material/Error';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * Component for testing LiveKit Realtime Voice API
 */
const RealtimeVoiceTest: React.FC = () => {
  const voiceContext = useContext(VoiceContext);
  const liveKitVoice = useLiveKitVoice();
  
  // Use LiveKit voice service instead of OpenAI
  const { speak, stopSpeaking, isSpeaking, synthesisState } = liveKitVoice;
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [streamingProgress, setStreamingProgress] = useState<number | null>(null);

  // Sample texts for testing
  const sampleTexts = [
    "Hello, I am LARK, your Law Enforcement Assistant for Reconnaissance and Knowledge. How can I assist you today?",
    "The suspect is heading north on Main Street. Requesting backup at the intersection of Main and Oak Avenue.",
    "Miranda Warning: You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be provided for you."
  ];

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle voice change
  const handleVoiceChange = (event: SelectChangeEvent) => {
    setSelectedVoice(event.target.value);
  };

  // Handle streaming toggle
  const handleStreamingToggle = (event: SelectChangeEvent) => {
    setStreamingEnabled(event.target.value === 'true');
  };

  // Handle speak button click
  const handleSpeak = async (text: string) => {
    console.log('Attempting to speak:', text);
    // Request microphone permissions using LiveKit
    const micPermission = await liveKitVoice.requestMicrophonePermission();
    console.log('Microphone permission status:', micPermission);
    if (!micPermission) {
      alert('Microphone access is denied. Please enable it in your browser settings.');
      return;
    }

    setStreamingProgress(0);
    try {
      console.log('Starting speech synthesis with LiveKit...');
      // Connect to LiveKit if not already connected
      if (!liveKitVoice.isConnected) {
        await liveKitVoice.connect();
      }
      // Speak using LiveKit voice service
      await speak(text, selectedVoice);
      console.log('Speech synthesis successful.');
    } catch (error) {
      console.error('Error during speech synthesis:', error);
      alert('An error occurred during speech synthesis.');
    }
  };

  // Get status message based on synthesis state
  const getStatusMessage = (): string => {
    if (!isOnline) return 'Offline - Network connection required';
    
    switch (synthesisState) {
      case 'idle': return 'Ready';
      case 'synthesizing': return 'Synthesizing speech...';
      case 'speaking': return 'Speaking...';
      case 'error': return 'Error during speech synthesis';
      default: return 'Ready';
    }
  };

  // Get icon based on synthesis state
  const getStatusIcon = () => {
    if (!isOnline) return <WifiOffIcon color="error" />;
    
    switch (synthesisState) {
      case 'idle': return <CheckCircleIcon color="success" />;
      case 'synthesizing': return <CircularProgress size={24} />;
      case 'speaking': return <VolumeUpIcon color="primary" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <CheckCircleIcon color="success" />;
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4, bgcolor: '#121212', color: 'white' }}>
      <Typography variant="h4" gutterBottom align="center">
        OpenAI Realtime Voice Test
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel id="voice-select-label">Voice</InputLabel>
          <Select
            labelId="voice-select-label"
            value={selectedVoice}
            label="Voice"
            onChange={handleVoiceChange}
            sx={{ color: 'white' }}
          >
            <MenuItem value="alloy">Alloy</MenuItem>
            <MenuItem value="echo">Echo</MenuItem>
            <MenuItem value="fable">Fable</MenuItem>
            <MenuItem value="onyx">Onyx</MenuItem>
            <MenuItem value="nova">Nova</MenuItem>
            <MenuItem value="shimmer">Shimmer</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl fullWidth>
          <InputLabel id="streaming-select-label">Streaming</InputLabel>
          <Select
            labelId="streaming-select-label"
            value={streamingEnabled.toString()}
            label="Streaming"
            onChange={handleStreamingToggle}
            sx={{ color: 'white' }}
          >
            <MenuItem value="true">Enabled</MenuItem>
            <MenuItem value="false">Disabled</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sample Texts
        </Typography>
        <Stack spacing={2}>
          {sampleTexts.map((text, index) => (
            <Button 
              key={index}
              variant="contained" 
              color="primary"
              disabled={!isOnline || synthesisState === 'synthesizing' || synthesisState === 'speaking'}
              onClick={() => handleSpeak(text)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
            >
              {text.length > 60 ? `${text.substring(0, 60)}...` : text}
            </Button>
          ))}
        </Stack>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Custom Text
        </Typography>
        <textarea
          placeholder="Enter text to speak..."
          rows={4}
          style={{ 
            width: '100%', 
            padding: '10px',
            backgroundColor: '#1e1e1e',
            color: 'white',
            border: '1px solid #333',
            borderRadius: '4px'
          }}
          id="custom-text"
        />
        <Button 
          variant="contained" 
          color="primary"
          disabled={!isOnline || synthesisState === 'synthesizing' || synthesisState === 'speaking'}
          onClick={() => {
            const sampleText = "Hello, I am LARK, your Law Enforcement Assistance and Response Kit.";
            handleSpeak(sampleText);
          }}
          sx={{ mt: 1 }}
        >
          Speak Custom Text
        </Button>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {getStatusIcon()}
        <Typography variant="body1" sx={{ ml: 1 }}>
          Status: {getStatusMessage()}
        </Typography>
      </Box>
      
      {streamingProgress !== null && streamingProgress > 0 && (
        <Box sx={{ width: '100%', mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Streaming Progress
          </Typography>
          <LinearProgress variant="determinate" value={streamingProgress} />
        </Box>
      )}
      
      {synthesisState === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          An error occurred during voice synthesis
        </Alert>
      )}
      
      {!isOnline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are currently offline. Voice synthesis requires an internet connection.
        </Alert>
      )}
      
      {isSpeaking && (
        <Button 
          variant="outlined" 
          color="secondary"
          onClick={stopSpeaking}
          startIcon={<VolumeUpIcon />}
          sx={{ mt: 2 }}
        >
          Stop Speaking
        </Button>
      )}
    </Paper>
  );
};

export default RealtimeVoiceTest;
