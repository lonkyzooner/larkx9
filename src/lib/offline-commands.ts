import { CommandResponse } from './openai-service';
import { indexedDBService } from './indexed-db-service';

// Initialize IndexedDB when the module loads
indexedDBService.initialize().catch(console.error);

// Type for supported languages
type MirandaLanguage = 'english' | 'spanish' | 'french' | 'vietnamese' | 'mandarin' | 'arabic';

// Offline Miranda rights in multiple languages
const MIRANDA_RIGHTS = {
  english: `You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be provided for you. Do you understand the rights I have just read to you?`,
  spanish: `Tiene el derecho a permanecer en silencio. Cualquier cosa que diga puede y será usada en su contra en un tribunal. Tiene el derecho a un abogado. Si no puede pagar un abogado, se le proporcionará uno. ¿Entiende los derechos que le acabo de leer?`,
  french: `Vous avez le droit de garder le silence. Tout ce que vous direz pourra être utilisé contre vous devant un tribunal. Vous avez le droit à un avocat. Si vous ne pouvez pas vous permettre un avocat, un vous sera fourni. Comprenez-vous les droits que je viens de vous lire?`,
  vietnamese: `Bạn có quyền giữ im lặng. Bất cứ điều gì bạn nói có thể và sẽ được sử dụng chống lại bạn tại tòa án. Bạn có quyền có một luật sư. Nếu bạn không có khả năng chi trả cho một luật sư, một luật sư sẽ được chỉ định cho bạn. Bạn có hiểu những quyền tôi vừa đọc cho bạn không?`,
  mandarin: `你有权保持沉默。你所说的任何话都可以并将会在法庭上用作对你不利的证据。你有权请律师。如果你请不起律师，法院会为你指定一位。你明白我刚才向你宣读的这些权利吗？`,
  arabic: `لديك الحق في التزام الصمت. أي شيء تقوله يمكن ويسوف يستخدم ضدك في المحكمة. لديك الحق في توكيل محام. إذا لم تكن قادراً على تحمل تكاليف محام، سيتم توفير محام لك. هل تفهم الحقوق التي قرأتها للتو؟`
};

// Common statute explanations for offline access
const COMMON_STATUTES = {
  '14:30': 'First degree murder - the killing of a human being when the offender has specific intent to kill or to inflict great bodily harm.',
  '14:95': 'Illegal carrying of weapons - unlawful carrying of a concealed weapon by a person.',
  '14:402': 'Prohibited items in correctional facilities - introduction or possession of contraband in any jail, prison, correctional facility, or institution.',
};

// Basic threat assessment patterns
const THREAT_PATTERNS = [
  {
    pattern: /weapon|gun|knife|armed/i,
    response: 'CAUTION: Potential armed subject. Maintain safe distance and request backup.'
  },
  {
    pattern: /hostile|aggressive|threatening/i,
    response: 'Subject showing signs of aggression. Maintain tactical awareness and establish safe perimeter.'
  },
  {
    pattern: /flee|running|escape|fled/i,
    response: 'Subject attempting to flee. Note direction of travel and coordinate containment.'
  }
];

export async function processOfflineCommand(transcript: string, context?: { location?: string; timeOfDay?: string; previousCommand?: string }): Promise<CommandResponse | null> {
  try {
    // First check if we have this exact command cached
    const cachedCommand = await indexedDBService.getCachedCommand(transcript);
    if (cachedCommand) {
      console.log('Found cached command response:', cachedCommand);
      return cachedCommand.response;
    }

    // Try to match Miranda rights command
    const mirandaMatch = transcript.match(/miranda|rights/i);
    if (mirandaMatch) {
      const languageMatch = transcript.match(/in\s+(english|spanish|french|vietnamese|mandarin|arabic)/i);
      const language = (languageMatch?.[1] || 'english').toLowerCase() as MirandaLanguage;
      
      if (MIRANDA_RIGHTS[language]) {
        const response: CommandResponse = {
          command: transcript,
          action: 'miranda',
          parameters: { language },
          executed: true,
          result: MIRANDA_RIGHTS[language]
        };

        // Cache the response for future use
        await indexedDBService.cacheCommand(transcript, response, context);
        return response;
      }
    }
    
    // Try to match statute lookup
    const statuteMatch = transcript.match(/statute\s+(\d+:\d+)/i);
    if (statuteMatch && COMMON_STATUTES[statuteMatch[1]]) {
      const response: CommandResponse = {
        command: transcript,
        action: 'statute',
        parameters: { statute: statuteMatch[1] },
        executed: true,
        result: COMMON_STATUTES[statuteMatch[1]]
      };
      
      // Cache the response for future use
      await indexedDBService.cacheCommand(transcript, response, context);
      return response;
    }
    
    // Try to match threat assessment
    for (const { pattern, response } of THREAT_PATTERNS) {
      if (pattern.test(transcript)) {
        const threatResponse: CommandResponse = {
          command: transcript,
          action: 'threat',
          parameters: { threat: transcript },
          executed: true,
          result: response
        };
        
        // Cache the response for future use
        await indexedDBService.cacheCommand(transcript, threatResponse, context);
        return threatResponse;
      }
    }
    
    // No offline match found
    return null;
    
  } catch (error) {
    console.error('Error processing offline command:', error);
    return {
      command: transcript,
      action: 'unknown',
      executed: false,
      error: 'Error processing offline command'
    };
  }
}
