/**
 * SimCore - Shared Utilities and Core Infrastructure
 * @version 1.0.0
 * @license MIT
 *
 * Provides validation, error handling, logging, event system,
 * and common utilities for all Sim libraries.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ========================================
    // Custom Error Classes
    // ========================================

    /**
     * Base error class for Sim libraries
     * @extends Error
     */
    class SimError extends Error {
        /**
         * @param {string} message - Error message
         * @param {string} [code] - Error code
         * @param {Object} [details] - Additional error details
         */
        constructor(message, code = 'SIM_ERROR', details = null) {
            super(message);
            this.name = 'SimError';
            this.code = code;
            this.details = details;
            this.timestamp = Date.now();

            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
        }

        toJSON() {
            return {
                name: this.name,
                code: this.code,
                message: this.message,
                details: this.details,
                timestamp: this.timestamp
            };
        }
    }

    /**
     * Validation error for invalid inputs
     * @extends SimError
     */
    class ValidationError extends SimError {
        constructor(message, field = null, value = undefined) {
            super(message, 'VALIDATION_ERROR', { field, value });
            this.name = 'ValidationError';
            this.field = field;
        }
    }

    /**
     * Network error for fetch/API failures
     * @extends SimError
     */
    class NetworkError extends SimError {
        constructor(message, url = null, status = null) {
            super(message, 'NETWORK_ERROR', { url, status });
            this.name = 'NetworkError';
            this.url = url;
            this.status = status;
        }
    }

    /**
     * Resource error for missing/invalid resources
     * @extends SimError
     */
    class ResourceError extends SimError {
        constructor(message, resource = null) {
            super(message, 'RESOURCE_ERROR', { resource });
            this.name = 'ResourceError';
            this.resource = resource;
        }
    }

    /**
     * State error for invalid state transitions
     * @extends SimError
     */
    class StateError extends SimError {
        constructor(message, currentState = null, expectedState = null) {
            super(message, 'STATE_ERROR', { currentState, expectedState });
            this.name = 'StateError';
        }
    }

    // ========================================
    // Validation Utilities
    // ========================================

    const Validate = {
        /**
         * Validate string value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @param {Object} [options] - Validation options
         * @returns {string} The validated string
         * @throws {ValidationError} If validation fails
         */
        string(value, name, options = {}) {
            const { minLength = 0, maxLength = Infinity, allowEmpty = false, pattern = null } = options;

            if (typeof value !== 'string') {
                throw new ValidationError(`${name} must be a string`, name, value);
            }

            if (!allowEmpty && value.trim().length === 0) {
                throw new ValidationError(`${name} cannot be empty`, name, value);
            }

            if (value.length < minLength) {
                throw new ValidationError(`${name} must be at least ${minLength} characters`, name, value);
            }

            if (value.length > maxLength) {
                throw new ValidationError(`${name} must be at most ${maxLength} characters`, name, value);
            }

            if (pattern && !pattern.test(value)) {
                throw new ValidationError(`${name} has invalid format`, name, value);
            }

            return value;
        },

        /**
         * Validate number value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @param {Object} [options] - Validation options
         * @returns {number} The validated number
         * @throws {ValidationError} If validation fails
         */
        number(value, name, options = {}) {
            const { min = -Infinity, max = Infinity, integer = false, allowNaN = false } = options;

            if (typeof value !== 'number') {
                throw new ValidationError(`${name} must be a number`, name, value);
            }

            if (!allowNaN && isNaN(value)) {
                throw new ValidationError(`${name} cannot be NaN`, name, value);
            }

            if (!isFinite(value) && !options.allowInfinity) {
                throw new ValidationError(`${name} must be finite`, name, value);
            }

            if (integer && !Number.isInteger(value)) {
                throw new ValidationError(`${name} must be an integer`, name, value);
            }

            if (value < min) {
                throw new ValidationError(`${name} must be at least ${min}`, name, value);
            }

            if (value > max) {
                throw new ValidationError(`${name} must be at most ${max}`, name, value);
            }

            return value;
        },

        /**
         * Validate array value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @param {Object} [options] - Validation options
         * @returns {Array} The validated array
         * @throws {ValidationError} If validation fails
         */
        array(value, name, options = {}) {
            const { minLength = 0, maxLength = Infinity, itemType = null } = options;

            if (!Array.isArray(value)) {
                throw new ValidationError(`${name} must be an array`, name, value);
            }

            if (value.length < minLength) {
                throw new ValidationError(`${name} must have at least ${minLength} items`, name, value);
            }

            if (value.length > maxLength) {
                throw new ValidationError(`${name} must have at most ${maxLength} items`, name, value);
            }

            if (itemType) {
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] !== itemType) {
                        throw new ValidationError(`${name}[${i}] must be of type ${itemType}`, `${name}[${i}]`, value[i]);
                    }
                }
            }

            return value;
        },

        /**
         * Validate object value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @param {Object} [options] - Validation options
         * @returns {Object} The validated object
         * @throws {ValidationError} If validation fails
         */
        object(value, name, options = {}) {
            const { required = [], allowNull = false } = options;

            if (value === null && allowNull) {
                return value;
            }

            if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                throw new ValidationError(`${name} must be an object`, name, value);
            }

            for (const key of required) {
                if (!(key in value)) {
                    throw new ValidationError(`${name}.${key} is required`, `${name}.${key}`, undefined);
                }
            }

            return value;
        },

        /**
         * Validate function value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @returns {Function} The validated function
         * @throws {ValidationError} If validation fails
         */
        function(value, name) {
            if (typeof value !== 'function') {
                throw new ValidationError(`${name} must be a function`, name, value);
            }
            return value;
        },

        /**
         * Validate DOM element
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @returns {Element} The validated element
         * @throws {ValidationError} If validation fails
         */
        element(value, name) {
            if (typeof value === 'string') {
                const el = document.querySelector(value);
                if (!el) {
                    throw new ValidationError(`${name}: element "${value}" not found`, name, value);
                }
                return el;
            }

            if (!(value instanceof Element)) {
                throw new ValidationError(`${name} must be a DOM element`, name, value);
            }

            return value;
        },

        /**
         * Validate enum value
         * @param {*} value - Value to validate
         * @param {string} name - Field name for error messages
         * @param {Array} allowedValues - Array of allowed values
         * @returns {*} The validated value
         * @throws {ValidationError} If validation fails
         */
        enum(value, name, allowedValues) {
            if (!allowedValues.includes(value)) {
                throw new ValidationError(
                    `${name} must be one of: ${allowedValues.join(', ')}`,
                    name,
                    value
                );
            }
            return value;
        },

        /**
         * Clamp number to range (no throw)
         * @param {number} value - Value to clamp
         * @param {number} min - Minimum value
         * @param {number} max - Maximum value
         * @returns {number} Clamped value
         */
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }
    };

    // ========================================
    // Logging System
    // ========================================

    const LogLevel = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };

    /**
     * Logger class for consistent logging
     */
    class Logger {
        /**
         * @param {string} prefix - Logger prefix (usually library name)
         * @param {number} [level] - Minimum log level
         */
        constructor(prefix, level = LogLevel.INFO) {
            this.prefix = prefix;
            this.level = level;
            this.handlers = [];
        }

        _format(level, message, data) {
            const timestamp = new Date().toISOString();
            const levelName = Object.keys(LogLevel).find(k => LogLevel[k] === level) || 'UNKNOWN';
            return { timestamp, level: levelName, prefix: this.prefix, message, data };
        }

        _log(level, method, message, data) {
            if (level < this.level) return;

            const entry = this._format(level, message, data);

            // Call registered handlers
            for (const handler of this.handlers) {
                try {
                    handler(entry);
                } catch (e) {
                    // Ignore handler errors
                }
            }

            // Console output
            const prefix = `[${this.prefix}]`;
            if (data !== undefined) {
                console[method](prefix, message, data);
            } else {
                console[method](prefix, message);
            }
        }

        debug(message, data) {
            this._log(LogLevel.DEBUG, 'debug', message, data);
        }

        info(message, data) {
            this._log(LogLevel.INFO, 'info', message, data);
        }

        warn(message, data) {
            this._log(LogLevel.WARN, 'warn', message, data);
        }

        error(message, data) {
            this._log(LogLevel.ERROR, 'error', message, data);
        }

        setLevel(level) {
            this.level = level;
        }

        addHandler(handler) {
            this.handlers.push(handler);
            return () => {
                const idx = this.handlers.indexOf(handler);
                if (idx > -1) this.handlers.splice(idx, 1);
            };
        }
    }

    // ========================================
    // Event Emitter
    // ========================================

    /**
     * Simple event emitter for pub/sub pattern
     */
    class EventEmitter {
        constructor() {
            this._events = new Map();
            this._onceEvents = new Map();
        }

        /**
         * Register event listener
         * @param {string} event - Event name
         * @param {Function} listener - Listener function
         * @returns {Function} Unsubscribe function
         */
        on(event, listener) {
            if (!this._events.has(event)) {
                this._events.set(event, []);
            }
            this._events.get(event).push(listener);

            return () => this.off(event, listener);
        }

        /**
         * Register one-time event listener
         * @param {string} event - Event name
         * @param {Function} listener - Listener function
         */
        once(event, listener) {
            if (!this._onceEvents.has(event)) {
                this._onceEvents.set(event, []);
            }
            this._onceEvents.get(event).push(listener);
        }

        /**
         * Remove event listener
         * @param {string} event - Event name
         * @param {Function} listener - Listener function
         */
        off(event, listener) {
            const listeners = this._events.get(event);
            if (listeners) {
                const idx = listeners.indexOf(listener);
                if (idx > -1) listeners.splice(idx, 1);
            }
        }

        /**
         * Emit event
         * @param {string} event - Event name
         * @param {...*} args - Event arguments
         */
        emit(event, ...args) {
            // Regular listeners
            const listeners = this._events.get(event);
            if (listeners) {
                for (const listener of listeners.slice()) {
                    try {
                        listener(...args);
                    } catch (e) {
                        console.error(`Event listener error for "${event}":`, e);
                    }
                }
            }

            // Once listeners
            const onceListeners = this._onceEvents.get(event);
            if (onceListeners) {
                this._onceEvents.delete(event);
                for (const listener of onceListeners) {
                    try {
                        listener(...args);
                    } catch (e) {
                        console.error(`Once event listener error for "${event}":`, e);
                    }
                }
            }
        }

        /**
         * Remove all listeners for an event (or all events)
         * @param {string} [event] - Event name (optional)
         */
        removeAllListeners(event) {
            if (event) {
                this._events.delete(event);
                this._onceEvents.delete(event);
            } else {
                this._events.clear();
                this._onceEvents.clear();
            }
        }

        /**
         * Get listener count for an event
         * @param {string} event - Event name
         * @returns {number} Listener count
         */
        listenerCount(event) {
            const regular = this._events.get(event)?.length || 0;
            const once = this._onceEvents.get(event)?.length || 0;
            return regular + once;
        }
    }

    // ========================================
    // Utility Functions
    // ========================================

    const Utils = {
        /**
         * Generate unique ID
         * @param {string} [prefix] - Optional prefix
         * @returns {string} Unique ID
         */
        generateId(prefix = '') {
            const random = Math.random().toString(36).substring(2, 9);
            const timestamp = Date.now().toString(36);
            return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
        },

        /**
         * Deep clone object
         * @param {*} obj - Object to clone
         * @returns {*} Cloned object
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof RegExp) return new RegExp(obj);
            if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));

            const cloned = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        },

        /**
         * Deep merge objects
         * @param {Object} target - Target object
         * @param {...Object} sources - Source objects
         * @returns {Object} Merged object
         */
        deepMerge(target, ...sources) {
            if (!sources.length) return target;
            const source = sources.shift();

            if (this.isPlainObject(target) && this.isPlainObject(source)) {
                for (const key in source) {
                    if (this.isPlainObject(source[key])) {
                        if (!target[key]) Object.assign(target, { [key]: {} });
                        this.deepMerge(target[key], source[key]);
                    } else {
                        Object.assign(target, { [key]: source[key] });
                    }
                }
            }

            return this.deepMerge(target, ...sources);
        },

        /**
         * Check if value is plain object
         * @param {*} obj - Value to check
         * @returns {boolean} True if plain object
         */
        isPlainObject(obj) {
            return obj !== null && typeof obj === 'object' && obj.constructor === Object;
        },

        /**
         * Debounce function
         * @param {Function} fn - Function to debounce
         * @param {number} delay - Delay in milliseconds
         * @returns {Function} Debounced function
         */
        debounce(fn, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn.apply(this, args), delay);
            };
        },

        /**
         * Throttle function
         * @param {Function} fn - Function to throttle
         * @param {number} limit - Limit in milliseconds
         * @returns {Function} Throttled function
         */
        throttle(fn, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    fn.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * Sleep/delay utility
         * @param {number} ms - Milliseconds to wait
         * @returns {Promise<void>}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * Retry async function with exponential backoff
         * @param {Function} fn - Async function to retry
         * @param {number} [maxRetries=3] - Maximum retry attempts
         * @param {number} [baseDelay=1000] - Base delay in ms
         * @returns {Promise<*>} Result of function
         */
        async retry(fn, maxRetries = 3, baseDelay = 1000) {
            let lastError;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    return await fn();
                } catch (e) {
                    lastError = e;
                    if (i < maxRetries - 1) {
                        await this.sleep(baseDelay * Math.pow(2, i));
                    }
                }
            }
            throw lastError;
        },

        /**
         * Safe JSON parse
         * @param {string} str - JSON string
         * @param {*} [fallback=null] - Fallback value on error
         * @returns {*} Parsed value or fallback
         */
        safeJsonParse(str, fallback = null) {
            try {
                return JSON.parse(str);
            } catch (e) {
                return fallback;
            }
        },

        /**
         * Format bytes to human readable
         * @param {number} bytes - Number of bytes
         * @returns {string} Formatted string
         */
        formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    };

    // ========================================
    // Disposable Mixin
    // ========================================

    /**
     * Mixin for disposable resources
     * @param {Function} Base - Base class to extend
     * @returns {Function} Extended class
     */
    function DisposableMixin(Base) {
        return class extends Base {
            constructor(...args) {
                super(...args);
                this._disposed = false;
                this._disposables = [];
            }

            /**
             * Check if disposed
             * @returns {boolean}
             */
            get isDisposed() {
                return this._disposed;
            }

            /**
             * Register a disposable resource
             * @param {Function|Object} disposable - Dispose function or object with dispose method
             */
            registerDisposable(disposable) {
                this._disposables.push(disposable);
            }

            /**
             * Dispose all resources
             */
            dispose() {
                if (this._disposed) return;
                this._disposed = true;

                for (const disposable of this._disposables) {
                    try {
                        if (typeof disposable === 'function') {
                            disposable();
                        } else if (disposable && typeof disposable.dispose === 'function') {
                            disposable.dispose();
                        }
                    } catch (e) {
                        console.error('Error disposing resource:', e);
                    }
                }
                this._disposables = [];
            }

            /**
             * Throw if disposed
             * @throws {StateError}
             */
            throwIfDisposed() {
                if (this._disposed) {
                    throw new StateError('Object has been disposed');
                }
            }
        };
    }

    // ========================================
    // Storage Wrapper
    // ========================================

    const Storage = {
        /**
         * Get item from localStorage with fallback
         * @param {string} key - Storage key
         * @param {*} [fallback=null] - Fallback value
         * @returns {*} Stored value or fallback
         */
        get(key, fallback = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : fallback;
            } catch (e) {
                return fallback;
            }
        },

        /**
         * Set item in localStorage
         * @param {string} key - Storage key
         * @param {*} value - Value to store
         * @returns {boolean} Success status
         */
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                return false;
            }
        },

        /**
         * Remove item from localStorage
         * @param {string} key - Storage key
         */
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                // Ignore errors
            }
        },

        /**
         * Check if localStorage is available
         * @returns {boolean}
         */
        isAvailable() {
            try {
                const test = '__storage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // ========================================
    // Public API
    // ========================================

    return {
        version: '1.0.0',

        // Error classes
        SimError,
        ValidationError,
        NetworkError,
        ResourceError,
        StateError,

        // Validation
        Validate,

        // Logging
        Logger,
        LogLevel,

        // Events
        EventEmitter,

        // Utilities
        Utils,
        Storage,

        // Mixins
        DisposableMixin,

        // Factory functions
        createLogger: (prefix, level) => new Logger(prefix, level),
        createEventEmitter: () => new EventEmitter()
    };
}));
