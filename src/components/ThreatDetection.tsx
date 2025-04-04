import React, { useState, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { useSimulatedTTS } from '../hooks/useSimulatedTTS';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { 
  AlertTriangle as AlertTriangleIcon, 
  Shield as ShieldIcon, 
  Eye as EyeIcon, 
  Activity as ActivityIcon, 
  Scan as ScanIcon, 
  Loader2,
  User as UserIcon,
  MapPin as MapPinIcon,
  Zap as ZapIcon
} from 'lucide-react';
import { assessTacticalSituation } from '../lib/openai-service';
import { groqService } from '../services/groq/GroqService';
import { openAIVoiceService } from '../services/voice/OpenAIVoiceService';

// Type definitions
interface ThreatLevel {
  level: 'low' | 'medium' | 'high';
  color: string;
  message: string;
}

type ThreatStatus = 'low' | 'medium' | 'high';

type SituationData = {
  timestamp: string;
  description: string;
  threatLevel: ThreatStatus;
  confidence: number;
};

interface ThreatDetectionProps {
  className?: string;
}

const THREATS: Record<string, ThreatLevel> = {
  weapon: {
    level: 'high',
    color: 'bg-red-600',
    message: 'Potential weapon detected. Exercise extreme caution.'
  },
  aggressive: {
    level: 'medium',
    color: 'bg-amber-500',
    message: 'Aggressive behavior detected. Maintain safe distance.'
  },
  concealed: {
    level: 'medium',
    color: 'bg-amber-500',
    message: 'Concealed movement detected. Verify subject intent.'
  },
  normal: {
    level: 'low',
    color: 'bg-green-600',
    message: 'No threats detected. Situation appears stable.'
  }
};

// Environment data to simulate sensor readings
const environmentData = [
  "Environment scan: Clear line of sight",
  "Lighting conditions: Adequate",
  "Motion detected: 2 subjects in view",
  "Distance to primary subject: 2.4m",
  "Background noise level: 48dB",
  "Subject hand position: Visible",
  "Subject facial expression: Neutral",
  "Eye contact: Maintained",
  "Motion pattern: Normal gait",
  "Voice tone analysis: Neutral",
  "Concealed objects: None detected",
  "Crowd density: Low",
  "Exit routes: Multiple",
  "Temperature: 72°F"
];

export function ThreatDetection({ className = '' }: ThreatDetectionProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [threatStatus, setThreatStatus] = useState<ThreatLevel>(THREATS.normal);
  const [simulatedData, setSimulatedData] = useState<string[]>([]);
  const [customSituation, setCustomSituation] = useState('');
  const [assessmentResult, setAssessmentResult] = useState('');
  const [isAssessing, setIsAssessing] = useState(false);
  const [recentSituations, setRecentSituations] = useState<string[]>([
    "Subject with hands in pockets, acting nervously at traffic stop",
    "Individual with large backpack entering government building",
    "Domestic disturbance with agitated male subject"
  ]);
  const [isUsingGroq, setIsUsingGroq] = useState(true);
  const [groqAnalysisResult, setGroqAnalysisResult] = useState('');
  
  const { speak: simulatedSpeak } = useSimulatedTTS();
  
  // Use OpenAI voice service for high-quality speech synthesis
  const speak = useCallback((text: string) => {
    try {
      // Use OpenAI voice service with the "ash" voice
      openAIVoiceService.speak(text, 'ash');
    } catch (error) {
      console.error('Error using OpenAI voice service:', error);
      // Fall back to simulated TTS if OpenAI fails
      simulatedSpeak(text);
    }
  }, [simulatedSpeak]);

  // Analyze threats using Groq's fast inference
  const analyzeWithGroq = useCallback(async (situationText: string) => {
    try {
      // Show loading state
      setGroqAnalysisResult('Analyzing with Groq...');
      setIsAssessing(true);
      
      // Check if Groq service is available
      if (!groqService.isAvailable()) {
        throw new Error('Groq service unavailable');
      }
      
      // Call Groq service for threat analysis
      const result = await groqService.analyzeAudio(situationText);
      
      // Update the analysis result
      setGroqAnalysisResult(result.summary);
      setAssessmentResult(result.summary);
      
      // Determine threat level based on analysis
      if (result.threats && result.threats.length > 0) {
        // Find the highest threat level
        const highestThreat = result.threats.reduce((highest, current) => {
          return current.confidence > highest.confidence ? current : highest;
        }, result.threats[0]);
        
        // Set threat status based on analysis
        if (highestThreat.confidence > 0.7) {
          setThreatStatus(THREATS.weapon);
          speak(`High threat detected: ${highestThreat.description}`);
        } else if (highestThreat.confidence > 0.4) {
          setThreatStatus(THREATS.aggressive);
          speak(`Medium threat detected: ${highestThreat.description}`);
        } else if (highestThreat.confidence > 0.2) {
          setThreatStatus(THREATS.concealed);
          speak(`Potential threat detected: ${highestThreat.description}`);
        } else {
          setThreatStatus(THREATS.normal);
          speak(`Assessment: ${result.summary}`);
        }
      } else {
        // No threats detected
        setThreatStatus(THREATS.normal);
        speak(`Assessment: ${result.summary}`);
      }
      
      // Track usage for analytics
      console.log('[ThreatDetection] Groq analysis successful');
      
      return result.summary;
    } catch (error) {
      console.error('Error analyzing with Groq:', error);
      setGroqAnalysisResult('Error analyzing with Groq. Falling back to standard analysis.');
      setAssessmentResult('Error analyzing with Groq. Falling back to standard analysis.');
      
      // Fall back to OpenAI for analysis
      try {
        const fallbackResult = await assessTacticalSituation(situationText);
        setAssessmentResult(fallbackResult);
        speak(`Assessment using fallback: ${fallbackResult}`);
        return fallbackResult;
      } catch (fallbackError) {
        console.error('Fallback analysis also failed:', fallbackError);
        return null;
      }
    } finally {
      setIsAssessing(false);
    }
  }, [speak, setGroqAnalysisResult, setIsAssessing, setAssessmentResult, setThreatStatus]);

  // Simulate threat detection algorithm
  useEffect(() => {
    if (!isScanning) {
      setSimulatedData([]);
      return;
    }

    let timer: NodeJS.Timeout;
    let scanCount = 0;
    
    const simulateScan = async () => {
      scanCount++;
      
      // Add some environment data
      setSimulatedData(prev => {
        const newData = [...prev];
        if (newData.length > 8) newData.shift(); // Keep last 8 items
        
        const randomData = environmentData[Math.floor(Math.random() * environmentData.length)];
        return [...newData, randomData];
      });
      
      // Every 5 scans, perform a threat assessment
      if (scanCount % 5 === 0) {
        if (isUsingGroq) {
          // Generate a random situation for Groq analysis
          const situations = [
            "Subject with hands in pockets, acting nervously",
            "Individual with large backpack moving quickly",
            "Person shouting aggressively at another individual",
            "Someone reaching suddenly into their jacket",
            "Individual pacing back and forth while looking around"
          ];
          const randomSituation = situations[Math.floor(Math.random() * situations.length)];
          
          // Add to simulated data
          setSimulatedData(prev => {
            const newData = [...prev];
            if (newData.length > 8) newData.shift();
            return [...newData, `Situation: ${randomSituation}`];
          });
          
          // Analyze with Groq
          await analyzeWithGroq(randomSituation);
        } else {
          // Use the original random threat simulation
          const threats = ['normal', 'normal', 'normal', 'concealed', 'aggressive', 'weapon'];
          const randomThreat = threats[Math.floor(Math.random() * threats.length)] as keyof typeof THREATS;
          const newThreat = THREATS[randomThreat];
          
          // Use functional update to safely compare and set state
          setThreatStatus(currentThreatStatus => {
            if (newThreat.level !== currentThreatStatus.level) {
                speak(newThreat.message);
                return newThreat; // Update state only if level changes
            }
            return currentThreatStatus; // Keep current state
          });
        }
      }
      
      timer = setTimeout(simulateScan, 1800);
    };
    
    simulateScan();
    return () => {
      clearTimeout(timer);
    };
  }, [isScanning, isUsingGroq, speak, analyzeWithGroq]);

  // Function to toggle scanning state
  const toggleScan = () => {
    setIsScanning(prev => !prev);
    if (!isScanning) {
      speak("Initiating threat detection scan");
    } else {
      speak("Threat detection scan stopped");
    }
  };

  // Function to handle manual situation assessment
  const handleSituationAssessment = async () => {
    if (!customSituation.trim()) return;
    
    setIsAssessing(true);
    setAssessmentResult('');
    setGroqAnalysisResult(''); // Clear previous Groq result
    
    try {
      // Add to recent situations if not already present
      if (!recentSituations.includes(customSituation)) {
        setRecentSituations(prev => {
          const updated = [customSituation, ...prev.slice(0, 2)];
          return updated;
        });
      }
      
      if (isUsingGroq) {
        // Use Groq for faster analysis
        const summary = await analyzeWithGroq(customSituation);
        // Assessment result is already set inside analyzeWithGroq
      } else {
        // Use OpenAI as fallback
        setAssessmentResult('Analyzing with OpenAI...');
        const tacticalAssessment = await assessTacticalSituation(customSituation);
        setAssessmentResult(tacticalAssessment);
        // Determine threat level based on OpenAI response (simple example)
        if (tacticalAssessment.toLowerCase().includes('high threat') || tacticalAssessment.toLowerCase().includes('weapon')) {
          setThreatStatus(THREATS.weapon);
        } else if (tacticalAssessment.toLowerCase().includes('medium threat') || tacticalAssessment.toLowerCase().includes('aggressive')) {
          setThreatStatus(THREATS.aggressive);
        } else {
          setThreatStatus(THREATS.normal);
        }
        speak(`OpenAI Assessment: ${tacticalAssessment}`);
      }
    } catch (error) {
      console.error('Error assessing situation:', error);
      setAssessmentResult('Error analyzing the situation. Please try again.');
    } finally {
      setIsAssessing(false);
    }
  };
  
  // Function to load a saved situation into the input
  const loadSavedSituation = (situation: string) => {
    setCustomSituation(situation);
  };

  // --- Component Return JSX ---
  return (
    <div className={`bg-black/80 rounded-lg p-6 border border-blue-900/50 shadow-lg ${className}`}>
      {/* Header: Title & Scan Toggle */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-blue-900/30">
        <div className="flex items-center gap-3">
          <ShieldIcon className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl text-blue-300 font-semibold font-mono">Threat Assessment Module</h2>
        </div>
        
        <Button 
          onClick={toggleScan}
          size="sm"
          variant={isScanning ? 'destructive' : 'default'} // Use destructive variant for stop
          className={`font-mono text-xs ${isScanning ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-700 hover:bg-blue-800'}`}
        >
          {isScanning ? 'STOP SCAN' : 'START SCAN'}
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Status & Logs */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-blue-400/80 uppercase tracking-wider font-mono mb-3">System Status & Logs</h3>

          {/* Enhanced Threat Level Banner */}
          <div className={`flex items-center justify-between p-4 rounded-md border-l-4 ${
            threatStatus.level === 'high' 
              ? 'border-red-500 bg-red-950/50 text-red-300' 
              : threatStatus.level === 'medium'
                ? 'border-amber-500 bg-amber-950/50 text-amber-300'
                : 'border-green-500 bg-green-950/50 text-green-300'
          }`}>
            <div className="flex items-center gap-3">
              <AlertTriangleIcon 
                className={`h-6 w-6 ${threatStatus.level === 'low' ? 'text-green-500' : ''}`} 
              />
              <span className="font-semibold font-mono text-base">
                LEVEL: {threatStatus.level.toUpperCase()}
              </span>
            </div>
            <Badge 
              variant="outline"
              className={`${isScanning ? 'border-current/50 text-current animate-pulse' : 'border-gray-600 text-gray-400'} text-xs`}
            >
              {isScanning ? 'SCAN ACTIVE' : 'IDLE'}
            </Badge>
          </div>
          
          {/* Sensor Indicators */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-md border border-blue-900/30 bg-black/60 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-blue-900/20 transition-colors">
              <EyeIcon className="h-5 w-5 text-blue-400/80" />
              <span className="text-white/70 text-xs font-mono">Visual</span>
            </div>
            <div className="p-3 rounded-md border border-blue-900/30 bg-black/60 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-blue-900/20 transition-colors">
              <ActivityIcon className="h-5 w-5 text-blue-400/80" />
              <span className="text-white/70 text-xs font-mono">Motion</span>
            </div>
            <div className="p-3 rounded-md border border-blue-900/30 bg-black/60 flex flex-col items-center justify-center gap-1.5 text-center hover:bg-blue-900/20 transition-colors">
              <MapPinIcon className="h-5 w-5 text-blue-400/80" />
              <span className="text-white/70 text-xs font-mono">Location</span>
            </div>
          </div>
          
          {/* Simulated Data Log */}
          <div className="h-48 overflow-y-auto p-3 rounded-md border border-blue-900/40 bg-black/70 font-mono text-xs scrollbar-thin scrollbar-thumb-blue-800/50 scrollbar-track-black/50">
            <div className="text-blue-400/70 mb-2 sticky top-0 bg-black/70 py-1">[System Log Feed]</div>
            {isScanning && simulatedData.length > 0 ? (
              simulatedData.map((data, i) => (
                <div key={i} className="text-green-400/80 mb-1 flex">
                  <span className="text-blue-500/60 mr-2 w-6 text-right">{i + 1}:</span>
                  <span>{data}</span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-blue-400/40">
                {isScanning ? 'Awaiting scan data...' : 'Threat detection system idle.'}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Column: Manual Assessment & AI Selection */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-blue-400/80 uppercase tracking-wider font-mono mb-3">Manual Analysis & Control</h3>

          {/* AI Selection Toggle has been removed as requested */}

          {/* Manual Situation Input */}
          <div className="p-4 rounded-md border border-blue-900/40 bg-black/60">
            <div className="flex items-center gap-2 mb-3 text-blue-300 font-mono">
              <ScanIcon className="h-5 w-5" />
              <span>Describe Situation for Analysis</span>
            </div>
            
            <Textarea
              value={customSituation}
              onChange={(e) => setCustomSituation(e.target.value)}
              placeholder={`Enter details... (e.g., 'Subject pacing nervously, shouting incoherently') Selected: ${isUsingGroq ? 'Groq' : 'OpenAI'}`}
              className="bg-black/80 border-blue-800/60 mb-3 min-h-[80px] text-sm focus:border-blue-500 focus:ring-blue-500 text-white/90"
              rows={3}
            />
            
            <Button 
              onClick={handleSituationAssessment}
              disabled={!customSituation.trim() || isAssessing}
              className={`w-full font-mono ${isUsingGroq ? 'bg-purple-700 hover:bg-purple-800' : 'bg-teal-700 hover:bg-teal-800'}`}
            >
              {isAssessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <ShieldIcon className="h-4 w-4 mr-2" />
                  Assess with {isUsingGroq ? 'Groq' : 'OpenAI'}
                </>
              )}
            </Button>
            
            {/* Recent Situations */}
            {recentSituations.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-blue-400/60 mb-1">Recent inputs:</p>
                <div className="flex flex-col gap-1">
                  {recentSituations.map((situation, index) => (
                    <div 
                      key={index}
                      onClick={() => loadSavedSituation(situation)}
                      className="flex items-center text-xs text-blue-300/80 hover:text-blue-100 cursor-pointer py-1 px-2 hover:bg-blue-900/30 rounded transition-colors duration-150"
                    >
                      <UserIcon className="h-3 w-3 mr-1.5 flex-shrink-0 text-blue-400/70" /> 
                      <span className="truncate" title={situation}>{situation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Assessment Result Display */}
          {(assessmentResult || groqAnalysisResult) && (
            <div className="p-4 rounded-md border border-blue-900/40 bg-gradient-to-b from-black/60 to-black/80 min-h-[120px] max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-800/50 scrollbar-track-black/50">
              <div className={`text-sm font-semibold ${isUsingGroq ? 'text-purple-300' : 'text-teal-300'} mb-2 flex items-center font-mono border-b border-blue-900/30 pb-1.5`}>
                {isUsingGroq ? <ZapIcon className="h-4 w-4 mr-2"/> : <ShieldIcon className="h-4 w-4 mr-2" />}
                {isUsingGroq ? 'Groq Analysis' : 'OpenAI Analysis'} Result:
              </div>
              <p className="text-white/90 text-sm whitespace-pre-wrap break-words">
                {isUsingGroq ? groqAnalysisResult : assessmentResult}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}