/**
 * @simi/chat
 * Simi Platform Chat - Conversational AI Engine
 *
 * @packageDocumentation
 */

// Intent
export {
  IntentClassifier,
  Intent,
  IntentPatterns,
  ClassificationResult,
} from './intent';

// Emotion
export {
  EmotionDetector,
  Emotion,
  EmotionResult,
} from './emotion';

// Personality
export {
  Personality,
  PersonalityTraits,
  PersonalityOptions,
} from './personality';

// Memory
export {
  Memory,
  MemoryOptions,
  Turn,
  UserProfile,
  ConversationContext,
} from './memory';

// Retriever
export {
  Retriever,
  ResponseEntry,
  RetrievedCandidate,
  StrategyCandidate,
} from './retriever';

// Engine
export {
  Engine,
  EngineOptions,
  ChatResponse,
} from './engine';

// Factory function
export function createChatEngine(options?: import('./engine').EngineOptions): Engine {
  return new Engine(options);
}

// Alias for backwards compatibility
export { Engine as ChatEngine };

/** Library version */
export const VERSION = '1.0.0';
