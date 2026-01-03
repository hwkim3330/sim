/**
 * Simi Agent Types
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: Role;
  content: string;
  images?: string[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
}

export interface GenerationConfig {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface AgentConfig {
  claudeApiKey?: string;
  claudeModel?: string;
  systemPrompt?: string;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: Tool[];
  ttsEnabled?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface Engine {
  name: string;
  generate(
    messages: Message[],
    config?: GenerationConfig,
    tools?: ToolSchema[]
  ): Promise<string>;

  generateStream?(
    messages: Message[],
    config?: GenerationConfig,
    tools?: ToolSchema[]
  ): AsyncGenerator<string>;
}

export type StreamCallback = (token: string) => void;
export type ToolCallback = (call: ToolCall, result: ToolResult) => void;

export const createMessage = {
  system: (content: string): Message => ({ role: 'system', content }),
  user: (content: string, images?: string[]): Message => ({ role: 'user', content, images }),
  assistant: (content: string): Message => ({ role: 'assistant', content }),
  tool: (toolCallId: string, content: string): Message => ({ role: 'tool', content, toolCallId }),
};
