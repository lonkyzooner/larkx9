import OpenAI from 'openai';
import { matchCommand as matchLocalCommand } from './command-matcher';
import { processOfflineCommand } from './offline-commands';
import { processCommandChain } from './command-chain-processor';
import { commandContext } from './command-context';
import { commandAnalytics } from './command-analytics';
import { commandPredictor } from './command-predictor';
import { commandLearning } from './command-learning';

// Initialize OpenAI with environment variable
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
  console.error('OpenAI API key not found in environment variables');
}

// Fallback API key in case environment variable is not available
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: apiKey || OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side usage
});

console.log('OpenAI service initialized with API key:', apiKey ? 'From environment' : 'Using fallback key');

// Command execution state and types
type CommandState = {
  inProgress: boolean;
  lastCommand?: string;
  lastAction?: string;
  context: Record<string, unknown>;
  offline: boolean;
};

const commandState: CommandState = {
  inProgress: false,
  context: {},
  offline: false // Track offline status
};

// Check internet connectivity
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/engines', {
      method: 'HEAD'
    });
    commandState.offline = !response.ok;
    return response.ok;
  } catch (error) {
    console.log('Network connectivity issue detected, switching to offline mode');
    commandState.offline = true;
    return false;
  }
}

export interface CommandParameters {
  language?: string;
  statute?: string;
  threat?: string;
  query?: string;
  location?: string; // Added location parameter
}

export interface CommandResponse {
  command: string;
  action: 'miranda' | 'statute' | 'threat' | 'tactical' | 'unknown' | 'general_query';
  parameters?: CommandParameters;
  executed: boolean;
  result?: string;
  error?: string;
  metadata?: Record<string, any>;
}

import { matchCommand } from './command-matcher';

