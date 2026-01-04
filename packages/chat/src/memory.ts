/**
 * Conversation memory and user profiling
 */

import { Emotion } from './emotion';
import { Intent } from './intent';

export interface Turn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: number;
  emotion: Emotion;
  intent: Intent;
}

export interface UserProfile {
  name: string | null;
  preferences: Record<string, unknown>;
  topics: string[];
  emotionHistory: Array<{ emotion: Emotion; timestamp: number }>;
}

export interface MemoryOptions {
  maxTurns?: number;
}

export interface ConversationContext {
  turns: Turn[];
  userProfile: UserProfile;
  messageCount: number;
}

/**
 * Conversation memory with user profiling
 */
export class Memory {
  private maxTurns: number;
  private history: Turn[] = [];
  private userProfile: UserProfile;
  private sessionStart: number;
  private _messageCount: number = 0;

  constructor(options: MemoryOptions = {}) {
    this.maxTurns = options.maxTurns || 20;
    this.sessionStart = Date.now();
    this.userProfile = {
      name: null,
      preferences: {},
      topics: [],
      emotionHistory: []
    };
  }

  get messageCount(): number {
    return this._messageCount;
  }

  /** Add a conversation turn */
  addTurn(
    role: 'user' | 'assistant',
    message: string,
    metadata: { emotion?: Emotion; intent?: Intent } = {}
  ): void {
    const turn: Turn = {
      role,
      message,
      timestamp: Date.now(),
      emotion: metadata.emotion || 'neutral',
      intent: metadata.intent || 'unknown'
    };

    this.history.push(turn);
    this._messageCount++;

    if (role === 'user' && metadata.emotion) {
      this.userProfile.emotionHistory.push({
        emotion: metadata.emotion,
        timestamp: turn.timestamp
      });
      if (this.userProfile.emotionHistory.length > 20) {
        this.userProfile.emotionHistory.shift();
      }
    }

    while (this.history.length > this.maxTurns) {
      this.history.shift();
    }
  }

  /** Get conversation context */
  getContext(numTurns: number = 5): ConversationContext {
    return {
      turns: this.history.slice(-numTurns),
      userProfile: this.userProfile,
      messageCount: this._messageCount
    };
  }

  /** Get last user message */
  getLastUserMessage(): string | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === 'user') {
        return this.history[i].message;
      }
    }
    return null;
  }

  /** Extract user name from message */
  extractUserName(message: string): string | null {
    const patterns = [
      /내\s*이름은\s*([가-힣]{2,4})(?:이야|예요|에요|야|입니다)?/,
      /([가-힣]{2,4})(?:이라고\s*해|라고\s*해|라고\s*불러)/,
      /저는?\s*([가-힣]{2,4})(?:이에요|예요|입니다)?/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        this.userProfile.name = match[1];
        return match[1];
      }
    }
    return null;
  }

  /** Get user name */
  getUserName(): string | null {
    return this.userProfile.name;
  }

  /** Set user name */
  setUserName(name: string): void {
    this.userProfile.name = name;
  }

  /** Clear conversation history */
  clear(): void {
    this.history = [];
    this._messageCount = 0;
    this.sessionStart = Date.now();
  }

  /** Save to localStorage */
  save(key: string = 'simchat_memory'): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify({
          history: this.history,
          userProfile: this.userProfile,
          messageCount: this._messageCount
        }));
      }
    } catch {
      console.warn('Memory save failed');
    }
  }

  /** Load from localStorage */
  load(key: string = 'simchat_memory'): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          this.history = parsed.history || [];
          this.userProfile = parsed.userProfile || this.userProfile;
          this._messageCount = parsed.messageCount || 0;
          return true;
        }
      }
    } catch {
      console.warn('Memory load failed');
    }
    return false;
  }
}
