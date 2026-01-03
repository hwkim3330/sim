/**
 * Claude API Engine
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Engine, Message, GenerationConfig, ToolSchema } from '../types.js';

export class ClaudeEngine implements Engine {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  get name(): string {
    return `Claude(${this.model})`;
  }

  async generate(
    messages: Message[],
    config?: GenerationConfig,
    tools?: ToolSchema[]
  ): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => this.convertMessage(m));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: config?.maxTokens ?? 4096,
      temperature: config?.temperature ?? 0.7,
      system: systemMsg?.content ?? '',
      messages: chatMessages,
      tools: tools?.map(t => this.convertTool(t)),
    });

    // Extract text content
    const textBlocks = response.content.filter(
      block => block.type === 'text'
    );

    // Extract tool use
    const toolBlocks = response.content.filter(
      block => block.type === 'tool_use'
    );

    let result = textBlocks.map(b => b.type === 'text' ? b.text : '').join('');

    // If there are tool calls, format them
    for (const block of toolBlocks) {
      if (block.type === 'tool_use') {
        result += `\n<tool_call>${JSON.stringify({
          name: block.name,
          arguments: block.input,
        })}</tool_call>`;
      }
    }

    return result;
  }

  async *generateStream(
    messages: Message[],
    config?: GenerationConfig,
    tools?: ToolSchema[]
  ): AsyncGenerator<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => this.convertMessage(m));

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: config?.maxTokens ?? 4096,
      temperature: config?.temperature ?? 0.7,
      system: systemMsg?.content ?? '',
      messages: chatMessages,
      tools: tools?.map(t => this.convertTool(t)),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  private convertMessage(msg: Message): Anthropic.MessageParam {
    if (msg.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId ?? 'unknown',
          content: msg.content,
        }],
      };
    }

    const content: Anthropic.ContentBlockParam[] = [];

    // Add images if present
    if (msg.images?.length) {
      for (const img of msg.images) {
        if (img.startsWith('data:')) {
          const match = img.match(/^data:image\/(\w+);base64,(.+)$/);
          if (match) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: `image/${match[1]}` as Anthropic.Base64ImageSource['media_type'],
                data: match[2],
              },
            });
          }
        }
      }
    }

    // Add text
    content.push({ type: 'text', text: msg.content });

    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content,
    };
  }

  private convertTool(tool: ToolSchema): Anthropic.Tool {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of tool.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      };
      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties,
        required,
      },
    };
  }
}
