/**
 * @simi/core
 * Simi Platform Core - Foundation utilities
 *
 * @packageDocumentation
 */

// Errors
export {
  SimiError,
  ValidationError,
  NetworkError,
  ResourceError,
  StateError,
  ConfigError,
} from './errors';

// Logger
export {
  Logger,
  LogLevel,
  logger,
  type LogEntry,
  type LoggerOptions,
} from './logger';

// Events
export {
  EventEmitter,
  type EventHandler,
  type EventSubscription,
} from './events';

// Validation
export {
  Validate,
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isFunction,
  isObject,
  isArray,
  clamp,
  normalize,
} from './validation';

// Utils
export {
  generateId,
  deepClone,
  deepMerge,
  debounce,
  throttle,
  sleep,
  retry,
  safeJsonParse,
  safeJsonStringify,
  pick,
  omit,
  isBrowser,
  isNode,
  formatBytes,
  formatDuration,
} from './utils';

// Storage
export {
  createStorage,
  storage,
  type StorageAdapter,
} from './storage';

// Version
export const VERSION = '1.0.0';
