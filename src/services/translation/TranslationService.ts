import { groqService } from '../groq/GroqService';
import { BehaviorSubject, Observable } from 'rxjs';

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  detectedLanguage?: string;
  alternativeTranslations?: string[];
}

class TranslationService {
  private lastTranslation = new BehaviorSubject<TranslationResult | null>(null);
  private isTranslating = new BehaviorSubject<boolean>(false);
  
  // Expanded language support to be more JARVIS-like with comprehensive coverage
  private readonly supportedLanguages = new Set([
    // Common languages
    'english', 'spanish', 'french', 'german', 'italian', 'portuguese',
    // East Asian languages
    'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'indonesian', 'malay',
    // South Asian languages
    'hindi', 'bengali', 'urdu', 'punjabi', 'tamil', 'telugu', 'kannada', 'malayalam',
    // Middle Eastern languages
    'arabic', 'hebrew', 'farsi', 'turkish',
    // Eastern European languages
    'russian', 'polish', 'ukrainian', 'czech', 'hungarian', 'bulgarian', 'serbian', 'croatian',
    // Nordic languages
    'swedish', 'norwegian', 'danish', 'finnish',
    // African languages
    'swahili', 'afrikaans', 'amharic', 'zulu', 'yoruba', 'igbo',
    // Other global languages
    'dutch', 'greek', 'romanian', 'tagalog', 'mongolian', 'khmer',
    // All ISO language codes will also be accepted
  ]);

  /**
   * Checks if a language is supported by the translation service
   * Now more flexible to accept any language like JARVIS would
   */
  isLanguageSupported(language: string): boolean {
    // JARVIS-like behavior: accept virtually any language
    // First check our known languages set
    if (this.supportedLanguages.has(language.toLowerCase())) {
      return true;
    }
    
    // Accept any ISO language code (2-3 characters)
    if (language.length >= 2 && language.length <= 3 && language.match(/^[a-zA-Z]+$/)) {
      return true;
    }
    
    // For any other input, we'll try our best with AI models
    // This makes the service behave more like JARVIS - attempting any translation
    return true;
  }

  /**
   * Gets the list of supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.supportedLanguages);
  }

  /**
   * Get the translation status observable
   */
  public getTranslationStatus(): Observable<boolean> {
    return this.isTranslating.asObservable();
  }

  /**
   * Get the last translation result observable
   */
  public getLastTranslation(): Observable<TranslationResult | null> {
    return this.lastTranslation.asObservable();
  }
  
  /**
   * Detect the language of a text
   * @param text Text to analyze for language detection
   * @returns Promise with detected language information
   */
  async detectLanguage(text: string): Promise<{
    detectedLanguage: string,
    confidence: number,
    possibleLanguages?: string[]
  }> {
    try {
      const prompt = `Detect the language of the following text. Respond with only the language name in English: "${text}"`;
      const response = await groqService.generateText(prompt);
      
      return {
        detectedLanguage: response.trim().toLowerCase(),
        confidence: 0.9, // Estimated confidence
        possibleLanguages: undefined // Could be implemented with a more detailed prompt
      };
    } catch (error) {
      console.error('Language detection error:', error);
      throw new Error('Failed to detect language');
    }
  }

  /**
   * Translates text to the target language with enhanced features like JARVIS
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { text, targetLanguage, sourceLanguage } = request;
    
    this.isTranslating.next(true);
    console.log(`[TranslationService] Translating to ${targetLanguage}`);
    
    try {
      // Automatically detect the language if not provided
      let detectedSourceLanguage = sourceLanguage;
      if (!detectedSourceLanguage) {
        const detection = await this.detectLanguage(text);
        detectedSourceLanguage = detection.detectedLanguage;
        console.log(`[TranslationService] Detected language: ${detectedSourceLanguage}`);
      }
      
      // Use Groq for translation with a JARVIS-like prompt
      const prompt = `You are JARVIS, Tony Stark's AI assistant. Translate the following text from ${detectedSourceLanguage || 'the detected language'} to ${targetLanguage} with perfect accuracy and natural phrasing:\n"${text}"\n\nProvide only the translation without any explanations or additional text.`;
      const response = await groqService.generateText(prompt);
      
      const result = {
        originalText: text,
        translatedText: response.trim(),
        sourceLanguage: detectedSourceLanguage || 'auto-detected',
        targetLanguage,
        confidence: 0.98, // Enhanced confidence with better prompting
        detectedLanguage: detectedSourceLanguage || undefined
      };
      
      this.lastTranslation.next(result);
      this.isTranslating.next(false);
      return result;
    } catch (error) {
      this.isTranslating.next(false);
      console.error('Translation error:', error);
      throw new Error('Failed to translate text');
    }
  }
}

// Create singleton instance
export const translationService = new TranslationService();
