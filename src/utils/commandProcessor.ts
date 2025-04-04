
import { OFFLINE_DATA } from './offlineData';
import { queryOpenAI } from './openAIService';

type CommandResult = {
  intent: string;
  text?: string;
  statute?: string;
  description?: string;
  steps?: string[];
  response?: string;
  language?: string;
  question?: string;
};

export async function processCommand(command: string): Promise<CommandResult> {
  const lowerCommand = command.toLowerCase();
  
  // Miranda Rights - Now ask for language
  if (lowerCommand.includes('miranda') || lowerCommand.includes('rights')) {
    // If language is already specified in the command
    let lang = 'english';
    if (lowerCommand.includes('spanish')) lang = 'spanish';
    if (lowerCommand.includes('mandarin') || lowerCommand.includes('chinese')) lang = 'mandarin';
    if (lowerCommand.includes('french')) lang = 'french';
    if (lowerCommand.includes('vietnamese')) lang = 'vietnamese';
    
    if (lang === 'english' && !lowerCommand.includes('english') && 
        !lowerCommand.includes('spanish') && 
        !lowerCommand.includes('mandarin') && 
        !lowerCommand.includes('chinese') && 
        !lowerCommand.includes('french') && 
        !lowerCommand.includes('vietnamese')) {
      // Ask for language if not specified
      return { 
        intent: 'miranda_language_request', 
        response: "What language would you like the Miranda Rights in?" 
      };
    }
    
    return { 
      intent: 'miranda_rights', 
      text: OFFLINE_DATA.mirandaRights[lang as keyof typeof OFFLINE_DATA.mirandaRights],
      language: lang 
    };
  } 
  
  // Dispatch Connect - Enhanced to relay information
  else if (lowerCommand.includes('dispatch') || lowerCommand.includes('connect')) {
    // Extract what to tell dispatch after "tell dispatch" or similar phrases
    const messageToDispatchMatch = command.match(/(?:tell|inform|notify|alert)\s+dispatch\s+(?:to|about|that)?\s*(.*)/i);
    const messageToDispatch = messageToDispatchMatch ? messageToDispatchMatch[1].trim() : "";
    
    if (messageToDispatch) {
      return { 
        intent: 'dispatch_connect', 
        response: `Dispatching message: "${messageToDispatch}". Standby for response.` 
      };
    } else {
      return { 
        intent: 'dispatch_connect', 
        response: "Establishing connection with dispatch. What would you like to relay to dispatch?" 
      };
    }
  }
  
  // AR Path (enhanced)
  else if (lowerCommand.includes('ar path') || lowerCommand.includes('augmented reality')) {
    return {
      intent: 'ar_path',
      response: "AR navigation path activated. Follow the highlighted route."
    };
  }

  // Sonic Disrupter (enhanced)
  else if (lowerCommand.includes('sonic') || lowerCommand.includes('disrupter') || lowerCommand.includes('disruptor')) {
    return {
      intent: 'sonic_disrupter',
      response: "Sonic disrupter armed. Ready for deployment on command."
    };
  }
  
  // RS Codes lookup with AI (enhanced statute lookup)
  else if (lowerCommand.includes('statute') || lowerCommand.includes('law') || 
           lowerCommand.includes('penalty') || lowerCommand.includes('rs code') || 
           lowerCommand.includes('revised statute') || lowerCommand.includes('crime')) {
           
    // First try exact matches from our database
    if (lowerCommand.includes('$5000') || lowerCommand.includes('5000') || lowerCommand.includes('five thousand')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.theft_over_5000.statute, 
        description: OFFLINE_DATA.statutes.theft_over_5000.description 
      };
    } else if (lowerCommand.includes('$1000') || lowerCommand.includes('1000') || lowerCommand.includes('thousand')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.theft_1000_to_5000.statute, 
        description: OFFLINE_DATA.statutes.theft_1000_to_5000.description 
      };
    } else if (lowerCommand.includes('peace') || lowerCommand.includes('disturb')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.disturbing_peace.statute, 
        description: OFFLINE_DATA.statutes.disturbing_peace.description 
      };
    } else if (lowerCommand.includes('crowd') || lowerCommand.includes('control') || lowerCommand.includes('group')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.crowd_control.statute, 
        description: OFFLINE_DATA.statutes.crowd_control.description 
      };
    } else if (lowerCommand.includes('dui') || lowerCommand.includes('driving') || lowerCommand.includes('drunk')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.dui_first.statute, 
        description: OFFLINE_DATA.statutes.dui_first.description 
      };
    } else if (lowerCommand.includes('lawnmower')) {
      return { 
        intent: 'statute_lookup', 
        statute: OFFLINE_DATA.statutes.theft_1000_to_5000.statute, 
        description: OFFLINE_DATA.statutes.theft_1000_to_5000.description 
      };
    } else {
      // Use AI to find the most relevant statute
      try {
        const query = `Given this incident description: "${command}". What Louisiana Revised Statute (RS Code) would be most applicable? Provide the statute number and a brief description of the charge. Format as 'RS Code: [code number], Description: [brief description]'`;
        const aiResponse = await queryOpenAI(query);
        
        // Try to extract RS code and description from AI response
        const rsCodeMatch = aiResponse.match(/RS\s*Code:\s*([^,]+),/i);
        const descriptionMatch = aiResponse.match(/Description:\s*(.+)/i);
        
        const rsCode = rsCodeMatch ? rsCodeMatch[1].trim() : "Statute not found";
        const description = descriptionMatch ? descriptionMatch[1].trim() : aiResponse;
        
        return { 
          intent: 'statute_lookup', 
          statute: rsCode, 
          description: description 
        };
      } catch (error) {
        console.error('Error getting AI statute lookup:', error);
        return { 
          intent: 'statute_lookup', 
          statute: "Error finding statute", 
          description: "Unable to determine applicable statute. Please try again with more details." 
        };
      }
    }
  } 
  
  // Handle standard AI responses for everything else
  else {
    try {
      const aiResponse = await queryOpenAI(command);
      return { 
        intent: 'ai_response', 
        response: aiResponse 
      };
    } catch (error) {
      console.error('Error getting AI response:', error);
      return { 
        intent: 'unknown_command', 
        response: 'Command not recognized. Try "Miranda Rights" or "What statute applies to theft?"' 
      };
    }
  }
}

