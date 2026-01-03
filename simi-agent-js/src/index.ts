/**
 * Simi Agent - AI Coding Assistant
 *
 * A lightweight AI agent for coding tasks, powered by Claude API.
 *
 * @example
 * import { Agent } from 'simi-agent';
 *
 * const agent = new Agent({ claudeApiKey: 'sk-...' });
 * const response = await agent.run('Hello!');
 * console.log(response);
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