// Process and execute voice commands
export async function processVoiceCommand(transcript: string): Promise<CommandResponse> {
  console.log('Processing voice command:', transcript);
  const startTime = Date.now();
  
  // For text chat input, we want to ensure commands are always processed
  // even if another command is in progress
  if (commandState.inProgress) {
    console.log('Command processing already in progress, but proceeding for text input');
    // We'll continue processing for text input to improve responsiveness
  }
  
  // Check for command corrections
  const correctedCommand = commandLearning.suggestCorrection(transcript);
  if (correctedCommand && correctedCommand !== transcript.toLowerCase()) {
    console.log(`Corrected command: ${transcript} -> ${correctedCommand}`);
    transcript = correctedCommand;
  }
  
  commandState.inProgress = true;
  commandState.lastCommand = transcript;

  try {
    // Check for command chain
    if (transcript.includes(' and ') || transcript.includes(' then ')) {
      console.log('Detected command chain, processing multiple commands');
      const results = await processCommandChain(transcript);
      commandState.inProgress = false;
      // Return the last command's result
      return results[results.length - 1];
    }

    // First, try offline command processing
    const offlineResult = await processOfflineCommand(transcript);
    if (offlineResult) {
      console.log('Command processed offline:', offlineResult);
      commandState.inProgress = false;
      commandAnalytics.recordCommand({
        command: transcript,
        success: true,
        responseTime: Date.now() - startTime,
        confidence: 1.0,
        offline: true,
        commandType: offlineResult.action || 'general_query'
      });
      return offlineResult;
    }

    // Then, try local command matching
    const localMatch = matchLocalCommand(transcript);
    if (localMatch) {
      console.log('Command matched locally:', localMatch);
      const result = await executeCommand(localMatch);
      commandState.inProgress = false;
      commandAnalytics.recordCommand({
        command: transcript,
        success: result.executed,
        responseTime: Date.now() - startTime,
        confidence: 0.9,
        offline: true,
        commandType: result.action || 'general_query'
      });
      return result;
    }

    // Check connectivity before using OpenAI
    if (!await checkConnectivity()) {
      console.log('No internet connection, limited to offline commands');
      commandState.inProgress = false;
      return {
        command: transcript,
        action: 'unknown',
        executed: false,
        error: 'No internet connection. Only basic commands are available.'
      };
    }

    console.log('Using OpenAI for command interpretation');

    const prompt = `
      As LARK (Law Enforcement Assistance and Response Kit), I need to interpret voice commands from police officers.
      Based on the following transcript, determine the command and action required:

      Command categories:
      - "miranda": Read Miranda rights (parameters: language)
      - "statute": Look up a statute (parameters: statute number)
      - "threat": Identify potential threats
      - "tactical": Provide tactical guidance
      - "general_query": Answer a general question or request that doesn't fit the other categories
      - "unknown": Command not recognized

      Transcript: "${transcript}"

      Respond with JSON only in this format:
      {
        "command": "original command",
        "action": "miranda|statute|threat|tactical|general_query|unknown",
        "parameters": {
          "language": "english|spanish|french|vietnamese|mandarin|arabic",
          "statute": "statute number",
          "threat": "description",
          "query": "the query to answer if it's a general question"
        }
      }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are LARK, a police officer's AI assistant, operating like JARVIS from Iron Man. You process voice commands, provide translations, and return structured responses in a professional yet conversational manner." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0].message.content;
    
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(responseText) as CommandResponse;
      console.log('Parsed OpenAI response:', parsedResponse);
      
      // Execute the identified command
      const result = await executeCommand(parsedResponse);
      console.log('Command execution result:', result);
      
      commandState.inProgress = false;
      return result;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // If JSON parsing fails, try to use the raw response as a general query
      const fallbackResponse: CommandResponse = {
        command: transcript,
        action: 'general_query',
        parameters: { query: transcript },
        executed: true,
        result: responseText
      };
      
      commandState.inProgress = false;
      return fallbackResponse;
    }
  } catch (error) {
    console.error("Error processing voice command:", error);
    commandState.inProgress = false;
    return {
      command: transcript,
      action: "unknown",
      executed: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Get information about a specific legal statute
export async function getLegalInformation(statute: string): Promise<string> {
  try {
    const prompt = `
      As a legal assistant specialized in Louisiana law, provide information about the following statute:
      ${statute}
      
      If this is a valid Louisiana statute, provide a brief explanation in a professional tone.
      If this is not a valid statute, indicate that it could not be found.
      Keep your response concise and focused on the legal facts.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are LARK's legal module, operating like JARVIS from Iron Man. You specialize in Louisiana law and can provide translations of legal terms and concepts while maintaining a professional yet conversational tone." },
        { role: "user", content: prompt }
      ]
    });

    return completion.choices[0].message.content || "Unable to retrieve information for this statute.";
  } catch (error) {
    console.error("Error getting legal information:", error);
    return "An error occurred while retrieving statute information.";
  }
}

