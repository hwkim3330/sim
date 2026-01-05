/**
 * Simi Game SDK - JavaScript/TypeScript Implementation
 *
 * WebSocket-based SDK for integrating games with Simi AI.
 *
 * @example
 * ```typescript
 * import { SimiClient, Action } from 'simi-game-sdk';
 *
 * const client = new SimiClient('my-game', { url: 'ws://localhost:8080/game' });
 *
 * client.onAction(async (request) => {
 *   if (request.name === 'attack') {
 *     const result = doAttack(request.params.target);
 *     await client.actionResult(request.id, true, result);
 *   }
 * });
 *
 * await client.connect();
 * await client.registerActions([
 *   Action.simple('attack', 'Attack the enemy'),
 *   Action.simple('defend', 'Defend yourself'),
 * ]);
 * ```
 */

// Types
export interface ActionSchema {
  type?: string;
  properties?: Record<string, PropertySchema>;
  required?: string[];
}

export interface PropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ActionDefinition {
  name: string;
  description: string;
  schema?: ActionSchema;
}

export interface ActionRequest {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface QueryRequest {
  id: string;
  question: string;
}

export interface SpeakEvent {
  message: string;
  emotion?: string;
}

export type Priority = 'low' | 'normal' | 'high';

export interface ClientOptions {
  url?: string;
  name?: string;
  version?: string;
  capabilities?: string[];
  reconnect?: boolean;
  reconnectDelay?: number;
}

// Action helper class
export class Action {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly schema?: ActionSchema,
  ) {}

  static simple(name: string, description: string): Action {
    return new Action(name, description);
  }

  static withParams(
    name: string,
    description: string,
    properties: Record<string, PropertySchema>,
    required?: string[],
  ): Action {
    return new Action(name, description, {
      type: 'object',
      properties,
      required: required || [],
    });
  }

  toJSON(): ActionDefinition {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema,
    };
  }
}

// Main client class
export class SimiClient {
  private ws: WebSocket | null = null;
  private gameId: string;
  private options: Required<ClientOptions>;
  private connected = false;
  private actions: Map<string, Action> = new Map();

  // Handlers
  private actionHandler?: (request: ActionRequest) => Promise<void>;
  private queryHandler?: (request: QueryRequest) => Promise<string>;
  private speakHandler?: (event: SpeakEvent) => void;
  private connectHandler?: () => void;
  private disconnectHandler?: () => void;

  constructor(gameId: string, options: ClientOptions = {}) {
    this.gameId = gameId;
    this.options = {
      url: options.url || 'ws://localhost:8080/game',
      name: options.name || gameId,
      version: options.version || '1.0.0',
      capabilities: options.capabilities || ['actions', 'context'],
      reconnect: options.reconnect ?? false,
      reconnectDelay: options.reconnectDelay || 3000,
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Browser or Node.js
        if (typeof WebSocket !== 'undefined') {
          this.ws = new WebSocket(this.options.url);
        } else {
          // Node.js with ws package
          const WS = require('ws');
          this.ws = new WS(this.options.url);
        }

        this.ws.onopen = () => {
          this.connected = true;
          this.send({
            command: 'startup',
            game: this.gameId,
            data: {
              name: this.options.name,
              version: this.options.version,
              capabilities: this.options.capabilities,
            },
          });
          this.connectHandler?.();
          resolve();
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.disconnectHandler?.();

          if (this.options.reconnect) {
            setTimeout(() => this.connect(), this.options.reconnectDelay);
          }
        };

        this.ws.onerror = (err) => {
          reject(err);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private send(data: Record<string, unknown>): void {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }
    this.ws.send(JSON.stringify(data));
  }

  private async handleMessage(raw: string): Promise<void> {
    try {
      const data = JSON.parse(raw);
      const command = data.command;
      const payload = data.data || {};

      switch (command) {
        case 'action':
          await this.handleAction(payload);
          break;
        case 'query':
          await this.handleQuery(payload);
          break;
        case 'speak':
          this.handleSpeak(payload);
          break;
      }
    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  }

  private async handleAction(data: Record<string, unknown>): Promise<void> {
    const request: ActionRequest = {
      id: data.id as string,
      name: data.name as string,
      params: (data.params as Record<string, unknown>) || {},
    };

    if (this.actionHandler) {
      try {
        await this.actionHandler(request);
      } catch (err) {
        await this.actionResult(request.id, false, String(err));
      }
    } else {
      await this.actionResult(request.id, false, 'No handler');
    }
  }

  private async handleQuery(data: Record<string, unknown>): Promise<void> {
    const request: QueryRequest = {
      id: data.id as string,
      question: data.question as string,
    };

    if (this.queryHandler) {
      try {
        const answer = await this.queryHandler(request);
        this.send({
          command: 'query/response',
          game: this.gameId,
          data: { id: request.id, answer },
        });
      } catch (err) {
        console.error('Query handler error:', err);
      }
    }
  }

  private handleSpeak(data: Record<string, unknown>): void {
    const event: SpeakEvent = {
      message: data.message as string,
      emotion: data.emotion as string | undefined,
    };
    this.speakHandler?.(event);
  }

  // Public API

  async sendContext(
    message: string,
    options: { silent?: boolean; state?: Record<string, unknown> } = {},
  ): Promise<void> {
    this.send({
      command: 'context',
      game: this.gameId,
      data: {
        message,
        silent: options.silent || false,
        state: options.state,
      },
    });
  }

  async registerActions(actions: Action[]): Promise<void> {
    for (const action of actions) {
      this.actions.set(action.name, action);
    }

    this.send({
      command: 'actions/register',
      game: this.gameId,
      data: {
        actions: actions.map((a) => a.toJSON()),
      },
    });
  }

  async unregisterActions(actionNames: string[]): Promise<void> {
    for (const name of actionNames) {
      this.actions.delete(name);
    }

    this.send({
      command: 'actions/unregister',
      game: this.gameId,
      data: { actions: actionNames },
    });
  }

  async forceActions(
    actionNames: string[],
    message: string,
    options: { timeoutMs?: number; priority?: Priority } = {},
  ): Promise<void> {
    this.send({
      command: 'actions/force',
      game: this.gameId,
      data: {
        actions: actionNames,
        message,
        timeout_ms: options.timeoutMs,
        priority: options.priority || 'normal',
      },
    });
  }

  async actionResult(id: string, success: boolean, message: string = ''): Promise<void> {
    this.send({
      command: 'actions/result',
      game: this.gameId,
      data: { id, success, message },
    });
  }

  // Event handlers

  onAction(handler: (request: ActionRequest) => Promise<void>): void {
    this.actionHandler = handler;
  }

  onQuery(handler: (request: QueryRequest) => Promise<string>): void {
    this.queryHandler = handler;
  }

  onSpeak(handler: (event: SpeakEvent) => void): void {
    this.speakHandler = handler;
  }

  onConnect(handler: () => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }
}

export default SimiClient;
