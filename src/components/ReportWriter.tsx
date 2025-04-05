import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, CheckIcon, AlertTriangleIcon, InfoIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { groqService } from '../services/groq/GroqService';
import { useToast } from './ui/use-toast';

export function ReportWriter() {
  const [reportText, setReportText] = useState('');
  const [reviewedReport, setReviewedReport] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('12:00');
  const [reviewFeedback, setReviewFeedback] = useState<{
    jargon: string[];
    missingDetails: string[];
    inconsistencies: string[];
    suggestions: string[];
    overallScore: number;
  } | null>(null);
  
  const { toast } = useToast();

  // Generate times for the time selector (30 minute intervals)
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return {
      value: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
    };
  });

  // Handle report submission for review
  const handleReviewReport = async () => {
    if (!reportText.trim()) {
      toast({
        title: "Empty Report",
        description: "Please enter some text for your report before submitting for review.",
        variant: "destructive"
      });
      return;
    }

    setIsReviewing(true);
    
    try {
      // Format the prompt for the AI to review the report
      const prompt = `
You are a law enforcement report reviewer. Review the following police report and provide feedback on:
1. Police jargon that might be unclear to the average reader
2. Missing details that should be included
3. Inconsistencies or vague statements
4. Suggestions for improvement
5. Overall assessment (score 1-10)

Format your response as JSON with the following structure:
{
  "jargon": ["term 1 - explanation", "term 2 - explanation"],
  "missingDetails": ["missing detail 1", "missing detail 2"],
  "inconsistencies": ["inconsistency 1", "inconsistency 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "overallScore": number
}

REPORT:
Date: ${date ? format(date, 'PPP') : 'Not specified'}
Time: ${time}

${reportText}
`;

      // Use Groq service for faster processing
      const response = await groqService.generateText(prompt);
      
      // Parse the response
      let feedbackData;
      try {
        // Extract JSON from the response if it's wrapped in text
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/\{[\s\S]*\}/);
        
        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
        feedbackData = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Error parsing feedback:', parseError);
        // Fallback to showing the raw response
        setReviewedReport(response || 'Error analyzing report');
        setReviewFeedback(null);
        return;
      }
      
      // Set the feedback data
      setReviewFeedback(feedbackData);
      
      // Generate an improved version of the report
      const improvePrompt = `
You are a law enforcement report writing assistant. Based on the feedback provided, generate an improved version of the police report below. DO NOT ADD ANY NEW INFORMATION OR FACTS that weren't in the original report. Only improve clarity, remove jargon, add necessary details that were mentioned as missing, and fix inconsistencies.

Original Report:
Date: ${date ? format(date, 'PPP') : 'Not specified'}
Time: ${time}

${reportText}

Feedback: ${JSON.stringify(feedbackData)}

Improved Report:
`;

      const improvedResponse = await groqService.generateText(improvePrompt);
      setReviewedReport(improvedResponse || 'Error generating improved report');
      
    } catch (error) {
      console.error('Error reviewing report:', error);
      toast({
        title: "Review Failed",
        description: "There was an error reviewing your report. Please try again.",
        variant: "destructive"
      });
      setReviewedReport('Error analyzing report. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleUseImprovedReport = () => {
    if (reviewedReport) {
      setReportText(reviewedReport);
      setReviewedReport(null);
      setReviewFeedback(null);
      toast({
        title: "Report Updated",
        description: "The improved report has been applied.",
        variant: "success"
      });
    }
  };

  const handleDiscardReview = () => {
    setReviewedReport(null);
    setReviewFeedback(null);
  };

  return (
    <div className="report-writer-container p-4 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Writer</CardTitle>
          <CardDescription>
            Create and review your incident reports with AI assistance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-row space-x-4 mb-4">
              <div className="w-1/2">
                <Label htmlFor="date" className="block mb-2">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      id="date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-1/2">
                <Label htmlFor="time" className="block mb-2">Time</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger id="time" className="w-full">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Label htmlFor="report" className="block mb-2">Report Content</Label>
            <Textarea
              id="report"
              placeholder="Enter your report details here..."
              className="min-h-[300px] font-mono text-sm"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setReportText('')}>
            Clear
          </Button>
          <Button 
            onClick={handleReviewReport} 
            disabled={isReviewing || !reportText.trim()}
          >
            {isReviewing ? 'Reviewing...' : 'Review Report'}
          </Button>
        </CardFooter>
      </Card>

      {reviewedReport && (
        <Card className="mb-6 border-blue-500 shadow-md">
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
            <CardTitle className="flex items-center">
              <InfoIcon className="mr-2 h-5 w-5 text-blue-500" />
              Report Review
            </CardTitle>
            <CardDescription>
              LARK has analyzed your report and provided feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {reviewFeedback && (
              <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Overall Score</h3>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    reviewFeedback.overallScore >= 8 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                    reviewFeedback.overallScore >= 5 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  )}>
                    {reviewFeedback.overallScore}/10
                  </div>
                </div>
                
                {reviewFeedback.jargon.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <AlertTriangleIcon className="mr-2 h-4 w-4 text-yellow-500" />
                      Police Jargon
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {reviewFeedback.jargon.map((item, index) => (
                        <li key={`jargon-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {reviewFeedback.missingDetails.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <AlertTriangleIcon className="mr-2 h-4 w-4 text-red-500" />
                      Missing Details
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {reviewFeedback.missingDetails.map((item, index) => (
                        <li key={`missing-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {reviewFeedback.inconsistencies.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <AlertTriangleIcon className="mr-2 h-4 w-4 text-orange-500" />
                      Inconsistencies
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {reviewFeedback.inconsistencies.map((item, index) => (
                        <li key={`inconsistency-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {reviewFeedback.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <CheckIcon className="mr-2 h-4 w-4 text-green-500" />
                      Suggestions
                    </h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {reviewFeedback.suggestions.map((item, index) => (
                        <li key={`suggestion-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <h3 className="text-lg font-medium mb-3">Improved Report</h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
                {reviewedReport}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleDiscardReview}>
              Discard Review
            </Button>
            <Button onClick={handleUseImprovedReport}>
              Use Improved Report
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