// General knowledge query function for answering any law enforcement related questions
export async function getGeneralKnowledge(query: string): Promise<string> {
  try {
    const systemPrompt = `
      You are LARK (Law Enforcement Assistance and Response Kit), an AI assistant designed specifically for police officers in Louisiana.
      
      Guidelines:
      - Provide accurate, concise, and helpful information relevant to law enforcement.
      - Prioritize officer safety and legal compliance in all answers.
      - Format responses for easy reading on a body-mounted display.
      - When discussing laws, focus on Louisiana statutes when applicable.
      - Include relevant statute numbers when appropriate.
      - Be conversational but professional, you are sort of like JARVIS from Iron Man.
      - Avoid lengthy explanations unless requested.
      - Never suggest actions that would violate civil rights or proper procedure.
      - you can provide translation services as well.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content || "I'm unable to answer that question at the moment.";
  } catch (error) {
    console.error("Error getting general knowledge:", error);
    return "I apologize, but I'm experiencing a technical issue retrieving that information.";
  }
}

// Function for tactical situation assessment
// Execute identified commands
async function executeCommand(command: CommandResponse): Promise<CommandResponse> {
  try {
    let result = '';
    console.log('Executing command:', command.action, command);
    
    // Handle case where command might be undefined or null
    if (!command || !command.action) {
      return {
        command: command?.command || 'Unknown command',
        action: 'general_query',
        executed: true,
        result: 'I\'m not sure how to process that command. Could you please rephrase it?'
      };
    }
    
    switch (command.action) {
      case 'miranda':
        // Use command context for language preference
        const language = command.parameters?.language || commandContext.getLanguagePreference() || 'english';
        commandContext.setLanguagePreference(language);
        result = `Miranda rights will be read in ${language}`;
        
        // Return with specific metadata to ensure the language is passed to the UI
        return {
          ...command,
          executed: true,
          result,
          metadata: { language }
        };
        break;
        
      case 'statute':
        if (command.parameters?.statute) {
          commandContext.setLastStatute(command.parameters.statute);
          result = await getLegalInformation(command.parameters.statute);
        } else {
          // Try to use last accessed statute from context
          const lastStatute = commandContext.getLastStatute();
          if (lastStatute) {
            result = await getLegalInformation(lastStatute);
          } else {
            // For general statute queries without a specific statute
            result = await getGeneralKnowledge(command.command);
          }
        }
        break;
        
      case 'threat':
        // Use command context for threat assessment
        commandContext.updateThreatContext(command.parameters?.location);
        
        // If recent assessment exists, include it in the response
        if (commandContext.isRecentThreatAssessment()) {
          const lastAssessment = commandContext.getLastThreatAssessment();
          if (lastAssessment && lastAssessment.timestamp) {
            result = `Recent threat assessment from ${new Date(lastAssessment.timestamp).toLocaleTimeString()}: `;
          }
        }
        
        result += await assessThreatLevel(command.parameters?.threat || command.command);
        break;
        
      case 'tactical':
        result = await assessTacticalSituation(command.command);
        break;
        
      case 'general_query':
        result = await getGeneralKnowledge(command.parameters?.query || command.command);
        break;
        
      case 'unknown':
        // For unknown commands, treat them as general queries
        result = await getGeneralKnowledge(command.command);
        break;
        
      default:
        // Default to general knowledge for any unrecognized action
        result = await getGeneralKnowledge(command.command);
    }
    
    return {
      ...command,
      executed: true,
      result
    };
  } catch (error) {
    return {
      ...command,
      executed: false,
      error: error instanceof Error ? error.message : 'Error executing command'
    };
  }
}

// New function to assess threat levels
async function assessThreatLevel(situation: string): Promise<string> {
  const prompt = `
    As LARK, assess the following situation for potential threats:
    ${situation}
    
    Consider:
    - Immediate dangers
    - Suspicious behaviors
    - Environmental hazards
    - Tactical considerations
    
    Provide a concise threat assessment with recommended actions.
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are LARK's threat assessment module, operating like JARVIS from Iron Man. Provide clear, actionable threat assessments while maintaining a professional yet conversational tone. You can translate threats described in other languages when needed." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7
  });

  return completion.choices[0].message.content || "Unable to assess threat level.";
}

export async function assessTacticalSituation(situation: string): Promise<string> {
  try {
    const systemPrompt = `
      You are LARK, a tactical assessment assistant for police officers in Louisiana.
      Your purpose is to analyze situation descriptions and provide tactical considerations.
      
      Guidelines:
      - Always prioritize officer safety above all else
      - Be conversational but professional, like JARVIS from Iron Man
      - Provide clear, actionable advice
      - Avoid lengthy explanations unless requested
      - Never suggest actions that would violate civil rights or proper procedure
      - You can provide translation services when needed
      - Consider potential threats and recommend appropriate responses
      - Cite relevant protocols or training standards when applicable
      - Be concise and direct - officers may be in time-sensitive situations
      - Format responses for easy reading in stressful situations
      - Never recommend excessive force or actions that violate proper procedure
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Assess this situation and provide tactical considerations: ${situation}` }
      ],
      temperature: 0.5
    });

    return completion.choices[0].message.content || "Unable to assess tactical situation.";
  } catch (error) {
    console.error("Error assessing tactical situation:", error);
    return "Unable to process tactical assessment at this time.";
  }
} 