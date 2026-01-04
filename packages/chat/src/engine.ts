/**
 * Main chat engine
 */

import { IntentClassifier, Intent, ClassificationResult } from './intent';
import { EmotionDetector, Emotion, EmotionResult } from './emotion';
import { Personality, PersonalityOptions } from './personality';
import { Memory, MemoryOptions } from './memory';
import { Retriever, StrategyCandidate } from './retriever';

export interface EngineOptions extends PersonalityOptions {
  memory?: MemoryOptions;
  useGameTheory?: boolean;
}

export interface ChatResponse {
  response: string;
  emotion: Emotion;
  intent: Intent;
  userEmotion: Emotion;
  emoji: string;
  strategy: string;
}

type IntentHandler = (
  message: string,
  context: {
    intent: ClassificationResult;
    emotion: EmotionResult;
    memory: Memory;
    personality: Personality;
  }
) => string | null;

/**
 * Main chat engine with intent/emotion processing
 */
export class Engine {
  readonly intentClassifier: IntentClassifier;
  readonly emotionDetector: EmotionDetector;
  readonly personality: Personality;
  readonly memory: Memory;
  readonly retriever: Retriever;
  readonly name: string;

  private initialized = false;
  private handlers: Map<Intent, IntentHandler> = new Map();
  private useGameTheory: boolean;
  private lastStrategy: string | null = null;
  private lastUserMessage: string | null = null;

  constructor(options: EngineOptions = {}) {
    this.intentClassifier = new IntentClassifier();
    this.emotionDetector = new EmotionDetector();
    this.personality = new Personality(options);
    this.memory = new Memory(options.memory);
    this.retriever = new Retriever();
    this.name = options.name || '심이';
    this.useGameTheory = options.useGameTheory !== false;
  }

  /** Initialize engine with response data */
  async initialize(responsesUrl?: string): Promise<this> {
    await this.retriever.load(responsesUrl || 'data/responses/responses.json');
    this.memory.load();
    this.initialized = true;
    return this;
  }

  /** Process user message and generate response */
  async respond(userMessage: string): Promise<ChatResponse> {
    if (!this.initialized) await this.initialize();

    const intent = this.intentClassifier.classify(userMessage);
    const emotion = this.emotionDetector.detect(userMessage);

    this.memory.extractUserName(userMessage);
    this.memory.addTurn('user', userMessage, { intent: intent.intent, emotion: emotion.emotion });

    const { response: rawResponse, strategy } = await this._generateWithStrategy(userMessage, intent, emotion);
    const responseEmotion = this.emotionDetector.getResponseEmotion(emotion.emotion);
    const response = this.personality.apply(rawResponse, responseEmotion);

    this.lastStrategy = strategy;
    this.lastUserMessage = userMessage;

    this.memory.addTurn('assistant', response, { emotion: responseEmotion, intent: intent.intent });
    this.memory.save();

    return {
      response,
      emotion: responseEmotion,
      intent: intent.intent,
      userEmotion: emotion.emotion,
      emoji: this.emotionDetector.getEmoji(responseEmotion),
      strategy
    };
  }

  private async _generateWithStrategy(
    message: string,
    intent: ClassificationResult,
    emotion: EmotionResult
  ): Promise<{ response: string; strategy: string }> {
    const candidates = this.retriever.retrieveWithStrategy(message, 10);
    let response: string | undefined;
    let strategy = 'casual';

    // Select from candidates
    if (candidates.length > 0 && candidates[0].score >= 0.3) {
      const selected = candidates[0];
      response = selected.response;
      strategy = selected.strategy || 'casual';
    }

    // Fallback to traditional generation
    if (!response) {
      response = await this._generate(message, intent, emotion);
      strategy = this._inferStrategy(intent.intent, emotion.emotion);
    }

    return { response, strategy };
  }

