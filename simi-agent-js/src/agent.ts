/**
 * Simi Agent - ReAct Loop Implementation
 */

import type {
  AgentConfig,
  Message,
  ToolCall,
  ToolResult,
  StreamCallback,
  ToolCallback,
  Engine,
} from './types.js';
import { createMessage } from './types.js';
import { ClaudeEngine } from './engines/claude.js';
import { ToolRegistry } from './tools/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are Simi, an AI coding assistant.

You help users with software engineering tasks by:
- Reading, writing, and editing files
- Executing shell commands
- Searching code

When given a task:
1. Think step by step about what needs to be done
2. Use tools to gather information and make changes
3. Verify your work

To use a tool, output:
<tool_call>{"name": "tool_name", "arguments": {"param": "value"}}</tool_call>

Available tools:
- read_file: Read file contents
- write_file: Write content to file
- shell: Execute shell command
- glob: Find files by pattern
- grep: Search in files

Be helpful, accurate, and thorough.`;

export class Agent {
  private config: Required<AgentConfig>;
  private engine: Engine;
  private tools: ToolRegistry;
  private history: Message[] = [];

  constructor(config: AgentConfig = {}) {
    this.config = {
      claudeApiKey: config.claudeApiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      claudeModel: config.claudeModel ?? 'claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      maxIterations: config.maxIterations ?? 50,
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      stream: config.stream ?? true,
      tools: config.tools ?? [],
      ttsEnabled: config.ttsEnabled ?? false,
    };

    if (!this.config.claudeApiKey) {
      throw new Error('Claude API key required. Set ANTHROPIC_API_KEY or pass claudeApiKey.');
    }

    this.engine = new ClaudeEngine(this.config.claudeApiKey, this.config.claudeModel);
    this.tools = new ToolRegistry();
    this.tools.registerDefaults();

    // Register custom tools
    for (const tool of this.config.tools) {
      this.tools.register(tool);
    }
  }

  get engineName(): string {
    return this.engine.name;
  }

  /**
   * Run the agent with a message
   */
  async run(
    message: string,
    options: {
      images?: string[];
      onStream?: StreamCallback;
      onTool?: ToolCallback;
    } = {}
  ): Promise<string> {
    // Add user message
    this.history.push(createMessage.user(message, options.images));

    // Run ReAct loop
    const response = await this.reactLoop(options.onStream, options.onTool);

    // Add assistant response
    this.history.push(createMessage.assistant(response));

    return response;
  }

  /**
   * ReAct reasoning loop
   */
  private async reactLoop(
    onStream?: StreamCallback,
    onTool?: ToolCallback
  ): Promise<string> {
    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.config.maxIterations) {
      iterations++;

      // Build messages
      const messages = [
        createMessage.system(this.config.systemPrompt),
        ...this.history,
      ];

      // Generate response
      let response: string;

      if (this.config.stream && this.engine.generateStream && onStream) {
        const chunks: string[] = [];
        for await (const chunk of this.engine.generateStream(messages, {
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }, this.tools.getSchemas())) {
          chunks.push(chunk);
          onStream(chunk);
        }
        response = chunks.join('');
      } else {
        response = await this.engine.generate(messages, {
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }, this.tools.getSchemas());
      }

      // Parse tool calls
      const toolCalls = this.parseToolCalls(response);

      if (toolCalls.length === 0) {
        // No tool calls - return response
        finalResponse = this.cleanResponse(response);
        break;
      }

      // Execute tools
      for (const call of toolCalls) {
        const result = await this.tools.execute(call.name, call.arguments);

        if (onTool) {
          onTool(call, result);
        }

        // Add tool result to history
        this.history.push(createMessage.tool(call.id, this.formatToolResult(call, result)));
      }
    }

    if (iterations >= this.config.maxIterations) {
      finalResponse += '\n[Reached maximum iterations]';
    }

    return finalResponse;
  }

  /**
   * Parse tool calls from response
   */
  private parseToolCalls(response: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const pattern = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/gs;
    let match;
    let id = 0;

    while ((match = pattern.exec(response)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        calls.push({
          id: `call_${id++}`,
          name: data.name,
          arguments: data.arguments || {},
        });
      } catch {
        // Invalid JSON, skip
      }
    }

    return calls;
  }

  /**
   * Format tool result for model
   */
  private formatToolResult(call: ToolCall, result: ToolResult): string {
    if (result.success) {
      return `Tool ${call.name} succeeded:\n${result.output}`;
    } else {
      return `Tool ${call.name} failed:\n${result.error}`;
    }
  }

  /**
   * Clean response by removing tool call artifacts
   */
  private cleanResponse(response: string): string {
    return response.replace(/<tool_call>.*?<\/tool_call>/gs, '').trim();
  }

  /**
   * Reset conversation
   */
  reset(): void {
    this.history = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.history];
  }
}

/**
 * Create agent with simple parameters
 */
export function createAgent(options: {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
} = {}): Agent {
  return new Agent({
    claudeApiKey: options.apiKey,
    claudeModel: options.model,
    systemPrompt: options.systemPrompt,
  });
}
