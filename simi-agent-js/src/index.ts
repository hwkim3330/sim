/**
 * Simi Agent - AI Coding Assistant
 *
 * A lightweight AI agent for coding tasks, powered by Claude API.
 *
 * @example
 * import { Agent, TTS } from 'simi-agent';
 *
 * // Agent usage
 * const agent = new Agent({ claudeApiKey: 'sk-...' });
 * const response = await agent.run('Hello!');
 * console.log(response);
 *
 * // TTS usage
 * const tts = new TTS({ voice: 'glados' });
 * await tts.saveWav('Hello world', 'output.wav');
 */

export { Agent, createAgent } from './agent.js';
export { ClaudeEngine } from './engines/claude.js';
export {
  ToolRegistry,
  ReadFileTool,
  WriteFileTool,
  ShellTool,
  GlobTool,
  GrepTool,
  defaultTools,
} from './tools/index.js';
export * from './types.js';

// TTS exports
export {
  TTS,
  Voice,
  synthesize,
  saveWav,
  textToPhonemes,
  PHONEMES,
  type VoiceConfig,
  type TTSOptions,
} from './tts/index.js';
