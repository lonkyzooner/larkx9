import React, { useState, useEffect, useRef } from 'react';
import Logo from '../components/Logo';
import StatusBar from '../components/StatusBar';
import RecordButton from '../components/RecordButton';
import CommandButton from '../components/CommandButton';
import { MirandaRights } from '../components/MirandaRights';
import StatuteDatabase from '../components/StatuteDatabase';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSimulatedTTS } from '../hooks/useSimulatedTTS.tsx';
import { handleCommand } from '../utils/commandProcessor';
import { OFFLINE_DATA } from '../utils/offlineData';
import { 
  Mic, Shield, Map, BookOpen, MessageSquare, 
  Settings, AlertOctagon, Vibrate, Phone,
  Radio, MapPin, Volume2, BookText
} from 'lucide-react';

const Index = () => {
  // State
  const [status, setStatus] = useState('LARK Ready');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [activeMiranda, setActiveMiranda] = useState(false);
  const [mirandaLanguage, setMirandaLanguage] = useState('english');
  const [activeStatute, setActiveStatute] = useState(false);
  const [statuteInfo, setStatuteInfo] = useState({ statute: '', description: '' });
  const [trainingMode, setTrainingMode] = useState(() => 
    localStorage.getItem('trainingMode') === 'true');
  const [voiceSpeed, setVoiceSpeed] = useState(() => 
    parseFloat(localStorage.getItem('voiceSpeed') || '1.0'));
  const [voiceVolume, setVoiceVolume] = useState(() => 
    parseFloat(localStorage.getItem('voiceVolume') || '0.8'));
  const [showDispatchConnect, setShowDispatchConnect] = useState(false);
  const [isVibrating, setIsVibrating] = useState(false);
  
  // Refs
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);
  
  // Hooks
  const speech = useSpeechRecognition();
  const tts = useSimulatedTTS();
  
  // Process speech recognition results
  useEffect(() => {
    if (speech.transcript && !speech.listening) {
      const command = speech.transcript;
      
      // Check if the command starts with "LARK" or "Hey LARK"
      if (command.toLowerCase().trim().startsWith('lark') || 
          command.toLowerCase().trim().startsWith('hey lark')) {
        processVoiceCommand(command);
      } else {
        // If not started with LARK, ignore
        setStatus('Command not recognized. Start with "LARK" or "Hey LARK"');
      }
    }
  }, [speech.transcript, speech.listening]);
  
  // Initialize audio elements
  useEffect(() => {
    alertSoundRef.current = new Audio();
    alertSoundRef.current.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAA//////////8=';
    
    return () => {
      if (alertSoundRef.current) {
        alertSoundRef.current.pause();
      }
    };
  }, []);
  
  // On mount, speak welcome message
  useEffect(() => {
    const welcomeUser = async () => {
      await tts.speak('LARK Ready', { volume: voiceVolume });
    };
    
    welcomeUser();
    
    // Load settings from localStorage
    const lowPowerMode = localStorage.getItem('lowPowerMode') === 'true';
    const highContrastMode = localStorage.getItem('highContrastMode') === 'true';
    
    if (lowPowerMode) {
      document.body.classList.add('low-power');
    }
    
    if (highContrastMode) {
      document.body.classList.add('high-contrast');
    }
  }, []);
  
  // Process voice commands
  const processVoiceCommand = async (command: string) => {
    // Add command to history
    setCommandHistory(prev => [...prev, command]);
    
    // Update status
    setStatus(`Processing: ${command}`);
    
    // Process the command
    try {
      const result = await handleCommand(command, trainingMode);
      
      // Handle system commands
      if (result.intent === 'enable_training') {
        setTrainingMode(true);
        localStorage.setItem('trainingMode', 'true');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'disable_training') {
        setTrainingMode(false);
        localStorage.setItem('trainingMode', 'false');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'set_voice_speed') {
        const newSpeed = command.toLowerCase().includes('slow') ? 0.8 : 
                        command.toLowerCase().includes('fast') ? 1.2 : 1.0;
        setVoiceSpeed(newSpeed);
        localStorage.setItem('voiceSpeed', newSpeed.toString());
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'set_volume') {
        const newVolume = command.toLowerCase().includes('low') ? 0.3 : 
                         command.toLowerCase().includes('high') ? 0.8 : 0.5;
        setVoiceVolume(newVolume);
        localStorage.setItem('voiceVolume', newVolume.toString());
        await tts.speak(result.response || '', { volume: newVolume });
        return;
      }
      
      if (result.intent === 'enable_low_power') {
        document.body.classList.add('low-power');
        localStorage.setItem('lowPowerMode', 'true');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'disable_low_power') {
        document.body.classList.remove('low-power');
        localStorage.setItem('lowPowerMode', 'false');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'enable_high_contrast') {
        document.body.classList.add('high-contrast');
        localStorage.setItem('highContrastMode', 'true');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      if (result.intent === 'disable_high_contrast') {
        document.body.classList.remove('high-contrast');
        localStorage.setItem('highContrastMode', 'false');
        await tts.speak(result.response || '', { volume: voiceVolume });
        return;
      }
      
      // Handle regular commands
      if (result.intent === 'miranda_rights') {
        setActiveMiranda(true);
        setMirandaLanguage(result.language || 'english');
        await tts.speak(result.text || '', { volume: voiceVolume });
        setActiveMiranda(false);
      } 
      else if (result.intent === 'statute_lookup') {
        setActiveStatute(true);
        setStatuteInfo({
          statute: result.statute || '',
          description: result.description || ''
        });
        await tts.speak(`${result.statute}, ${result.description}`, { volume: voiceVolume });
      } 
      else if (result.intent === 'procedural_reminder') {
        const steps = result.steps?.join('. ') || '';
        await tts.speak(steps, { volume: voiceVolume });
      } 
      else if (result.intent === 'alert_partner') {
        // Play alert sound
        if (alertSoundRef.current) {
          alertSoundRef.current.play();
        }
        setIsVibrating(true);
        await tts.speak(result.response || '', { volume: voiceVolume });
        setTimeout(() => setIsVibrating(false), 2000);
      } 
      else if (result.intent === 'dispatch_connect') {
        setShowDispatchConnect(true);
        await tts.speak(result.response || '', { volume: voiceVolume });
        setTimeout(() => setShowDispatchConnect(false), 5000);
      } 
      else if (result.intent === 'log_suspect') {
        // Log to localStorage
        const logs = JSON.parse(localStorage.getItem('suspectLogs') || '[]');
        logs.push(result.text);
        localStorage.setItem('suspectLogs', JSON.stringify(logs));
        await tts.speak(result.response || '', { volume: voiceVolume });
      } 
      else if (result.intent === 'training_mode') {
        await tts.speak(result.response || '', { volume: voiceVolume });
      } 
      else if (result.intent === 'general_feedback' || result.intent === 'threat_detection') {
        await tts.speak(result.response || '', { volume: voiceVolume });
      } 
      else if (result.intent === 'ai_response') {
        await tts.speak(result.response || '', { volume: voiceVolume });
      }
      else if (result.intent === 'unknown_command') {
        await tts.speak(result.response || '', { volume: voiceVolume });
      }
      
      // Update status with the response
      setStatus(result.response || 'Command processed');
    } catch (error) {
      console.error('Error processing command:', error);
      setStatus('Error processing command');
      await tts.speak('Error processing command. Please try again.', { volume: voiceVolume });
    }
  };
  
  // Start listening for voice commands
  const startListening = () => {
    if (speech.hasRecognitionSupport) {
      setStatus('Listening...');
      speech.startListening();
      // Speak activation confirmation
      tts.speak('LARK activated', { volume: voiceVolume });
    } else {
      setStatus('Speech recognition not supported');
    }
  };
  
  // Render special effects
  const renderSpecialEffects = () => {
    return (
      <>
        {showDispatchConnect && (
          <div className="dispatch-connect">
            <div className="dispatch-connect-content">
              <div className="text-center mb-4 text-lark-light-blue font-medium">
                DISPATCH CONNECT
              </div>
              <div className="flex justify-center items-center space-x-2">
                <div className="relative">
                  <Phone size={24} className="text-lark-light-blue animate-pulse" />
                  <div className="pulse-ring"></div>
                </div>
                <div className="text-sm">Connecting to dispatch...</div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-lark-dark to-[#0a0a14] text-white p-4 ${isVibrating ? 'animate-vibrate' : ''}`}>
      <div className="container mx-auto max-w-md">
        <Logo listening={speech.listening} />
        <StatusBar status={status} />
        
        {/* Miranda Rights Display */}
        {activeMiranda && (
          <div className="mb-4">
            <MirandaRights />
          </div>
        )}
        
        {/* Statute Database Display */}
        {activeStatute && (
          <StatuteDatabase statute={statuteInfo.statute} description={statuteInfo.description} />
        )}
        
        {/* Command History */}
        {commandHistory.length > 0 && (
          <div className="glass-panel mb-4 rounded-xl backdrop-blur-md bg-white/5 border border-white/10">
            <h3 className="lark-section-title text-lg">COMMAND HISTORY</h3>
            <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {commandHistory.slice(-5).map((cmd, index) => (
                <div key={index} className="command-history-item">
                  {cmd}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Common Commands */}
        <div className="lark-section">
          <h3 className="lark-section-title text-lg">COMMON COMMANDS</h3>
          <div className="grid grid-cols-2 gap-2">
            <CommandButton 
              icon={Mic} 
              label="Miranda Rights" 
              onClick={() => processVoiceCommand("LARK, read miranda rights")} 
            />
            <CommandButton 
              icon={BookText} 
              label="RS Codes" 
              onClick={() => processVoiceCommand("LARK, what's the penalty for theft?")} 
            />
            <CommandButton 
              icon={AlertOctagon} 
              label="Assess Risk" 
              onClick={() => processVoiceCommand("LARK, assess risk")} 
            />
            <CommandButton 
              icon={Phone} 
              label="Dispatch Connect" 
              onClick={() => processVoiceCommand("LARK, dispatch connect")} 
            />
          </div>
        </div>
        
        {/* Tactical Options */}
        <div className="lark-section">
          <h3 className="lark-section-title text-lg">TACTICAL OPTIONS</h3>
          <div className="grid grid-cols-2 gap-2">
            <CommandButton 
              icon={MapPin} 
              label="AR Path" 
              onClick={() => processVoiceCommand("LARK, activate AR path")} 
            />
            <CommandButton 
              icon={Volume2} 
              label="Sonic Disrupter" 
              onClick={() => processVoiceCommand("LARK, arm sonic disrupter")} 
            />
            <CommandButton 
              icon={AlertOctagon} 
              label="Alert Partner" 
              onClick={() => processVoiceCommand("LARK, alert partner")} 
            />
            <CommandButton 
              icon={Radio} 
              label="Tactical Comm" 
              onClick={() => processVoiceCommand("LARK, open tactical communications")} 
            />
          </div>
        </div>
        
        {/* Settings */}
        <div className="lark-section">
          <h3 className="lark-section-title text-lg">SETTINGS</h3>
          <div className="grid grid-cols-2 gap-2">
            <CommandButton 
              icon={Settings} 
              label={`Training: ${trainingMode ? 'ON' : 'OFF'}`} 
              onClick={() => processVoiceCommand(`LARK, ${trainingMode ? 'disable' : 'enable'} training mode`)} 
            />
            <CommandButton 
              icon={Shield} 
              label="High Contrast" 
              onClick={() => processVoiceCommand("LARK, enable high contrast")} 
            />
          </div>
        </div>
        
        {/* Voice Activation Button */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center">
          <RecordButton 
            isRecording={speech.listening} 
            onClick={startListening} 
          />
        </div>
        
        {/* Special Effects */}
        {renderSpecialEffects()}
      </div>
    </div>
  );
};

export default Index;
