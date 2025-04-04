import React, { useState, useEffect } from 'react';
import { useLiveKitVoice } from '../hooks/useLiveKitVoice';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle2, Languages, Flag, VolumeIcon, VolumeXIcon } from 'lucide-react';

const languages = {
  english: 'English',
  spanish: 'Español',
  french: 'Français',
  vietnamese: 'Tiếng Việt',
  mandarin: '普通话',
  arabic: 'العربية'
};

// Complete Miranda Rights text according to Louisiana statutes (La. R.S. 15:451)
const mirandaText = {
  english: "You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be provided for you. Do you understand the rights I have just read to you? With these rights in mind, do you wish to speak to me?",
  
  spanish: "Tiene derecho a guardar silencio. Cualquier cosa que diga puede y será usada en su contra en un tribunal. Tiene derecho a un abogado. Si no puede pagar un abogado, se le proporcionará uno. ¿Entiende los derechos que le acabo de leer? Con estos derechos en mente, ¿desea hablar conmigo?",
  
  french: "Vous avez le droit de garder le silence. Tout ce que vous direz pourra être et sera utilisé contre vous devant un tribunal. Vous avez le droit à un avocat. Si vous ne pouvez pas vous permettre un avocat, un avocat vous sera fourni. Comprenez-vous les droits que je viens de vous lire? Avec ces droits à l'esprit, souhaitez-vous me parler?",
  
  vietnamese: "Bạn có quyền giữ im lặng. Bất cứ điều gì bạn nói có thể và sẽ được sử dụng chống lại bạn tại tòa án. Bạn có quyền có luật sư. Nếu bạn không có khả năng chi trả cho luật sư, một luật sư sẽ được cung cấp cho bạn. Bạn có hiểu các quyền tôi vừa đọc cho bạn không? Với những quyền này trong tâm trí, bạn có muốn nói chuyện với tôi không?",
  
  mandarin: "你有权保持沉默。你所说的任何话都可以并将被用作对你不利的证据。你有权请律师。如果你请不起律师，法院将为你指定一名律师。你明白我刚才向你宣读的权利吗？考虑到这些权利，你是否愿意和我谈话？",
  
  arabic: "لديك الحق في التزام الصمت. أي شيء تقوله يمكن وسوف يستخدم ضدك في المحكمة. لديك الحق في الاستعانة بمحام. إذا لم تكن قادرًا على تحمل تكاليف محام، سيتم توفير محام لك. هل تفهم الحقوق التي قرأتها للتو؟ مع وضع هذه الحقوق في الاعتبار، هل ترغب في التحدث معي؟"
};

const languageFlags = {
  english: "🇺🇸",
  spanish: "🇪🇸",
  french: "🇫🇷",
  vietnamese: "🇻🇳",
  mandarin: "🇨🇳",
  arabic: "🇸🇦"
};

