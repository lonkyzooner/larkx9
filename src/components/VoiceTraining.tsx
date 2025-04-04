import { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSimulatedTTS } from '../hooks/useSimulatedTTS.tsx';

const TRAINING_COMMANDS = [
  {
    category: 'Miranda Rights',
    examples: [
      'Read Miranda rights in English',
      'Read rights in Spanish',
      'Recite Miranda warning'
    ]
  },
  {
    category: 'Statute Lookup',
    examples: [
      'Look up statute 14:30',
      'What is statute 14:95',
      'Tell me about statute 14:402'
    ]
  },
  {
    category: 'Threat Assessment',
    examples: [
      'Check for threats',
      'Assess the situation',
      'Scan the area for threats'
    ]
  },
  {
    category: 'Tactical Situation',
    examples: [
      'Give me a tactical assessment',
      'What\'s the tactical situation',
      'Provide tactical guidance'
    ]
  }
];

export function VoiceTraining() {
  const [currentCategory, setCurrentCategory] = useState(0);
  const [currentExample, setCurrentExample] = useState(0);
  const [practicing, setPracticing] = useState(false);
  const [feedback, setFeedback] = useState('');
  
  const {
    transcript,
    listening,
    startListening,
    stopListening,
    hasRecognitionSupport
  } = useSpeechRecognition();
  
  const { speak } = useSimulatedTTS();
  
  const currentCommand = TRAINING_COMMANDS[currentCategory].examples[currentExample];
  
  const startPractice = useCallback(() => {
    setPracticing(true);
    speak(`Please say: ${currentCommand}`);
    startListening();
  }, [currentCommand, speak, startListening]);
  
  const checkPractice = useCallback(() => {
    if (!transcript) return;
    
    // Simple similarity check (can be made more sophisticated)
    const similarity = calculateSimilarity(
      transcript.toLowerCase(),
      currentCommand.toLowerCase()
    );
    
    if (similarity > 0.8) {
      const successMessage = 'Excellent! Your command was clear and well-phrased.';
      setFeedback(successMessage);
      speak(successMessage);
    } else {
      const feedbackMsg = `Try again. Say: ${currentCommand}`;
      setFeedback(feedbackMsg);
      speak(feedbackMsg);
    }
    
    setPracticing(false);
    stopListening();
  }, [transcript, currentCommand, speak, stopListening]);
  
  const nextExample = useCallback(() => {
    setFeedback('');
    if (currentExample < TRAINING_COMMANDS[currentCategory].examples.length - 1) {
      setCurrentExample(prev => prev + 1);
    } else if (currentCategory < TRAINING_COMMANDS.length - 1) {
      setCurrentCategory(prev => prev + 1);
      setCurrentExample(0);
    }
  }, [currentCategory, currentExample]);
  
  // Simple string similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };
  
  if (!hasRecognitionSupport) {
    return (
      <div className="p-4">
        <p className="text-red-500">
          Speech recognition is not supported in your browser.
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-[#1c1c1e] rounded-xl border border-[#2c2c2e]">
      <h2 className="text-xl font-semibold text-white mb-4">Voice Command Training</h2>
      
      <div className="mb-6">
        <h3 className="text-[#0a84ff] font-medium mb-2">
          {TRAINING_COMMANDS[currentCategory].category}
        </h3>
        <p className="text-white text-lg mb-4">"{currentCommand}"</p>
        
        {feedback && (
          <div className={`p-3 rounded-lg mb-4 ${
            feedback.includes('Excellent')
              ? 'bg-[#1c7d3d] text-[#30d158]'
              : 'bg-[#4c1c1c] text-[#ff453a]'
          }`}>
            {feedback}
          </div>
        )}
        
        <div className="flex gap-3">
          {!practicing ? (
            <>
              <Button
                onClick={startPractice}
                className="bg-[#0a84ff] hover:bg-[#419cff] text-white"
              >
                Practice This Command
              </Button>
              
              <Button
                onClick={nextExample}
                variant="outline"
                className="border-[#2c2c2e] text-[#0a84ff] hover:bg-[#2c2c2e]"
              >
                Next Example
              </Button>
            </>
          ) : (
            <Button
              onClick={checkPractice}
              className={`bg-[#30d158] hover:bg-[#30d158] text-black ${
                listening ? 'animate-pulse' : ''
              }`}
            >
              {listening ? 'Listening...' : 'Check Practice'}
            </Button>
          )}
        </div>
      </div>
      
      {transcript && practicing && (
        <div className="mt-4">
          <p className="text-[#8e8e93]">You said:</p>
          <p className="text-white">{transcript}</p>
        </div>
      )}
      
      <div className="mt-6 border-t border-[#2c2c2e] pt-4">
        <h4 className="text-[#8e8e93] mb-2">Progress</h4>
        <div className="flex gap-1">
          {TRAINING_COMMANDS.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full ${
                index === currentCategory
                  ? 'bg-[#0a84ff]'
                  : index < currentCategory
                  ? 'bg-[#30d158]'
                  : 'bg-[#2c2c2e]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
