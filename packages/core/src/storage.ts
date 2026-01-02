/**
 * @simi/core - Storage Utilities
 * Cross-platform storage abstraction
 */

import { safeJsonParse, safeJsonStringify, isBrowser } from './utils';

export interface StorageAdapter {
  get<T>(key: string, defaultValue: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
  keys(): string[];
}

/**
 * Browser localStorage adapter
 */
class BrowserStorage implements StorageAdapter {
  private prefix: string;

  constructor(prefix = 'simi') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  get<T>(key: string, defaultValue: T): T {
    if (!isBrowser()) return defaultValue;

    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) return defaultValue;
      return safeJsonParse(item, defaultValue);
    } catch {
      return defaultValue;
    }
  }

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return;

    try {
      localStorage.setItem(this.getKey(key), safeJsonStringify(value));
    } catch (e) {
      console.warn('Storage.set failed:', e);
    }
  }

  remove(key: string): void {
    if (!isBrowser()) return;
    localStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    if (!isBrowser()) return;

    const keys = this.keys();
    for (const key of keys) {
      localStorage.removeItem(this.getKey(key));
    }
  }

  has(key: string): boolean {
    if (!isBrowser()) return false;
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  keys(): string[] {
    if (!isBrowser()) return [];

    const keys: string[] = [];
    const prefix = `${this.prefix}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }

    return keys;
  }
}

/**
 * In-memory storage adapter (for Node.js or testing)
 */
class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();

  get<T>(key: string, defaultValue: T): T {
    const item = this.store.get(key);
    if (item === undefined) return defaultValue;
    return safeJsonParse(item, defaultValue);
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, safeJsonStringify(value));
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

/**
 * Create a storage instance
 */
export function createStorage(prefix = 'simi'): StorageAdapter {
  if (isBrowser()) {
    return new BrowserStorage(prefix);
  }
  return new MemoryStorage();
}

/**
 * Default storage instance
 */
export const storage = createStorage();
