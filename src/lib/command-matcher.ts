import { CommandResponse } from './openai-service';

// Command patterns for local matching
const commandPatterns = {
  miranda: [
    /read.*miranda.*rights/i,
    /miranda.*rights/i,
    /rights.*miranda/i,
    /read.*rights/i
  ],
  statute: [
    /statute.*(\d+:\d+)/i,
    /look.*up.*statute.*(\d+:\d+)/i,
    /what.*is.*statute.*(\d+:\d+)/i
  ],
  threat: [
    /check.*threat/i,
    /assess.*threat/i,
    /scan.*area/i,
    /threat.*assessment/i
  ],
  tactical: [
    /tactical.*situation/i,
    /situation.*report/i,
    /tactical.*assessment/i
  ]
};

// Language detection patterns
const languagePatterns = {
  spanish: /spanish|español/i,
  french: /french|français/i,
  vietnamese: /vietnamese|tiếng việt/i,
  mandarin: /mandarin|chinese|中文/i,
  arabic: /arabic|عربي/i
};

export function matchCommand(transcript: string): CommandResponse | null {
  // Try to match Miranda rights with language
  for (const [pattern, regex] of Object.entries(commandPatterns.miranda)) {
    if (regex.test(transcript)) {
      let language = 'english';
      // Check for language specification
      for (const [lang, langRegex] of Object.entries(languagePatterns)) {
        if (langRegex.test(transcript)) {
          language = lang;
          break;
        }
      }
      return {
        command: transcript,
        action: 'miranda',
        parameters: { language },
        executed: true
      };
    }
  }

  // Try to match statute lookup
  for (const pattern of commandPatterns.statute) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      return {
        command: transcript,
        action: 'statute',
        parameters: { statute: match[1] },
        executed: true
      };
    }
  }

  // Try to match threat assessment
  for (const pattern of commandPatterns.threat) {
    if (pattern.test(transcript)) {
      return {
        command: transcript,
        action: 'threat',
        parameters: { threat: transcript },
        executed: true
      };
    }
  }

  // Try to match tactical situation
  for (const pattern of commandPatterns.tactical) {
    if (pattern.test(transcript)) {
      return {
        command: transcript,
        action: 'tactical',
        parameters: { query: transcript },
        executed: true
      };
    }
  }

  // No local match found
  return null;
}
