/**
 * @simi/core - Error Classes
 * Custom error types for Simi Platform
 */

/**
 * Base error class for all Simi errors
 */
export class SimiError extends Error {
  public readonly code: string;
  public readonly timestamp: number;

  constructor(message: string, code = 'SIMI_ERROR') {
    super(message);
    this.name = 'SimiError';
    this.code = code;
    this.timestamp = Date.now();

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SimiError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends SimiError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error for network-related failures
 */
export class NetworkError extends SimiError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(message: string, statusCode?: number, url?: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.url = url;
  }
}

/**
 * Error for resource management failures
 */
export class ResourceError extends SimiError {
  public readonly resourceType?: string;

  constructor(message: string, resourceType?: string) {
    super(message, 'RESOURCE_ERROR');
    this.name = 'ResourceError';
    this.resourceType = resourceType;
  }
}

/**
 * Error for state-related failures
 */
export class StateError extends SimiError {
  public readonly currentState?: string;
  public readonly expectedState?: string;

  constructor(message: string, currentState?: string, expectedState?: string) {
    super(message, 'STATE_ERROR');
    this.name = 'StateError';
    this.currentState = currentState;
    this.expectedState = expectedState;
  }
}

/**
 * Error for configuration failures
 */
export class ConfigError extends SimiError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
    this.configKey = configKey;
  }
}