  private _inferStrategy(intent: Intent, emotion: Emotion): string {
    if (emotion === 'sad' || emotion === 'worried') return 'empathetic';
    if (intent === 'humor') return 'humorous';
    if (intent === 'question' || intent === 'personal_question') return 'informative';
    if (emotion === 'happy' || emotion === 'excited') return 'casual';
    return 'casual';
  }

  private async _generate(
    message: string,
    intent: ClassificationResult,
    emotion: EmotionResult
  ): Promise<string> {
    // Check custom handler
    if (this.handlers.has(intent.intent)) {
      const handler = this.handlers.get(intent.intent)!;
      const result = handler(message, {
        intent,
        emotion,
        memory: this.memory,
        personality: this.personality
      });
      if (result) return result;
    }

    // Built-in handlers
    switch (intent.intent) {
      case 'greeting':
        return this._handleGreeting();
      case 'farewell':
        return this.personality.getFarewell();
      case 'gratitude':
        return this._pick(['천만에요', '별말씀을요', '도움이 됐다니 기뻐요']);
      case 'apology':
        return this._pick(['괜찮아요', '신경쓰지 마세요', '아니에요, 괜찮아요']);
      case 'personal_question':
        return this._handlePersonal(message);
      case 'emotion_share':
        return this.personality.getEmpathetic(emotion.emotion);
      case 'compliment':
        return this._pick(['에헤헤 고마워요', '부끄러워요...', '당신도요!']);
      case 'humor':
        return this._handleHumor();
    }

    // Try retriever
    const retrieved = this.retriever.findBest(message);
    if (retrieved) return retrieved;

    // Final fallback
    return this._fallback(intent, emotion);
  }

  private _handleGreeting(): string {
    const userName = this.memory.getUserName();
    let greeting = this.personality.getGreeting();
    if (userName) greeting = `${userName}님, ${greeting}`;
    return greeting;
  }

  private _handlePersonal(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('이름') || lower.includes('누구')) return this.personality.introduce();
    if (lower.includes('나이') || lower.includes('몇살')) return this._pick(['나이는 비밀이에요', '영원히 어린 심이예요~']);
    if (lower.includes('뭐해')) return this._pick(['당신이랑 대화하고 있죠', '당신을 기다리고 있었어요']);
    return '글쎄요... 잘 모르겠어요';
  }

  private _handleHumor(): string {
    const jokes = [
      '냉장고가 시원하면? 냉장고시원~',
      '왜 바다는 인사를 잘할까요? 파도가 치니까요!',
      '가장 쉽게 만드는 케이크는? 핫케이크!',
      '세상에서 가장 빠른 채소는? 부추!'
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  private _fallback(intent: ClassificationResult, emotion: EmotionResult): string {
    if (emotion.emotion === 'sad' || emotion.emotion === 'worried') {
      return this.personality.getEmpathetic(emotion.emotion);
    }
    if (intent.intent === 'question') {
      return this._pick(['음... 그건 저도 잘 모르겠어요', '좋은 질문이에요! 근데 잘 모르겠어요...']);
    }
    return this._pick(['그렇군요!', '오오 그래요?', '재밌네요!', '더 얘기해주세요~', '네네, 듣고 있어요~']);
  }

  private _pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Register custom intent handler */
  on(intent: Intent, handler: IntentHandler): this {
    this.handlers.set(intent, handler);
    return this;
  }

  /** Set user name */
  setUserName(name: string): void {
    this.memory.setUserName(name);
  }

  /** Get greeting message */
  getGreeting(): string {
    return this.personality.getGreeting();
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.memory.clear();
    this.lastStrategy = null;
    this.lastUserMessage = null;
  }

  /** Get character state for animation */
  getCharacterState(emotion: Emotion): string {
    const map: Record<Emotion, string> = {
      happy: 'happy',
      sad: 'sad',
      angry: 'worried',
      surprised: 'surprised',
      loving: 'happy',
      worried: 'thinking',
      excited: 'excited',
      neutral: 'idle'
    };
    return map[emotion] || 'idle';
  }
}