export async function handleCommand(command: string, trainingMode: boolean): Promise<CommandResult> {
  // Check for system commands first
  if (command.toLowerCase().includes('enable training')) {
    return { intent: 'enable_training', response: 'Training mode enabled.' };
  }
  
  if (command.toLowerCase().includes('disable training')) {
    return { intent: 'disable_training', response: 'Training mode disabled.' };
  }
  
  if (command.toLowerCase().includes('set voice speed')) {
    let speed;
    if (command.toLowerCase().includes('slow')) speed = 0.8;
    else if (command.toLowerCase().includes('fast')) speed = 1.2;
    else speed = 1.0;
    
    return { intent: 'set_voice_speed', response: `Voice speed set to ${speed === 0.8 ? 'slow' : speed === 1.2 ? 'fast' : 'normal'}.` };
  }
  
  if (command.toLowerCase().includes('set volume')) {
    let volume;
    if (command.toLowerCase().includes('low')) volume = 0.3;
    else if (command.toLowerCase().includes('high')) volume = 0.8;
    else volume = 0.5;
    
    return { intent: 'set_volume', response: `Volume set to ${volume === 0.3 ? 'low' : volume === 0.8 ? 'high' : 'medium'}.` };
  }
  
  if (command.toLowerCase().includes('enable low power')) {
    return { intent: 'enable_low_power', response: 'Low power mode enabled.' };
  }
  
  if (command.toLowerCase().includes('disable low power')) {
    return { intent: 'disable_low_power', response: 'Low power mode disabled.' };
  }
  
  if (command.toLowerCase().includes('enable high contrast')) {
    return { intent: 'enable_high_contrast', response: 'High contrast mode enabled.' };
  }
  
  if (command.toLowerCase().includes('disable high contrast')) {
    return { intent: 'disable_high_contrast', response: 'High contrast mode disabled.' };
  }
  
  // Handle training mode
  if (trainingMode) {
    return { intent: 'training_mode', response: `Training mode: ${command}` };
  }
  
  // Process regular commands
  return processCommand(command);
}
