import React, { useState, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getLegalInformation } from '../lib/openai-service';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Loader2, Mic, StopCircle, Search, BookOpen, Scale, AlertTriangle, Volume2, ExternalLink, BookMarked, FileText, Link2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useVoice } from '../contexts/VoiceContext';
import { liveKitVoiceService } from '../services/livekit/LiveKitVoiceService';

// Louisiana Revised Statutes reference URL
const LA_REVISED_STATUTES_URL = 'https://www.legis.la.gov/legis/Laws_Toc.aspx?folder=75';

// Statute categories for organized reference
const statuteCategories = [
  { id: 'RS14', name: 'Criminal Law', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=78337' },
  { id: 'RS32', name: 'Motor Vehicles and Traffic', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=88166' },
  { id: 'RS40', name: 'Public Health and Safety', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=98856' },
  { id: 'RS15', name: 'Criminal Procedure', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=78673' },
  { id: 'RS13', name: 'Courts and Judicial Procedure', url: 'https://www.legis.la.gov/Legis/Law.aspx?d=77990' },
];

// Sample data of common Louisiana criminal codes for quick reference
const commonCodes = [
  { code: 'La. R.S. 14:30', name: 'First Degree Murder', category: 'RS14' },
  { code: 'La. R.S. 14:31', name: 'Second Degree Murder', category: 'RS14' },
  { code: 'La. R.S. 14:34', name: 'Aggravated Battery', category: 'RS14' },
  { code: 'La. R.S. 14:65', name: 'Simple Robbery', category: 'RS14' },
  { code: 'La. R.S. 14:67', name: 'Theft', category: 'RS14' },
  { code: 'La. R.S. 14:42', name: 'Aggravated Rape', category: 'RS14' },
  { code: 'La. R.S. 40:966', name: 'Possession of Schedule I CDS', category: 'RS40' },
  { code: 'La. R.S. 14:108', name: 'Resisting an Officer', category: 'RS14' },
  { code: 'La. R.S. 14:63', name: 'Criminal Trespass', category: 'RS14' },
  { code: 'La. R.S. 14:98', name: 'DWI', category: 'RS14' },
  { code: 'La. R.S. 32:58', name: 'Careless Operation', category: 'RS32' },
  { code: 'La. R.S. 32:415', name: 'Driving Under Suspension', category: 'RS32' },
  { code: 'La. R.S. 15:571.11', name: 'Disposition of Fines', category: 'RS15' },
];

// Recent searches for quick access (would be persisted in a real app)
const recentSearches = [
  { query: 'La. R.S. 14:98', timestamp: new Date('2025-03-15T14:30:00') },
  { query: 'resisting arrest', timestamp: new Date('2025-03-16T09:15:00') },
  { query: 'traffic stop procedure', timestamp: new Date('2025-03-17T11:45:00') },
];

// Function to get the direct URL to a statute if possible
const getStatuteUrl = (statuteInput: string): string | null => {
  // Parse the statute input to extract title and section
  const match = statuteInput.match(/(?:La\. R\.S\.|RS) ?(\d+)(?::|\.)?(\d+)?/i);
  if (!match) return null;
  
  const title = match[1];
  const section = match[2];
  
  // If we have both title and section, construct a direct URL to the statute
  if (title && section) {
    return `https://www.legis.la.gov/Legis/Law.aspx?d=78${parseInt(title) * 100 + parseInt(section)}`;
  }
  
  // Return the base category URL if we can find it
  const category = statuteCategories.find(cat => cat.id === `RS${title}`);
  if (category) return category.url;
  
  // If it's a search term rather than a statute reference, use the search URL
  if (!match) {
    return `https://www.legis.la.gov/Legis/LawSearch.aspx?q=${encodeURIComponent(statuteInput)}`;
  }
  
  // Default to the main statutes page
  return LA_REVISED_STATUTES_URL;
};

// Function to handle statute lookups with enhanced features
export const handleStatuteLookup = async (
  statuteInput: string, 
  setIsLoading: Function, 
  setResult: Function, 
  setSuggestedCharges: Function, 
  speak: Function, 
  resultRef: React.RefObject<HTMLDivElement>,
  setStatuteUrl?: Function
) => {
  if (!statuteInput.trim()) return;
  
  setIsLoading(true);
  setResult('');
  setSuggestedCharges([]);
  
  try {
    // Get legal information from AI service
    const legalInfo = await getLegalInformation(statuteInput);
    setResult(legalInfo);
    
    // Get direct URL to statute if possible
    const url = getStatuteUrl(statuteInput);
    if (setStatuteUrl && url) setStatuteUrl(url);
    
    // Speak the result using TTS
    speak(`Information for statute ${statuteInput}: ${legalInfo}`);
    
    // Add to recent searches (would be implemented with local storage in a real app)
    // saveRecentSearch(statuteInput);
    
    // Scroll to result
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } catch (error) {
    console.error("Error looking up statute:", error);
    setResult("Sorry, there was an error retrieving information for this statute.");
  } finally {
    setIsLoading(false);
  }
};

export function RSCodes() {
  const [statuteInput, setStatuteInput] = useState('');
  const [statuteUrl, setStatuteUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filteredCodes, setFilteredCodes] = useState(commonCodes);
  const [recentStatuteSearches, setRecentStatuteSearches] = useState(recentSearches);
  const [situationInput, setSituationInput] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [activeTab, setActiveTab] = useState<'lookup' | 'analyze'>('analyze');
  const [result, setResult] = useState('');
  const [suggestedCharges, setSuggestedCharges] = useState<{code: string, name: string, reason: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  const [additionalCharge, setAdditionalCharge] = useState('');
  const [additionalChargeResponse, setAdditionalChargeResponse] = useState('');

  // Use VoiceContext for speech synthesis
  const { speak, isSpeaking, stopSpeaking } = useVoice();
  const { 
    transcript, 
    listening, 
    startListening, 
    stopListening,
    hasRecognitionSupport 
  } = useSpeechRecognition();
  
  const resultRef = useRef<HTMLDivElement>(null);

  // Function to handle voice synthesis - always use LiveKit voice service for consistent voice
  const synthesizeSpeech = (text: string) => {
    // Always use LiveKit voice service for consistent voice experience
    liveKitVoiceService.speak(text);
  };

  // Handle voice input for situation analysis
  const handleVoiceInput = () => {
    if (listening) {
      stopListening();
      if (transcript) {
        setVoiceInput(transcript);
        setSituationInput(transcript);
        
        // If we have a transcript, analyze it or look up statutes based on content
        if (transcript.toLowerCase().includes('statute') || 
            transcript.toLowerCase().includes('code') || 
            transcript.toLowerCase().includes('r.s.')) {
          setActiveTab('lookup');
          setStatuteInput(transcript);
          setTimeout(() => lookupStatute(), 500);
        }
      }
    } else {
      setVoiceInput('');
      startListening();
    }
  };
  
  // Filter codes based on selected category
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredCodes(commonCodes);
    } else {
      setFilteredCodes(commonCodes.filter(code => code.category === selectedCategory));
    }
  }, [selectedCategory]);
  
  // Add a statute to recent searches
  const addToRecentSearches = (query: string) => {
    const newSearch = { query, timestamp: new Date() };
    setRecentStatuteSearches(prev => [newSearch, ...prev.slice(0, 4)]); // Keep only 5 most recent
  };
  
  // Handle statute lookup with LiveKit voice and URL tracking
  const lookupStatute = async () => {
    await handleStatuteLookup(
      statuteInput,
      setIsLoading,
      setResult,
      setSuggestedCharges,
      synthesizeSpeech,
      resultRef,
      setStatuteUrl
    );
    addToRecentSearches(statuteInput);
  };



  const processVoiceCommand = async (command: string) => {
    await handleSituationAnalysis();
  };

  const handleResult = (event: SpeechRecognitionEvent) => {
    const transcript = event.results[event.resultIndex][0].transcript;
    processVoiceCommand(transcript);
  };

  const handleSituationAnalysis = async () => {
    const inputText = situationInput.trim();
    if (!inputText) return;
    
    setIsLoading(true);
    setResult('');
    setSuggestedCharges([]);
    
    try {
      const prompt = `
        As a legal assistant for Louisiana law enforcement, analyze ONLY the explicitly stated facts in this situation. Do not make assumptions or add details that are not directly mentioned:

        Situation: ${inputText}

        Instructions:
        1. Consider ONLY the facts explicitly stated above
        2. Do NOT make assumptions about additional circumstances or details
        3. Identify Louisiana statutes that may apply based SOLELY on the stated facts (up to 3 most relevant)
        4. For each statute, explain why it applies using ONLY the information provided

        Format your response as JSON:
        {
          "charges": [
            {
              "code": "La. R.S. XX:XX",
              "name": "Name of offense",
              "reason": "Brief explanation using only stated facts"
            }
          ],
          "summary": "Brief analysis based strictly on provided information"
        }

        Important: If certain details would be needed to determine if a statute applies, do not include that statute. Only include charges that can be supported by the explicitly stated facts.
      `;
      
      const legalAnalysis = await getLegalInformation(prompt);
      
      try {
        // Try to parse JSON response
        const jsonStart = legalAnalysis.indexOf('{');
        const jsonEnd = legalAnalysis.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = legalAnalysis.substring(jsonStart, jsonEnd);
          const parsedResponse = JSON.parse(jsonStr);
          
          setSuggestedCharges(parsedResponse.charges || []);
          setResult(parsedResponse.summary || legalAnalysis);
          
          // Build a spoken summary of the charges
          let fullSummary = ''; // Initialize fullSummary properly
          if (parsedResponse.charges && parsedResponse.charges.length > 0) {
            parsedResponse.charges.forEach((charge: { code: string; name: string; reason: string }, index: number) => {
              fullSummary += `${charge.code}, ${charge.name}. ${charge.reason}. `;
              
              if (index < parsedResponse.charges.length - 1) {
                fullSummary += "Next, ";
              }
            });
            
            // Add the bottom summary if available
            if (parsedResponse.summary) {
              fullSummary += ` In conclusion, ${parsedResponse.summary}`;
            }
          } else {
            fullSummary += parsedResponse.summary || "No specific charges were identified.";
          }
          
          // Automatically speak the complete analysis results
          setTimeout(() => {
            synthesizeSpeech(fullSummary);
          }, 500);
        } else {
          // Handle non-JSON response gracefully
          console.warn("Received non-JSON response:", legalAnalysis);
          setResult(legalAnalysis);
          setTimeout(() => {
            synthesizeSpeech(`Based on the information you provided, here's my analysis: ${legalAnalysis}`);
          }, 500);
        }
      } catch (jsonError) {
        console.error("Error parsing JSON response:", jsonError);
        setResult(legalAnalysis);
        setTimeout(() => {
          synthesizeSpeech(`Based on the information you provided, here's my analysis: ${legalAnalysis}`);
        }, 500);
      }
      
      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error("Error analyzing situation:", error);
      setResult("Sorry, there was an error analyzing this situation.");
      synthesizeSpeech("Sorry, there was an error analyzing this situation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCodeSelect = (code: string) => {
    setStatuteInput(code);
    setActiveTab('lookup');
    setTimeout(() => handleStatuteLookup(statuteInput, setIsLoading, setResult, setSuggestedCharges, synthesizeSpeech, resultRef, setStatuteUrl), 100);
  };

  const handleAdditionalChargeSubmit = async () => {
    if (additionalCharge.trim()) {
      // Process the additional charge suggestion
      const prompt = `Analyze the additional charge: ${additionalCharge}`;
      try {
        const analysis = await getLegalInformation(prompt);
        // Handle the analysis response
        console.log('Additional Charge Analysis:', analysis);
        setAdditionalChargeResponse(analysis);
        // Provide feedback to the user
        synthesizeSpeech(`You suggested the charge: ${additionalCharge}. Analysis: ${analysis}`);
      } catch (error) {
        console.error('Error processing additional charge:', error);
        setResult('Sorry, there was an error processing your additional charge.');
      }
      // Clear the input after processing
      setAdditionalCharge('');
    }
  };

  return (
    <div className="bg-background rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-primary font-medium">Louisiana Criminal Code Analysis</h2>
          <Badge variant="outline" className="text-xs text-muted-foreground border-border">
            LARK Legal Assistant
          </Badge>
        </div>
        
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
          className="text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="h-4 w-4 mr-1" />
          {showAdditionalInfo ? 'Hide Info' : 'Quick Codes'}
        </Button>
      </div>
      
      {showAdditionalInfo && (
        <div className="mb-4 bg-muted/50 p-3 rounded-md border border-border">
          <div className="text-sm text-foreground mb-2 font-medium">Common Louisiana Criminal Codes:</div>
          <div className="flex flex-wrap gap-2">
            {commonCodes.map((code) => (
              <Badge 
                key={code.code} 
                variant="outline" 
                className="cursor-pointer hover:bg-muted border-border"
                onClick={() => handleQuickCodeSelect(code.code)}
              >
                {code.code} - {code.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lookup' | 'analyze')} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4 bg-muted/50">
          <TabsTrigger value="analyze" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Scale className="h-4 w-4 mr-2" /> Analyze Situation
          </TabsTrigger>
          <TabsTrigger value="lookup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Search className="h-4 w-4 mr-2" /> Lookup Statute
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="lookup" className="space-y-4 mt-0">
          <div className="space-y-2">
            <div className="flex items-center text-foreground text-sm">
              <Search className="h-4 w-4 mr-1 text-primary" />
              <span>Enter Louisiana Statute Reference</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={statuteInput}
                onChange={(e) => setStatuteInput(e.target.value)}
                placeholder="e.g., 'La. R.S. 14:30' or '14:30'"
                className="flex-1 bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <Button 
                onClick={() => handleStatuteLookup(statuteInput, setIsLoading, setResult, setSuggestedCharges, synthesizeSpeech, resultRef, setStatuteUrl)}
                disabled={!statuteInput.trim() || isLoading}
                className="bg-primary hover:bg-primary/90 whitespace-nowrap"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lookup'}
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="analyze" className="space-y-4 mt-0">
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="flex items-center text-slate-900 text-sm font-medium">
                <Scale className="h-4 w-4 mr-1 text-blue-600" />
                <span>Describe the situation</span>
              </div>
              
              {hasRecognitionSupport && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVoiceInput}
                  className={`flex items-center gap-1 ${listening ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-primary/10 text-primary border-primary/30'}`}
                >
                  {listening ? (
                    <>
                      <StopCircle className="h-4 w-4" /> Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" /> Voice Input
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {listening && (
              <div className="bg-muted p-2 rounded text-foreground text-sm flex items-center">
                <Mic className="h-4 w-4 mr-2 text-destructive animate-pulse" />
                Listening... speak the situation details
              </div>
            )}
            
            <Textarea
              value={situationInput}
              onChange={(e) => setSituationInput(e.target.value)}
              placeholder="E.g.: Subject was observed taking merchandise valued at $75 from a store without paying and concealing it in their backpack..."
              className="min-h-[120px] bg-white text-slate-900 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
            />
            

            
            <Button 
              onClick={handleSituationAnalysis}
              disabled={!situationInput.trim() || isLoading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Scale className="h-4 w-4 mr-2" />
              )}
              Analyze & Suggest Charges
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      
      {isLoading && (
        <div className="flex items-center justify-center p-6">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
            <p className="text-muted-foreground text-sm">Analyzing Louisiana statutes...</p>
          </div>
        </div>
      )}
      
      {(result || suggestedCharges.length > 0) && !isLoading && (
        <div ref={resultRef} className="mt-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Analysis Result
                </CardTitle>
                {isSpeaking ? (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={stopSpeaking}
                className="text-xs h-7 px-2 text-destructive border-destructive/30 bg-destructive/10 hover:bg-destructive/20"
              >
                <Volume2 className="h-3 w-3 mr-1 animate-pulse" /> Stop Audio
              </Button>
            ) : (
              result && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    // Build a complete spoken summary including all charges and the bottom summary
                    let fullSummary = ''; // Initialize fullSummary properly
                    // Add each charge
                    if (suggestedCharges.length > 0) {
                      suggestedCharges.forEach((charge, index) => {
                        fullSummary += `${charge.code}, ${charge.name}. ${charge.reason}. `;
                        
                        if (index < suggestedCharges.length - 1) {
                          fullSummary += "Next, ";
                        }
                      });
                      
                      // Add the bottom summary
                      if (result) {
                        fullSummary += ` In conclusion, ${result}`;
                      }
                    } else if (result) {
                      fullSummary += result;
                    }
                    
                    synthesizeSpeech(fullSummary);
                  }}
                  className="text-xs h-7 px-2 text-primary border-primary/30 bg-primary/10 hover:bg-primary/20"
                >
                  <Volume2 className="h-3 w-3 mr-1" /> Read Result
                </Button>
              )
                )}  
              </div>
            </CardHeader>
            <CardContent>
              {suggestedCharges.length > 0 && (
                <div className="space-y-3 mb-4">
                  {suggestedCharges.map((charge, index) => (
                    <div 
                      key={index} 
                      className="bg-card p-3 rounded border border-border hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => handleQuickCodeSelect(charge.code)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium text-primary">
                          {charge.code}
                        </div>
                        <Badge variant="outline" className="text-xs bg-muted text-foreground">
                          {charge.name}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{charge.reason}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {result && (
                <div className="p-4 bg-card rounded border border-border">
                  <div className="text-foreground whitespace-pre-line text-sm">
                    {result}
                  </div>
                </div>
              )}
                
              {activeTab === 'analyze' && suggestedCharges.length > 0 && (
                <div className="mt-4 text-xs text-blue-400/70 italic">
                  Note: Click on any charge above to lookup its full statutory details
                </div>
              )}
              
              <div className="additional-charge-input mt-4">
                <Textarea
                  placeholder="Suggest an additional charge..."
                  value={additionalCharge}
                  onChange={(e) => setAdditionalCharge(e.target.value)}
                  className="mb-2"
                />
                <Button onClick={handleAdditionalChargeSubmit}>Submit Charge</Button>
                {additionalChargeResponse && (
                  <div className="p-4 bg-card rounded border border-border mt-4">
                    <div className="text-foreground whitespace-pre-line text-sm">
                      {additionalChargeResponse}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="flex justify-between w-full items-center">
                <span className="text-xs text-muted-foreground">Powered by LiveKit AI</span>
                {statuteUrl && (
                  <a 
                    href={statuteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    <Link2 className="h-3 w-3" /> View Official Statute
                  </a>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
} 