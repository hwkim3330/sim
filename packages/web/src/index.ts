/**
 * @simi/web
 * Simi Platform Web UI
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string;
}

export interface ChatUIOptions {
  container: HTMLElement | string;
  name?: string;
  placeholder?: string;
  onSend?: (message: string) => Promise<string>;
  theme?: 'light' | 'dark';
}

/**
 * Chat UI component
 */
export class ChatUI {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private messages: ChatMessage[] = [];
  private onSend: (message: string) => Promise<string>;
  private name: string;

  constructor(options: ChatUIOptions) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)!
      : options.container;

    this.name = options.name || '심이';
    this.onSend = options.onSend || (async (msg) => `Echo: ${msg}`);

    this._render(options);
    this._bindEvents();
  }

  private _render(options: ChatUIOptions): void {
    const theme = options.theme || 'light';

    this.container.innerHTML = `
      <div class="simi-chat ${theme}">
        <div class="simi-chat-header">
          <div class="simi-chat-avatar">🤖</div>
          <div class="simi-chat-name">${this.name}</div>
        </div>
        <div class="simi-chat-messages"></div>
        <div class="simi-chat-input">
          <input type="text" placeholder="${options.placeholder || '메시지를 입력하세요...'}" />
          <button>전송</button>
        </div>
      </div>
    `;

    this.messagesEl = this.container.querySelector('.simi-chat-messages')!;
    this.inputEl = this.container.querySelector('input')!;
    this.sendBtn = this.container.querySelector('button')!;

    this._injectStyles();
  }

  private _injectStyles(): void {
    if (document.getElementById('simi-chat-styles')) return;

    const style = document.createElement('style');
    style.id = 'simi-chat-styles';
    style.textContent = `
      .simi-chat {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 12px;
        overflow: hidden;
        background: #f8f9fa;
      }
      .simi-chat.dark {
        background: #1a1a2e;
        color: #e0e0e0;
      }
      .simi-chat-header {
        display: flex;
        align-items: center;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .simi-chat-avatar {
        font-size: 24px;
        margin-right: 12px;
      }
      .simi-chat-name {
        font-weight: 600;
        font-size: 18px;
      }
      .simi-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .simi-message {
        max-width: 80%;
        margin-bottom: 12px;
        padding: 12px 16px;
        border-radius: 18px;
        line-height: 1.5;
      }
      .simi-message.user {
        background: #667eea;
        color: white;
        margin-left: auto;
        border-bottom-right-radius: 4px;
      }
      .simi-message.assistant {
        background: white;
        color: #333;
        margin-right: auto;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .dark .simi-message.assistant {
        background: #2d2d44;
        color: #e0e0e0;
      }
      .simi-chat-input {
        display: flex;
        padding: 12px;
        background: white;
        border-top: 1px solid #e0e0e0;
      }
      .dark .simi-chat-input {
        background: #2d2d44;
        border-color: #3d3d5c;
      }
      .simi-chat-input input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #e0e0e0;
        border-radius: 24px;
        font-size: 14px;
        outline: none;
      }
      .dark .simi-chat-input input {
        background: #1a1a2e;
        border-color: #3d3d5c;
        color: #e0e0e0;
      }
      .simi-chat-input input:focus {
        border-color: #667eea;
      }
      .simi-chat-input button {
        margin-left: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 24px;
        cursor: pointer;
        font-weight: 500;
        transition: transform 0.2s;
      }
      .simi-chat-input button:hover {
        transform: scale(1.05);
      }
      .simi-chat-input button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  private _bindEvents(): void {
    this.sendBtn.addEventListener('click', () => this._handleSend());
    this.inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this._handleSend();
    });
  }

  private async _handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;

    this.inputEl.value = '';
    this._addMessage('user', text);

    this.sendBtn.disabled = true;
    this.inputEl.disabled = true;

    try {
      const response = await this.onSend(text);
      this._addMessage('assistant', response);
    } catch (e) {
      this._addMessage('assistant', '죄송해요, 오류가 발생했어요...');
    }

    this.sendBtn.disabled = false;
    this.inputEl.disabled = false;
    this.inputEl.focus();
  }

  private _addMessage(role: 'user' | 'assistant', content: string): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date()
    };
    this.messages.push(message);

    const el = document.createElement('div');
    el.className = `simi-message ${role}`;
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /** Add message programmatically */
  addMessage(role: 'user' | 'assistant', content: string): void {
    this._addMessage(role, content);
  }

  /** Clear all messages */
  clear(): void {
    this.messages = [];
    this.messagesEl.innerHTML = '';
  }

  /** Get all messages */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }
}

/**
 * Create a chat UI instance
 */
export function createChatUI(options: ChatUIOptions): ChatUI {
  return new ChatUI(options);
}

/** Library version */
export const VERSION = '1.0.0';