export function MirandaRights() {
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof languages>('english');
  const { speak, isSpeaking: speaking, stopSpeaking: stop, error } = useLiveKitVoice();
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'playing' | 'complete'>('idle');
  const [readToSuspect, setReadToSuspect] = useState(false);

  // Listen for triggerMiranda events and fallback speech events
  useEffect(() => {
    const handleTriggerMiranda = (event: CustomEvent) => {
      console.log('Miranda rights triggered with event:', event);
      
      // Show visual feedback that the command was received
      // This is especially important when triggered from text commands
      document.dispatchEvent(new CustomEvent('mirandaRightsRequested', { 
        detail: { 
          timestamp: Date.now(),
          source: event.detail?.source || 'voice',
          isErrorRecovery: event.detail?.isErrorRecovery || false
        } 
      }));
      
      try {
        // Get language from event detail
        const language = event.detail?.language || 'english';
        console.log('Requested language for Miranda rights:', language);
        
        // Set the language - validate it's supported
        if (languages[language.toLowerCase() as keyof typeof languages]) {
          // Convert to lowercase to handle case variations
          const normalizedLanguage = language.toLowerCase() as keyof typeof languages;
          setSelectedLanguage(normalizedLanguage);
          
          // Stop any current playback
          if (speaking) {
            stop();
            // Small delay to ensure audio system has reset
            setTimeout(() => {
              handlePlay();
            }, 300);
          } else {
            // Start reading immediately if not currently speaking
            handlePlay();
          }
          
          // Log success for debugging
          console.log(`Miranda rights will be read in ${languages[normalizedLanguage]}`);
        } else {
          // Handle unsupported language
          console.warn(`Language "${language}" not supported for Miranda rights. Using English instead.`);
          setSelectedLanguage('english');
          
          // Still read the rights, but in English
          if (speaking) {
            stop();
            setTimeout(() => {
              handlePlay();
            }, 300);
          } else {
            handlePlay();
          }
        }
      } catch (error) {
        // Robust error handling
        console.error('Error processing triggerMiranda event:', error);
        // Fallback to English
        setSelectedLanguage('english');
        if (!speaking) {
          handlePlay();
        }
      }
    };
    
    // Add event listener
    document.addEventListener('triggerMiranda', handleTriggerMiranda as EventListener);
    console.log('Added triggerMiranda event listener');
    
    // Cleanup
    return () => {
      document.removeEventListener('triggerMiranda', handleTriggerMiranda as EventListener);
      if (speaking) {
        stop();
      }
    };
  }, [speaking, stop]);
  
  // Stop audio if component unmounts
  useEffect(() => {
    return () => {
      if (speaking) {
        stop();
      }
    };
  }, [speaking, stop]);

  const handleLanguageChange = (language: string) => {
    // If currently speaking, stop before changing language
    if (speaking) {
      stop();
      setPlaybackStatus('idle');
    }
    setSelectedLanguage(language as keyof typeof languages);
  };

  const handlePlay = async () => {
    if (speaking) {
      stop();
      setPlaybackStatus('idle');
      return;
    }
    
    try {
      setPlaybackStatus('playing');
      console.log('Starting Miranda rights TTS with text:', mirandaText[selectedLanguage].substring(0, 50) + '...');
      
      // Add additional logging for debugging
      console.log(`Using language: ${selectedLanguage} (${languages[selectedLanguage]})`);
      console.log(`Text length: ${mirandaText[selectedLanguage].length} characters`);
      
      // Verify we have valid text before proceeding
      if (!mirandaText[selectedLanguage] || mirandaText[selectedLanguage].length < 10) {
        throw new Error(`Invalid or missing Miranda text for language: ${selectedLanguage}`);
      }
      
      // Notify that playback is starting
      document.dispatchEvent(new CustomEvent('mirandaRightsPlaying', { 
        detail: { 
          language: selectedLanguage,
          timestamp: Date.now()
        } 
      }));
      
      // Use LiveKit Voice API with 'ash' voice for all speech output
      try {
        await speak(mirandaText[selectedLanguage], 'ash');
        console.log('Miranda rights TTS with LiveKit completed successfully');
      } catch (speakError) {
        console.error('LiveKit TTS method failed:', speakError);
        throw speakError; // Re-throw to be handled by the parent catch
      }
      
      setPlaybackStatus('complete');
      setReadToSuspect(true);
      
      // Dispatch event to notify other components that Miranda rights were read
      document.dispatchEvent(new CustomEvent('mirandaRightsRead', { 
        detail: { 
          language: selectedLanguage,
          timestamp: Date.now(),
          success: true
        } 
      }));
    } catch (err) {
      console.error("Error playing Miranda rights:", err);
      setPlaybackStatus('idle');
      
      // Notify about the error
      document.dispatchEvent(new CustomEvent('mirandaRightsError', { 
        detail: { 
          language: selectedLanguage,
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : 'Unknown error'
        } 
      }));
      
      // Try fallback to English if another language failed
      if (selectedLanguage !== 'english') {
        console.log('Attempting fallback to English for Miranda rights');
        setSelectedLanguage('english');
        // Small delay before trying again
        setTimeout(() => {
          try {
            speak(mirandaText['english'], 'ash');
            setPlaybackStatus('playing');
          } catch (fallbackErr) {
            console.error("Fallback also failed:", fallbackErr);
            setPlaybackStatus('idle');
            
            // Notify about the fallback error
            document.dispatchEvent(new CustomEvent('mirandaRightsError', { 
              detail: { 
                language: 'english',
                timestamp: Date.now(),
                error: fallbackErr instanceof Error ? fallbackErr.message : 'Fallback to English failed',
                isFallback: true
              } 
            }));
          }
        }, 500);
      }
    }
  };

  return (
    <div className="p-5">
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h2 className="text-white text-lg font-medium">Miranda Rights</h2>
          <p className="text-[#8e8e93] text-sm mt-1">Louisiana statute La. R.S. 15:451</p>
        </div>
        
        {readToSuspect && (
          <Badge className="bg-[#30d158] text-black border-0 rounded-full px-3 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Rights delivered
          </Badge>
        )}
      </div>
      
      <div className="bg-[#2c2c2e] rounded-xl p-5 border border-[#38383a]">
        <p className="text-white text-sm leading-relaxed mb-5">
          {mirandaText[selectedLanguage]}
        </p>
        
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <div className="relative flex-grow max-w-[240px]">
            <Select
              value={selectedLanguage}
              onValueChange={handleLanguageChange}
              disabled={speaking}
            >
              <SelectTrigger className="w-full bg-[#1c1c1e] border-[#38383a] text-white rounded-lg pr-10 h-10">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{languageFlags[selectedLanguage]}</span>
                  <SelectValue placeholder="Select language" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c1e] border-[#38383a] text-white">
                {Object.entries(languages).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="focus:bg-[#3a3a3c] focus:text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{languageFlags[key as keyof typeof languageFlags]}</span>
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Languages className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8e8e93] w-4 h-4" />
          </div>
          
          <Button 
            onClick={handlePlay}
            className={`rounded-full px-5 h-10 border-0 ${
              speaking 
                ? 'bg-[#ff453a] hover:bg-[#ff6961] text-white' 
                : playbackStatus === 'complete'
                  ? 'bg-[#30d158] hover:bg-[#30d158] text-white'
                  : 'bg-[#0a84ff] hover:bg-[#0a84ff] text-white'
            }`}
            disabled={error !== null}
          >
            {speaking ? (
              <div className="flex items-center gap-2">
                <VolumeXIcon className="w-4 h-4" />
                <span>Stop Reading</span>
              </div>
            ) : playbackStatus === 'complete' ? (
              <div className="flex items-center gap-2">
                <VolumeIcon className="w-4 h-4" />
                <span>Read Again</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <VolumeIcon className="w-4 h-4" />
                <span>Read Rights</span>
              </div>
            )}
          </Button>
        </div>
        
        {error && (
          <div className="mt-4 flex items-center text-[#ff453a] text-sm bg-[#1c1c1e] rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
      {playbackStatus === 'complete' && (
        <div className="mt-4 bg-[#1c1c1e] rounded-lg p-3 flex items-center border border-[#38383a]">
          <Flag className="w-4 h-4 text-[#0a84ff] mr-2 flex-shrink-0" />
          <span className="text-sm text-[#8e8e93]">
            Miranda Rights have been read to the subject in {languages[selectedLanguage]}
          </span>
        </div>
      )}
      
      {error && playbackStatus !== 'playing' && (
        <div className="mt-4 bg-[#1c1c1e] rounded-lg p-3 flex items-center border border-[#ff453a]/30">
          <AlertCircle className="w-4 h-4 text-[#ff453a] mr-2 flex-shrink-0" />
          <span className="text-sm text-[#ff453a]">
            Unable to read Miranda Rights due to audio issues. The text is still available above.
          </span>
        </div>
      )}
    </div>
  );
}
