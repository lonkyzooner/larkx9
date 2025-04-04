import React, { useState, useEffect, useRef } from 'react';
import { useSimulatedTTS } from '../hooks/useSimulatedTTS.tsx';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { getGeneralKnowledge, getLegalInformation } from '../lib/openai-service';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import OpenAIVoiceTest from './OpenAIVoiceTest';
import { 
  FileTextIcon, 
  MicIcon, 
  StopCircleIcon, 
  CameraIcon, 
  ScanLineIcon,
  ScaleIcon, 
  ShieldIcon, 
  GlobeIcon, 
  MapIcon,
  UserIcon,
  CarIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  CheckCircleIcon,
  FlameIcon,
  BookIcon,
  ImageIcon,
  Mic2Icon,
  BuildingIcon,
  TargetIcon,
  VolumeIcon
} from 'lucide-react';

export function Tools() {
  const [activeTab, setActiveTab] = useState('interview');
  const { speak, speaking, stop } = useSimulatedTTS();
  const { transcript, listening, startListening, stopListening } = useSpeechRecognition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [interviewData, setInterviewData] = useState({ name: '', license: '', address: '', reason: '' });
  const [reportText, setReportText] = useState('');
  const [generatedReport, setGeneratedReport] = useState('');
  const [useOfForceDescription, setUseOfForceDescription] = useState('');
  const [forcePolicyResult, setForcePolicyResult] = useState('');
  const [caseLawQuery, setCaseLawQuery] = useState('');
  const [caseLawResult, setCaseLawResult] = useState('');
  const [statuteQuery, setStatuteQuery] = useState('');
  const [statuteResult, setStatuteResult] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scannedDocument, setScannedDocument] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any>(null);
  const [mapLocation, setMapLocation] = useState('');
  const [showMap, setShowMap] = useState(false);
  
  // Handle voice recording for reports
  const handleReportRecording = () => {
    if (listening) {
      stopListening();
      if (transcript) {
        setReportText(transcript);
      }
    } else {
      startListening();
    }
  };
  
  // Generate police report from dictation
  const generateReport = async () => {
    if (!reportText.trim()) return;
    
    setIsProcessing(true);
    try {
      const prompt = `
        As a police report generator, convert this officer's dictation into a properly formatted police report:
        
        ${reportText}
        
        Format it with proper sections including:
        - Incident information
        - Parties involved
        - Narrative
        - Actions taken
        - Evidence collected (if any)
        - Follow-up needed (if any)
      `;
      
      const response = await getGeneralKnowledge(prompt);
      setGeneratedReport(response);
      speak("Report has been generated based on your dictation");
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Simulate license plate lookup
  const lookupPlate = () => {
    if (!plateNumber.trim()) return;
    
    setIsProcessing(true);
    setTimeout(() => {
      // Simulated plate data
      const plateData = {
        plate: plateNumber.toUpperCase(),
        vehicle: "2020 Toyota Camry",
        color: "Black",
        status: "Valid Registration",
        owner: "John Doe",
        violations: "None",
        alerts: "None"
      };
      
      // Text-to-speech response
      const response = `Plate ${plateNumber.toUpperCase()} belongs to a 2020 Toyota Camry. Registration is valid. No alerts.`;
      speak(response);
      
      setIsProcessing(false);
    }, 2000);
  };
  
  // Simulate document scanning
  const scanDocument = () => {
    setShowScanner(true);
    setIsProcessing(true);
    
    // Simulate scanning process
    setTimeout(() => {
      // Mock data for Louisiana driver's license
      setScannedDocument('/driver-license-la.jpg');
      setScannedData({
        type: "Louisiana Driver's License",
        number: "1234567",
        name: "SMITH, JOHN D",
        address: "123 MAIN ST, BATON ROUGE LA 70801",
        dob: "01/15/1985",
        expiration: "01/15/2026",
        class: "E",
        restrictions: "NONE"
      });
      
      speak("Document scan complete. Louisiana driver's license for John Smith identified.");
      setIsProcessing(false);
    }, 3000);
  };
  
  // Handle use of force policy inquiry
  const analyzeUseOfForce = async () => {
    if (!useOfForceDescription.trim()) return;
    
    setIsProcessing(true);
    try {
      const prompt = `
        As a use-of-force policy expert for Louisiana law enforcement, analyze this situation and provide guidance:
        
        Situation: ${useOfForceDescription}
        
        Provide: 
        1. Analysis of appropriate force level
        2. Relevant department policies that apply
        3. Key considerations for officer safety
        4. Documentation requirements
        5. Any warnings or cautions
        
        Format your response in clear sections.
      `;
      
      const response = await getGeneralKnowledge(prompt);
      setForcePolicyResult(response);
      speak("Force analysis complete. Please review on screen.");
    } catch (error) {
      console.error("Error analyzing use of force:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Look up case law
  const lookupCaseLaw = async () => {
    if (!caseLawQuery.trim()) return;
    
    setIsProcessing(true);
    try {
      const prompt = `
        As a legal expert on Louisiana and federal case law relevant to law enforcement, provide a summary of significant cases and precedents related to:
        
        ${caseLawQuery}
        
        Include:
        - Names of relevant cases
        - Brief facts of each case
        - The court's decision
        - How it affects police procedure
        - Current best practices based on this case law
      `;
      
      const response = await getGeneralKnowledge(prompt);
      setCaseLawResult(response);
      speak("Case law analysis complete.");
    } catch (error) {
      console.error("Error looking up case law:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Look up statutes and criminal codes
  const lookupStatute = async () => {
    if (!statuteQuery.trim()) return;
    
    setIsProcessing(true);
    try {
      const prompt = `
        As a legal expert on Louisiana criminal statutes and laws, provide detailed information about:
        
        ${statuteQuery}
        
        Include:
        - The specific statute number and title if applicable
        - Elements of the crime or violation
        - Classification (felony/misdemeanor) and potential penalties
        - Common defenses or exceptions
        - Important considerations for law enforcement
        - Related statutes or charges that might apply
        
        If this describes behavior but doesn't mention a specific statute, identify which Louisiana criminal statutes would apply to this situation.
      `;
      
      const response = await getGeneralKnowledge(prompt);
      setStatuteResult(response);
      speak("Statute information retrieved.");
    } catch (error) {
      console.error("Error looking up statute:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Load tactical map
  const loadTacticalMap = () => {
    if (!mapLocation.trim()) return;
    
    setIsProcessing(true);
    setTimeout(() => {
      setShowMap(true);
      speak(`Tactical map loaded for ${mapLocation}. Showing building layout and entry points.`);
      setIsProcessing(false);
    }, 2000);
  };
  
  return (
    <div className="bg-black/90 rounded-lg p-4 border border-blue-500/30">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-blue-400 font-mono">LARK Tools & Resources</h2>
        <Badge className="bg-blue-900/40 text-blue-300">
          Law Enforcement Tools
        </Badge>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 mb-4 bg-black/50 border border-blue-900/30 p-1 rounded-lg">
          <TabsTrigger value="interview" className="data-[state=active]:bg-blue-900/40 data-[state=active]:text-blue-300">
            <div className="flex items-center gap-1">
              <UserIcon className="h-4 w-4" />
              <span className="text-xs">Field Interview</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-blue-900/40 data-[state=active]:text-blue-300">
            <div className="flex items-center gap-1">
              <FileTextIcon className="h-4 w-4" />
              <span className="text-xs">Reports</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="lookup" className="data-[state=active]:bg-blue-900/40 data-[state=active]:text-blue-300">
            <div className="flex items-center gap-1">
              <CarIcon className="h-4 w-4" />
              <span className="text-xs">Vehicle/ID</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="legal" className="data-[state=active]:bg-blue-900/40 data-[state=active]:text-blue-300">
            <div className="flex items-center gap-1">
              <ScaleIcon className="h-4 w-4" />
              <span className="text-xs">Legal</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="voice" className="data-[state=active]:bg-blue-900/40 data-[state=active]:text-blue-300">
            <div className="flex items-center gap-1">
              <VolumeIcon className="h-4 w-4" />
              <span className="text-xs">Voice Test</span>
            </div>
          </TabsTrigger>
        </TabsList>
        
        {/* Field Interview Tab */}
        <TabsContent value="interview" className="space-y-4 mt-0">
          <Card className="bg-blue-950/10 border-blue-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                <FileSpreadsheetIcon className="h-4 w-4" />
                Field Interview Data Collection
              </CardTitle>
              <CardDescription className="text-blue-400/70 text-xs">
                Voice-guided interview template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-blue-300">Subject Name</label>
                  <Input 
                    placeholder="Full name"
                    className="bg-black/70 border-blue-900/50"
                    value={interviewData.name}
                    onChange={(e) => setInterviewData({...interviewData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-blue-300">ID/License #</label>
                  <Input 
                    placeholder="Identification number"
                    className="bg-black/70 border-blue-900/50"
                    value={interviewData.license}
                    onChange={(e) => setInterviewData({...interviewData, license: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-blue-300">Address</label>
                  <Input 
                    placeholder="Current address"
                    className="bg-black/70 border-blue-900/50"
                    value={interviewData.address}
                    onChange={(e) => setInterviewData({...interviewData, address: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-blue-300">Reason for Contact</label>
                  <Input 
                    placeholder="Reason for interview"
                    className="bg-black/70 border-blue-900/50"
                    value={interviewData.reason}
                    onChange={(e) => setInterviewData({...interviewData, reason: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-blue-300">Notes</label>
                <Textarea 
                  placeholder="Officer notes and observations"
                  className="bg-black/70 border-blue-900/50 min-h-[80px]"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end pt-2">
              <Button size="sm" className="bg-blue-700 hover:bg-blue-800">
                <Mic2Icon className="h-3 w-3 mr-1" /> 
                Start Guided Interview
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4 mt-0">
          <Card className="bg-blue-950/10 border-blue-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <FileTextIcon className="h-4 w-4" />
                Report Dictation
              </CardTitle>
              <CardDescription className="text-white/80 text-xs">
                Convert verbal report to formatted document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-white font-medium">Dictate your report:</div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleReportRecording}
                  className={listening ? "bg-red-900/30 text-red-400 border-red-800/50" : "bg-blue-900/30 text-white border-blue-800/50"}
                >
                  {listening ? (
                    <>
                      <StopCircleIcon className="h-3 w-3 mr-1" /> Stop Recording
                    </>
                  ) : (
                    <>
                      <MicIcon className="h-3 w-3 mr-1" /> Start Recording
                    </>
                  )}
                </Button>
              </div>
              
              {listening && (
                <div className="rounded p-2 bg-blue-900/20 flex items-center">
                  <MicIcon className="h-3 w-3 text-red-500 animate-pulse mr-2" />
                  <span className="text-xs text-blue-300">Recording...</span>
                </div>
              )}
              
              <Textarea 
                placeholder="Your dictation will appear here... or type manually"
                className="bg-black/70 border-blue-900/50 min-h-[200px] text-white"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
              />
              
              <Button 
                onClick={generateReport} 
                disabled={!reportText.trim() || isProcessing}
                className="w-full bg-blue-700 hover:bg-blue-800"
              >
                {isProcessing ? (
                  <>
                    <LoaderIcon className="h-4 w-4 mr-1 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <FileTextIcon className="h-4 w-4 mr-1" /> Generate Formatted Report
                  </>
                )}
              </Button>
              
              {generatedReport && (
                <div className="rounded border border-blue-900/50 bg-black/70 p-3 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium text-sm">Generated Report</h3>
                    <Badge className="bg-green-900/30 text-green-400 text-xs">
                      <CheckCircleIcon className="h-3 w-3 mr-1" /> Ready
                    </Badge>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="text-white text-sm whitespace-pre-line">
                      {generatedReport}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Vehicle/ID Lookup Tab */}
        <TabsContent value="lookup" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* License Plate Recognition */}
            <Card className="bg-blue-950/10 border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                  <CarIcon className="h-4 w-4" />
                  License Plate Lookup
                </CardTitle>
                <CardDescription className="text-blue-400/70 text-xs">
                  Scan or enter plate number
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter plate #"
                    className="bg-black/70 border-blue-900/50"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                  />
                  <Button 
                    size="icon" 
                    variant="outline"
                    className="bg-blue-900/30 border-blue-900/50"
                  >
                    <CameraIcon className="h-4 w-4 text-blue-300" />
                  </Button>
                </div>
                
                <Button 
                  onClick={lookupPlate} 
                  disabled={!plateNumber.trim() || isProcessing}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                >
                  {isProcessing ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    "Lookup Plate"
                  )}
                </Button>
                
                {plateNumber && !isProcessing && (
                  <div className="p-2 rounded bg-blue-900/20 text-sm text-blue-300">
                    Plate: {plateNumber.toUpperCase()}<br/>
                    Vehicle: 2020 Toyota Camry<br/>
                    Status: Valid Registration<br/>
                    Alerts: None
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Document Scanner */}
            <Card className="bg-blue-950/10 border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                  <ScanLineIcon className="h-4 w-4" />
                  Document Scanner
                </CardTitle>
                <CardDescription className="text-blue-400/70 text-xs">
                  Scan IDs and documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2">
                {!showScanner && !scannedDocument && (
                  <div className="border-2 border-dashed border-blue-900/30 rounded-lg p-6 flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-8 w-8 text-blue-900/50" />
                    <p className="text-blue-400/70 text-xs text-center">
                      Tap button below to scan ID or document
                    </p>
                  </div>
                )}
                
                {showScanner && isProcessing && (
                  <div className="border-2 border-blue-500/30 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-blue-900/10">
                    <LoaderIcon className="h-8 w-8 text-blue-400 animate-spin" />
                    <p className="text-blue-300 text-xs">Scanning document...</p>
                  </div>
                )}
                
                {scannedDocument && scannedData && (
                  <div className="border rounded-lg bg-black/50 p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-blue-300">{scannedData.type}</span>
                      <Badge className="bg-green-900/30 text-green-400 text-xs">Verified</Badge>
                    </div>
                    <div className="text-white/90 text-sm space-y-1">
                      <p>Name: {scannedData.name}</p>
                      <p>ID #: {scannedData.number}</p>
                      <p>DOB: {scannedData.dob}</p>
                      <p>Address: {scannedData.address}</p>
                      <p>Expiration: {scannedData.expiration}</p>
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={scanDocument} 
                  disabled={isProcessing}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                >
                  {isProcessing ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-1 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <ScanLineIcon className="h-4 w-4 mr-1" /> {scannedDocument ? "Scan New Document" : "Scan Document"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Legal Tab */}
        <TabsContent value="legal" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Statutes and Criminal Codes */}
            <Card className="bg-blue-950/10 border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                  <BookIcon className="h-4 w-4" />
                  Statutes & Criminal Codes
                </CardTitle>
                <CardDescription className="text-blue-400/70 text-xs">
                  Check crimes and applicable laws
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2">
                <div className="space-y-2">
                  <label className="text-xs text-blue-300">Describe crime or enter statute:</label>
                  <Textarea 
                    placeholder="e.g., 'Breaking into a vehicle at night' or 'RS 14:62 burglary'"
                    className="bg-black/70 border-blue-900/50 min-h-[80px]"
                    value={statuteQuery}
                    onChange={(e) => setStatuteQuery(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={lookupStatute} 
                  disabled={!statuteQuery.trim() || isProcessing}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                >
                  {isProcessing ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-1 animate-spin" /> Searching...
                    </>
                  ) : (
                    <>
                      <BookIcon className="h-4 w-4 mr-1" /> Check Applicable Laws
                    </>
                  )}
                </Button>
                
                {statuteResult && (
                  <div className="rounded border border-blue-900/50 bg-black/70 p-3 mt-2 max-h-[300px] overflow-y-auto">
                    <div className="text-white/90 text-sm whitespace-pre-line">
                      {statuteResult}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Case Law Summaries */}
            <Card className="bg-blue-950/10 border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                  <ScaleIcon className="h-4 w-4" />
                  Case Law Lookup
                </CardTitle>
                <CardDescription className="text-blue-400/70 text-xs">
                  Get relevant legal precedents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2">
                <div className="space-y-2">
                  <label className="text-xs text-blue-300">Search for cases related to:</label>
                  <Input 
                    placeholder="e.g., 'traffic stop consent search'"
                    className="bg-black/70 border-blue-900/50"
                    value={caseLawQuery}
                    onChange={(e) => setCaseLawQuery(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={lookupCaseLaw} 
                  disabled={!caseLawQuery.trim() || isProcessing}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                >
                  {isProcessing ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-1 animate-spin" /> Searching...
                    </>
                  ) : (
                    <>
                      <ScaleIcon className="h-4 w-4 mr-1" /> Find Relevant Cases
                    </>
                  )}
                </Button>
                
                {caseLawResult && (
                  <div className="rounded border border-blue-900/50 bg-black/70 p-3 mt-2 max-h-[300px] overflow-y-auto">
                    <div className="text-white/90 text-sm whitespace-pre-line">
                      {caseLawResult}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Use-of-Force Guidance */}
            <Card className="bg-blue-950/10 border-blue-900/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                  <ShieldIcon className="h-4 w-4" />
                  Use-of-Force Guidance
                </CardTitle>
                <CardDescription className="text-blue-400/70 text-xs">
                  Policy analysis for force situations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-2">
                <div className="space-y-2">
                  <label className="text-xs text-blue-300">Describe the situation:</label>
                  <Textarea 
                    placeholder="e.g., 'Subject is resisting arrest by pulling away, showing aggressive posture, but no weapons visible'"
                    className="bg-black/70 border-blue-900/50 min-h-[80px]"
                    value={useOfForceDescription}
                    onChange={(e) => setUseOfForceDescription(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={analyzeUseOfForce} 
                  disabled={!useOfForceDescription.trim() || isProcessing}
                  className="w-full bg-blue-700 hover:bg-blue-800"
                >
                  {isProcessing ? (
                    <>
                      <LoaderIcon className="h-4 w-4 mr-1 animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <FlameIcon className="h-4 w-4 mr-1" /> Analyze Force Options
                    </>
                  )}
                </Button>
                
                {forcePolicyResult && (
                  <div className="rounded border border-blue-900/50 bg-black/70 p-3 mt-2 max-h-[300px] overflow-y-auto">
                    <div className="text-white/90 text-sm whitespace-pre-line">
                      {forcePolicyResult}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Tactical Maps */}
          <Card className="bg-blue-950/10 border-blue-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                <MapIcon className="h-4 w-4" />
                Tactical Maps
              </CardTitle>
              <CardDescription className="text-blue-400/70 text-xs">
                Building layouts and tactical positioning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-2">
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter location or building name"
                  className="bg-black/70 border-blue-900/50 flex-1"
                  value={mapLocation}
                  onChange={(e) => setMapLocation(e.target.value)}
                />
                <Button 
                  onClick={loadTacticalMap}
                  disabled={!mapLocation.trim() || isProcessing}
                  className="bg-blue-700 hover:bg-blue-800 whitespace-nowrap"
                >
                  {isProcessing ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    "Load Map"
                  )}
                </Button>
              </div>
              
              {showMap && (
                <div className="border rounded-lg bg-black/50 p-3 h-[250px] relative">
                  <div className="absolute inset-0 bg-blue-950/40 flex flex-col items-center justify-center p-4">
                    <BuildingIcon className="h-16 w-16 text-blue-500/50 mb-2" />
                    <div className="text-center">
                      <h3 className="text-blue-300 text-sm mb-1">{mapLocation}</h3>
                      <p className="text-blue-400/70 text-xs">Building layout loaded</p>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <TargetIcon className="h-6 w-6 text-blue-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OpenAI Voice Test Tab */}
        <TabsContent value="voice" className="space-y-4 mt-0">
          <Card className="bg-blue-950/10 border-blue-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-300 text-sm flex items-center gap-2">
                <VolumeIcon className="h-4 w-4" />
                OpenAI Voice Synthesis Test
              </CardTitle>
              <CardDescription className="text-blue-400/70 text-xs">
                Test the new OpenAI text-to-speech functionality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OpenAIVoiceTest />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 