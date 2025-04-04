import { CommandResponse } from './openai-service';

interface ChainedCommand {
  command: string;
  startIndex: number;
  endIndex: number;
}

const COMMAND_SEPARATORS = [
  'and',
  'then',
  'after that',
  'next',
  'also',
  'additionally'
];

const COMMAND_BOUNDARIES = [
  'first',
  'second',
  'third',
  'finally',
  'lastly',
  'begin by',
  'start by',
  'end with'
];

export async function processCommandChain(transcript: string): Promise<CommandResponse[]> {
  // Split transcript into individual commands
  const commands = splitCommands(transcript);
  
  // Process each command in sequence
  const results: CommandResponse[] = [];
  
  for (const command of commands) {
    try {
      const response = await processCommand(command);
      results.push(response);
      
      // If a command fails, we might want to stop the chain
      if (!response.executed) {
        break;
      }
    } catch (error) {
      console.error('Error processing command in chain:', error);
      results.push({
        command: command,
        action: 'unknown',
        executed: false,
        error: 'Failed to process command in chain'
      });
      break;
    }
  }
  
  return results;
}

function splitCommands(transcript: string): string[] {
  const commands: string[] = [];
  let currentIndex = 0;
  
  // First, look for explicit command boundaries
  const boundaryMatches = findCommandBoundaries(transcript);
  if (boundaryMatches.length > 0) {
    return boundaryMatches.map(cmd => cmd.command);
  }
  
  // If no explicit boundaries, split by separators
  const parts = transcript.split(new RegExp(`\\s+(${COMMAND_SEPARATORS.join('|')})\\s+`, 'i'));
  
  return parts.map(part => part.trim()).filter(Boolean);
}

function findCommandBoundaries(transcript: string): ChainedCommand[] {
  const commands: ChainedCommand[] = [];
  let lastIndex = 0;
  
  // Create regex pattern for boundaries
  const boundaryPattern = new RegExp(
    `\\b(${COMMAND_BOUNDARIES.join('|')})\\b`,
    'gi'
  );
  
  let match;
  while ((match = boundaryPattern.exec(transcript)) !== null) {
    const startIndex = match.index;
    
    // If this isn't the first boundary found, save the previous command
    if (lastIndex < startIndex) {
      commands.push({
        command: transcript.slice(lastIndex, startIndex).trim(),
        startIndex: lastIndex,
        endIndex: startIndex
      });
    }
    
    lastIndex = startIndex + match[0].length;
  }
  
  // Add the final command
  if (lastIndex < transcript.length) {
    commands.push({
      command: transcript.slice(lastIndex).trim(),
      startIndex: lastIndex,
      endIndex: transcript.length
    });
  }
  
  return commands;
}

async function processCommand(command: string): Promise<CommandResponse> {
  // Import dynamically to avoid circular dependency
  const { processVoiceCommand } = await import('./openai-service');
  return processVoiceCommand(command);
}
