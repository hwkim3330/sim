/**
 * @simi/core - Event Emitter
 * Type-safe pub/sub event system
 */

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe: () => void;
}

/**
 * Type-safe event emitter with async support
 */
export class EventEmitter<Events extends Record<string, unknown> = Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<EventHandler>>();
  private onceListeners = new Map<keyof Events, Set<EventHandler>>();
  private maxListeners = 100;

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    if (handlers.size >= this.maxListeners) {
      console.warn(`EventEmitter: Max listeners (${this.maxListeners}) reached for event "${String(event)}"`);
    }

    handlers.add(handler as EventHandler);

    return {
      unsubscribe: () => this.off(event, handler),
    };
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): EventSubscription {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }

    this.onceListeners.get(event)!.add(handler as EventHandler);

    return {
      unsubscribe: () => {
        this.onceListeners.get(event)?.delete(handler as EventHandler);
      },
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
    this.onceListeners.get(event)?.delete(handler as EventHandler);
  }

  /**
   * Emit an event
   */
  async emit<K extends keyof Events>(event: K, data: Events[K]): Promise<void> {
    const handlers = this.listeners.get(event);
    const onceHandlers = this.onceListeners.get(event);

    const promises: Promise<void>[] = [];

    if (handlers) {
      for (const handler of handlers) {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    if (onceHandlers) {
      for (const handler of onceHandlers) {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
      onceHandlers.clear();
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Emit event synchronously
   */
  emitSync<K extends keyof Events>(event: K, data: Events[K]): void {
    const handlers = this.listeners.get(event);
    const onceHandlers = this.onceListeners.get(event);

    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }

    if (onceHandlers) {
      for (const handler of onceHandlers) {
        handler(data);
      }
      onceHandlers.clear();
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    const regular = this.listeners.get(event)?.size ?? 0;
    const once = this.onceListeners.get(event)?.size ?? 0;
    return regular + once;
  }

  /**
   * Get all event names
   */
  eventNames(): (keyof Events)[] {
    const names = new Set<keyof Events>();
    for (const key of this.listeners.keys()) {
      names.add(key);
    }
    for (const key of this.onceListeners.keys()) {
      names.add(key);
    }
    return Array.from(names);
  }

  /**
   * Set max listeners
   */
  setMaxListeners(n: number): void {
    this.maxListeners = n;
  }
}
