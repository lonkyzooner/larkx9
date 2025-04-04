import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    AudioContext: any;
    webkitAudioContext: any;
  }
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [hasRecognitionSupport] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const [error, setError] = useState<string | null>(null);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  
  // Use refs to maintain state between renders
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wakeWordRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  
  // Refs for handling retry logic
  const recognitionAttempts = useRef(0);
  const lastRestartTime = useRef(Date.now());
  
  // Track duplicate command processing
  const lastCommandTimeRef = useRef(0);
  const lastCommandRef = useRef('');
  
  // Ref to track if we're currently processing audio to prevent duplicate processing
  const processingAudioRef = useRef(false);

  // Debug logging function
  const logDebug = useCallback((message: string, ...args: any[]) => {
    console.log(`[SpeechRecognition] ${message}`, ...args);
    // Also dispatch a debug event for monitoring
    window.dispatchEvent(new CustomEvent('lark-debug', {
      detail: { type: 'speech', message, args }
    }));
  }, []);

  // Audio event handlers - define these first to avoid reference issues
  const handleAudioStart = useCallback(() => {
    console.log('Audio input started');
    setError(null);
    // Reset recognition attempts on successful audio start
    recognitionAttempts.current = 0;
    
    // Flash visual indicator that audio is active
    window.dispatchEvent(new CustomEvent('lark-audio-detected'));
    
    // Dispatch event for UI feedback
    window.dispatchEvent(new CustomEvent('lark-audio-started'));
  }, []);

  const handleSoundStart = useCallback(() => {
    console.log('Sound detected');
    // Dispatch event for UI feedback
    window.dispatchEvent(new CustomEvent('lark-sound-detected'));
  }, []);

  const handleSoundEnd = useCallback(() => {
    console.log('Sound ended');
    window.dispatchEvent(new CustomEvent('lark-sound-ended'));
  }, []);

  const handleNoMatch = useCallback(() => {
    console.log('No speech was recognized');
    // Don't set error for no match - this happens frequently and shouldn't be shown as an error
    window.dispatchEvent(new CustomEvent('lark-no-match'));
  }, []);

  // Enhanced result handler with wake word detection and alternatives
  const handleResult = useCallback((event: SpeechRecognitionEvent) => {
    // Flash visual indicator that audio is being processed
    window.dispatchEvent(new CustomEvent('lark-audio-detected'));
    
    // Prevent re-entry if we're already processing
    if (processingAudioRef.current) {
      return;
    }
    
    processingAudioRef.current = true;
    
    try {
      if (!event.results || event.results.length === 0) {
        processingAudioRef.current = false;
        return;
      }
      
      const results = Array.from(event.results) as SpeechRecognitionResult[];
      const lastResult = results[results.length - 1];
      
      // Process interim results for faster wake word detection
      if (!lastResult?.isFinal) {
        // Get the transcript from the first alternative of the interim result
        const interimTranscript = lastResult[0]?.transcript?.toLowerCase().trim() || '';
        
        // Log interim transcript for debugging
        if (interimTranscript.length > 2) {
          console.log('Interim transcript:', interimTranscript);
          
          // Dispatch event for interim results for UI feedback
          window.dispatchEvent(new CustomEvent('lark-interim-transcript', {
            detail: { transcript: interimTranscript }
          }));
          
          // Also update React state
          setTranscript(interimTranscript);
        }
        
        // Enhanced wake word detection with regular expressions for more flexibility
        const wakeWordPatterns = [
          /\\bhey\\s*l+a*r+k\\b/i,  // hey lark with variations
          /\\bhi\\s*l+a*r+k\\b/i,   // hi lark with variations
          /\\bhello\\s*l+a*r+k\\b/i, // hello lark with variations
          /\\bcl+a*r+k\\b/i,      // clark with variations
          /\\b(hey|hi|hello)?\\s*la*r+[ck]\\b/i, // lark/larc with optional hey/hi/hello
          /\\bla+r+k\\b/i,        // lark with variations
          /\\bl+a*r+k\\b/i        // just lark on its own
        ];
        
        // More flexible detection using regex patterns
        if (!wakeWordRef.current && !wakeWordDetected) {
          // Test each pattern against the transcript
          let foundWakeWord = false;
          let matchedPattern = '';
          
          for (const pattern of wakeWordPatterns) {
            if (pattern.test(interimTranscript)) {
              foundWakeWord = true;
              matchedPattern = interimTranscript.match(pattern)?.[0] || 'lark';
              break;
            }
          }
          
          // Fallback for phonetically similar phrases
          if (!foundWakeWord) {
            // Check for words that sound like lark (mark, bark, dark, etc.)
            const phoneticallyClose = [
              /\\b[bmd]ar+k\\b/i, // bark, mark, dark
              /\\bla+r+[gctp]\\b/i, // larg, larc, lart, larp
              /\\bcla+r+[kc]\\b/i // clark, clarc
            ];
            
            for (const pattern of phoneticallyClose) {
              if (pattern.test(interimTranscript)) {
                foundWakeWord = true;
                matchedPattern = interimTranscript.match(pattern)?.[0] || 'lark-like';
                console.log('Phonetic match found:', matchedPattern, 'in', interimTranscript);
                break;
              }
            }
            
            // Last resort - check if the transcript contains anything remotely like 'lark'
            if (!foundWakeWord && interimTranscript.length > 0) {
              // Very loose pattern to catch severely misrecognized attempts
              if (/l[a-z]*r[a-z]*|[a-z]*ark|[a-z]*ar[ck]/i.test(interimTranscript)) {
                const possibleMatch = interimTranscript.match(/l[a-z]*r[a-z]*|[a-z]*ark|[a-z]*ar[ck]/i)?.[0];
                console.log('Loose match found:', possibleMatch, 'in', interimTranscript);
                
                // Only accept if it's reasonably close
                if (possibleMatch && possibleMatch.length < 8) {
                  foundWakeWord = true;
                  matchedPattern = possibleMatch;
                }
              }
            }
          }
          
          if (foundWakeWord) {
            console.log('Wake word detected in interim!', interimTranscript, 'Matched:', matchedPattern);
            wakeWordRef.current = true;
            setWakeWordDetected(true);
            
            // Play audio confirmation
            try {
              const audio = new Audio('/sounds/activation.mp3');
              audio.volume = 0.7;
              audio.play().catch(e => console.error('Failed to play activation sound', e));
            } catch (e) {
              console.error('Error creating audio', e);
            }
            
            // Force restart recognition to ensure clean state for command detection
            try {
              if (recognitionRef.current) {
                // Schedule a restart to ensure we get a fresh recognition session
                setTimeout(() => {
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                      setTimeout(() => {
                        initializeRecognition();
                        if (recognitionRef.current) {
                          recognitionRef.current.start();
                          console.log('Recognition restarted after wake word detection');
                        }
                      }, 100);
                    } catch (err) {
                      console.error('Error restarting recognition after wake word:', err);
                    }
                  }
                }, 1000); // Wait 1 second to allow for command detection
              }
            } catch (restartErr) {
              console.error('Failed to restart recognition after wake word:', restartErr);
            }
            
            // Log match for debugging
            window.dispatchEvent(new CustomEvent('lark-debug', {
              detail: { type: 'wake-word', transcript: interimTranscript, match: matchedPattern }
            }));
            
            // Clear transcript to start fresh for command
            setTranscript('');
            
            // Trigger wake word detection event
            window.dispatchEvent(new CustomEvent('lark-wake-word-detected'));
          }
        }
        
        processingAudioRef.current = false;
        return; // Don't process further for interim results
      }
      
      // Process final results
      // Get all alternatives for the final result
      const alternatives: SpeechRecognitionAlternative[] = [];
      for (let i = 0; i < lastResult.length; i++) {
        alternatives.push(lastResult[i]);
      }
      
      // Get the best transcript
      let bestTranscript = alternatives[0]?.transcript?.toLowerCase().trim() || '';
      
      // Log the final transcript and alternatives
      console.log('Final transcript:', bestTranscript);
      if (alternatives.length > 1) {
        console.log('Alternatives:', alternatives.slice(1).map(a => `${a.transcript} (${a.confidence.toFixed(2)})`));
      }
      
      // Check if we have a valid transcript and wake word was detected
      if (bestTranscript && (wakeWordRef.current || wakeWordDetected)) {
        // Reset the wake word detection state for next interaction
        wakeWordRef.current = false;
        setWakeWordDetected(false);
        
        // Check for duplicate command (prevent processing the same command multiple times)
        const now = Date.now();
        const timeSinceLastCommand = now - lastCommandTimeRef.current;
        
        // Only process if it's not a duplicate within 2 seconds or it's a different command
        if (timeSinceLastCommand > 2000 || lastCommandRef.current !== bestTranscript) {
          // Update the last command details
          lastCommandTimeRef.current = now;
          lastCommandRef.current = bestTranscript;
          
          // Trigger command event
          console.log('Command detected:', bestTranscript);
          window.dispatchEvent(new CustomEvent('lark-command-detected', {
            detail: { command: bestTranscript, alternatives: alternatives.slice(1).map(a => a.transcript) }
          }));
          
          // Reset transcript after command is processed
          setTranscript('');
        } else {
          console.log('Ignoring duplicate command');
        }
      }
      
      // Reset processing state
      processingAudioRef.current = false;
    } catch (error) {
      console.error('Error processing speech recognition result:', error);
      processingAudioRef.current = false;
    }
  }, [wakeWordDetected]);
  
  // Handle recognition ending
  const handleEnd = useCallback(() => {
    console.log('Speech recognition ended');
    setListening(false);
    
    // Auto-restart recognition if it wasn't manually stopped
    if (!manualStopRef.current) {
      console.log('Auto-restarting recognition...');
      
      // Use exponential backoff for restarts to prevent browser throttling
      const backoffTime = Math.min(restartAttemptsRef.current * 300, 3000);
      restartAttemptsRef.current++;
      
      // Schedule restart with backoff
      restartTimeoutRef.current = setTimeout(() => {
        if (!listening) { // Make sure we actually need to restart
          console.log(`Restarting after ${backoffTime}ms backoff`);
          startListening();
        }
      }, backoffTime);
    } else {
      console.log('Not auto-restarting, manual stop or processing in progress');
      // Reset restart attempts on manual stop
      restartAttemptsRef.current = 0;
    }
  }, [listening]);
  
  // Handle recognition errors
  const handleError = useCallback((event: any) => {
    const errorMessage = event.error || 'Unknown speech recognition error';
    console.error('Speech recognition error:', errorMessage);
    
    // Dispatch error event for UI feedback
    window.dispatchEvent(new CustomEvent('lark-recognition-error', {
      detail: { error: errorMessage }
    }));
    
    // Set application-level error state
    setError(errorMessage);
    setListening(false);
    
    // Auto-restart on recoverable errors
    if (['network', 'aborted', 'no-speech', 'audio-capture'].includes(event.error)) {
      // Don't restart immediately to prevent rapid cycling
      setTimeout(() => {
        if (!manualStopRef.current) {
          console.log('Attempting to restart after error:', event.error);
          startListening();
        }
      }, 2000);
    }
  }, []);

  // Helper function to handle recognition start errors with exponential backoff
  const handleRecognitionStartError = useCallback((error: any) => {
    setListening(false);
    
    // Calculate backoff time based on number of attempts
    const currentTime = Date.now();
    const timeSinceLastRestart = currentTime - lastRestartTime.current;
    
    // Reset attempt counter if it's been a while since the last attempt
    if (timeSinceLastRestart > 30000) { // 30 seconds
      recognitionAttempts.current = 0;
    }
    
    // Increment attempt counter
    recognitionAttempts.current++;
    
    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    const backoffTime = Math.min(Math.pow(2, recognitionAttempts.current - 1) * 1000, 10000);
    
    console.log(`Scheduling restart attempt ${recognitionAttempts.current} in ${backoffTime}ms`);
    
    // Set appropriate error message
    if (recognitionAttempts.current <= 3) {
      setError('Initializing voice recognition...');
    } else {
      setError('Having trouble with voice recognition. Please check your microphone settings.');
    }
    
    // Clear any existing timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    // Schedule restart with backoff
    restartTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to restart speech recognition after error...');
      lastRestartTime.current = Date.now();
      
      try {
        // Re-initialize and start
        initializeRecognition();
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setListening(true);
          setError(null);
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        // If we keep failing, will retry with longer backoff
        handleRecognitionStartError(retryError);
      }
    }, backoffTime);
  }, []);
  
  // Initialize recognition instance with enhanced configuration
  const initializeRecognition = useCallback(() => {
    if (!hasRecognitionSupport) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Always create a fresh instance
      if (recognitionRef.current) {
        try {
          // Remove all event listeners first
          recognitionRef.current.removeEventListener('result', handleResult);
          recognitionRef.current.removeEventListener('end', handleEnd);
          recognitionRef.current.removeEventListener('error', handleError);
          recognitionRef.current.removeEventListener('audiostart', handleAudioStart);
          recognitionRef.current.removeEventListener('soundstart', handleSoundStart);
          recognitionRef.current.removeEventListener('soundend', handleSoundEnd);
          recognitionRef.current.removeEventListener('nomatch', handleNoMatch);
          
          // Forcefully abort existing instance
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore abort errors
          console.log('Error cleaning up previous recognition instance:', e);
        }
        
        recognitionRef.current = null;
      }

      // Try to use the standard SpeechRecognition API if available, otherwise fall back to webkitSpeechRecognition
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        throw new Error('SpeechRecognition API not supported in this browser');
      }
      
      const recognition = new SpeechRecognitionAPI();
      
      // Enhanced configuration for better voice detection
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = true; // Enable interim results for faster feedback
      recognition.maxAlternatives = 5; // More alternatives for better wake word detection
      recognition.lang = 'en-US';
      
      // Force the browser to be more sensitive to audio input if supported
      try {
        // @ts-ignore - Some browsers support additional properties
        if (typeof recognition.audioThreshold !== 'undefined') {
          // @ts-ignore
          recognition.audioThreshold = 0.05; // Much lower threshold for maximum sensitivity
        }
      } catch (e) {
        console.log('Browser does not support audioThreshold adjustment');
      }

      // Store the new instance
      recognitionRef.current = recognition;
      
      // Add all event listeners
      recognition.addEventListener('result', handleResult);
      recognition.addEventListener('end', handleEnd);
      recognition.addEventListener('error', handleError);
      recognition.addEventListener('audiostart', handleAudioStart);
      recognition.addEventListener('soundstart', handleSoundStart);
      recognition.addEventListener('soundend', handleSoundEnd);
      recognition.addEventListener('nomatch', handleNoMatch);
      
      setError(null);
      
      window.dispatchEvent(new CustomEvent('lark-recognition-initialized'));
      return recognition;
    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setError('Failed to initialize speech recognition');
      return null;
    }
  }, [handleResult, handleEnd, handleError, handleAudioStart, handleSoundStart, handleSoundEnd, handleNoMatch, hasRecognitionSupport]);

  // Track microphone permission status to prevent repeated requests
  const micPermissionRef = useRef<'granted' | 'denied' | 'unknown'>('unknown');
  
  // Start listening for speech
  const startListening = useCallback(() => {
    if (!hasRecognitionSupport) {
      console.error('Cannot start - speech recognition not supported');
      return;
    }
    
    // If we're already listening, no need to restart
    if (listening && recognitionRef.current) {
      console.log('Already listening, no need to restart');
      return;
    }
    
    // If we've already tried and failed to get microphone permission, don't spam requests
    if (micPermissionRef.current === 'denied') {
      console.log('Microphone permission previously denied, not requesting again');
      setError('Microphone access denied. Please click the microphone button to try again.');
      
      // Notify UI that we need explicit permission
      window.dispatchEvent(new CustomEvent('lark-microphone-error', {
        detail: { message: 'Microphone permission denied. Please click the microphone button.' }
      }));
      return;
    }

    try {
      // Initialize a fresh instance each time
      initializeRecognition();
      
      if (!recognitionRef.current) {
        console.error('Failed to create recognition instance');
        return;
      }

      console.log('Starting speech recognition...');
      manualStopRef.current = false;
      processingAudioRef.current = false;
      
      // Create a more resilient microphone access approach
      const requestMicrophoneAccess = () => {
        // Check localStorage first to see if we've already been granted permission
        const storedPermission = localStorage.getItem('lark_microphone_permission');
        if (storedPermission === 'granted') {
          micPermissionRef.current = 'granted';
        }
        
        // Dispatch event that we're requesting microphone
        window.dispatchEvent(new CustomEvent('lark-requesting-microphone'));
        
        // Request microphone permission explicitly to ensure it's granted
        navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
          .then(() => {
            console.log('Microphone permission granted');
            micPermissionRef.current = 'granted';
            localStorage.setItem('lark_microphone_permission', 'granted');
            
            // Start recognition after ensuring microphone access
            try {
              if (recognitionRef.current) {
                recognitionRef.current.start();
                setListening(true);
                setError(null);
                
                // Reset wake word detection state to ensure fresh start
                wakeWordRef.current = false;
                setWakeWordDetected(false);
                
                // Dispatch event that listening has started
                window.dispatchEvent(new CustomEvent('lark-listening-started'));
                
                // Trigger periodic audio level detection for UI feedback
                startAudioLevelDetection();
              } else {
                console.error('Recognition instance was lost');
                initializeRecognition();
                // Try once more
                if (recognitionRef.current) {
                  recognitionRef.current.start();
                  setListening(true);
                }
              }
            } catch (startError) {
              console.error('Error starting recognition after permission granted', startError);
              // Handle the initial start error
              handleRecognitionStartError(startError);
            }
          })
          .catch(err => {
            console.error('Microphone access denied:', err);
            micPermissionRef.current = 'denied';
            localStorage.setItem('lark_microphone_permission', 'denied');
            setError('Microphone access denied. Please enable microphone access in your browser settings and click the microphone button to try again.');
            setListening(false);
            
            // Dispatch microphone error event with more details
            window.dispatchEvent(new CustomEvent('lark-microphone-error', {
              detail: { error: err, message: 'Please click the microphone button to grant permission' }
            }));
          });
      };
      
      // Check if we can access the microphone API
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        requestMicrophoneAccess();
      } else {
        // For browsers where permission API isn't available
        try {
          // Try to start directly
          if (recognitionRef.current) {
            recognitionRef.current.start();
            setListening(true);
            setError(null);
            console.log('Starting recognition without explicit permission check');
          }
        } catch (directStartError) {
          console.error('Direct start error:', directStartError);
          setError('Please allow microphone access when prompted by your browser');
        }
      }
    } catch (error) {
      console.error('Speech recognition start error:', error);
      handleRecognitionStartError(error);
    }
  }, [hasRecognitionSupport, initializeRecognition, listening]);

  // Stop listening for speech
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      console.log('Stopping speech recognition...');
      manualStopRef.current = true;
      recognitionRef.current.stop();
      setListening(false);
      
      // Clear any pending restart
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      
      // Reset wake word detection
      wakeWordRef.current = false;
      setWakeWordDetected(false);
      
      // Dispatch event that listening has stopped
      window.dispatchEvent(new CustomEvent('lark-listening-stopped'));
    } catch (error) {
      console.error('Speech recognition stop error:', error);
      setListening(false);
    }
  }, []);

  // Start detecting audio levels for UI feedback
  const startAudioLevelDetection = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('AudioContext not supported, audio level detection disabled');
        return;
      }
      
      const audioContext = new AudioContext();
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const analyser = audioContext.createAnalyser();
          const microphone = audioContext.createMediaStreamSource(stream);
          microphone.connect(analyser);
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          const checkAudioLevel = () => {
            if (!listening) {
              try {
                // Clean up when not listening
                audioContext.close();
              } catch (e) {
                // Ignore close errors
              }
              return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            if (average > 20) { // Lower threshold for better sensitivity
              // Audio detected, dispatch event
              window.dispatchEvent(new CustomEvent('lark-audio-detected', {
                detail: { level: average }
              }));
            }
            
            // Check again after a delay if still listening
            if (listening) {
              requestAnimationFrame(checkAudioLevel);
            }
          };
          
          // Start checking audio levels
          checkAudioLevel();
        })
        .catch(err => {
          console.error('Error accessing audio stream for level detection:', err);
        });
    } catch (err) {
      console.error('Error setting up audio level detection:', err);
    }
  }, [listening]);

  // Auto-start speech recognition when hook is mounted
  useEffect(() => {
    if (hasRecognitionSupport) {
      console.log('Auto-starting speech recognition...');
      startListening();
      
      // Auto-restart after visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && !listening) {
          console.log('Page became visible, restarting speech recognition');
          startListening();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        // Clean up on unmount
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        stopListening();
      };
    }
  }, [hasRecognitionSupport, startListening, stopListening, listening]);

  return {
    transcript,
    listening,
    hasRecognitionSupport,
    error,
    startListening,
    stopListening,
    wakeWordDetected,
    setWakeWordDetected,
  };
}
