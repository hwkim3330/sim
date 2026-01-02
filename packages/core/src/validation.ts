/**
 * @simi/core - Validation Utilities
 * Type guards and validators
 */

import { ValidationError } from './errors';

/**
 * Type guard for checking if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Type guard for object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Validation namespace with assertion functions
 */
export const Validate = {
  /**
   * Assert value is a string
   */
  string(value: unknown, field = 'value'): asserts value is string {
    if (!isString(value)) {
      throw new ValidationError(`Expected string for ${field}`, field, value);
    }
  },

  /**
   * Assert value is a non-empty string
   */
  nonEmptyString(value: unknown, field = 'value'): asserts value is string {
    if (!isString(value) || value.trim().length === 0) {
      throw new ValidationError(`Expected non-empty string for ${field}`, field, value);
    }
  },

  /**
   * Assert value is a number
   */
  number(value: unknown, field = 'value'): asserts value is number {
    if (!isNumber(value)) {
      throw new ValidationError(`Expected number for ${field}`, field, value);
    }
  },

  /**
   * Assert value is a positive number
   */
  positiveNumber(value: unknown, field = 'value'): asserts value is number {
    if (!isNumber(value) || value <= 0) {
      throw new ValidationError(`Expected positive number for ${field}`, field, value);
    }
  },

  /**
   * Assert value is in range
   */
  range(value: unknown, min: number, max: number, field = 'value'): asserts value is number {
    if (!isNumber(value) || value < min || value > max) {
      throw new ValidationError(`Expected ${field} to be between ${min} and ${max}`, field, value);
    }
  },

  /**
   * Assert value is a boolean
   */
  boolean(value: unknown, field = 'value'): asserts value is boolean {
    if (!isBoolean(value)) {
      throw new ValidationError(`Expected boolean for ${field}`, field, value);
    }
  },

  /**
   * Assert value is a function
   */
  function(value: unknown, field = 'value'): asserts value is Function {
    if (!isFunction(value)) {
      throw new ValidationError(`Expected function for ${field}`, field, value);
    }
  },

  /**
   * Assert value is an object
   */
  object(value: unknown, field = 'value'): asserts value is Record<string, unknown> {
    if (!isObject(value)) {
      throw new ValidationError(`Expected object for ${field}`, field, value);
    }
  },

  /**
   * Assert value is an array
   */
  array(value: unknown, field = 'value'): asserts value is unknown[] {
    if (!isArray(value)) {
      throw new ValidationError(`Expected array for ${field}`, field, value);
    }
  },

  /**
   * Assert value is not null or undefined
   */
  defined<T>(value: T | undefined | null, field = 'value'): asserts value is T {
    if (!isDefined(value)) {
      throw new ValidationError(`Expected ${field} to be defined`, field, value);
    }
  },

  /**
   * Assert value is one of allowed values
   */
  oneOf<T>(value: unknown, allowed: T[], field = 'value'): asserts value is T {
    if (!allowed.includes(value as T)) {
      throw new ValidationError(
        `Expected ${field} to be one of: ${allowed.join(', ')}`,
        field,
        value
      );
    }
  },

  /**
   * Assert array has minimum length
   */
  minLength(value: unknown[], min: number, field = 'array'): void {
    if (value.length < min) {
      throw new ValidationError(`Expected ${field} to have at least ${min} items`, field, value);
    }
  },

  /**
   * Assert array has maximum length
   */
  maxLength(value: unknown[], max: number, field = 'array'): void {
    if (value.length > max) {
      throw new ValidationError(`Expected ${field} to have at most ${max} items`, field, value);
    }
  },
};

/**
 * Clamp a number to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize a number to 0-1 range
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}
