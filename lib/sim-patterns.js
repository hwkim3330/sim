/**
 * SimPatterns - Advanced Pattern-Based AI Library
 * @version 1.0.0
 * @license MIT
 * @module SimPatterns
 *
 * Sophisticated pattern matching and response generation
 * with context awareness, multi-turn dialogue, and
 * language-specific adaptations.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │                    PatternEngine                         │
 * ├─────────────────────────────────────────────────────────┤
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
 * │  │   Pattern    │  │   Context    │  │   Response   │  │
 * │  │   Registry   │  │   Tracker    │  │   Selector   │  │
 * │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
 * │         │                 │                 │          │
 * │         └─────────┬───────┴─────────────────┘          │
 * │                   │                                     │
 * │         ┌─────────▼─────────┐                          │
 * │         │  Pattern Matcher  │ ← Fuzzy + Regex + ML     │
 * │         └─────────┬─────────┘                          │
 * │                   │                                     │
 * │         ┌─────────▼─────────┐                          │
 * │         │ Language Adapter  │ ← Ko/En specific rules   │
 * │         └───────────────────┘                          │
 * └─────────────────────────────────────────────────────────┘
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimPatterns = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ============================================================
    // CONSTANTS
    // ============================================================

    /** Supported strategies for responses */
    const STRATEGIES = Object.freeze({
        EMPATHETIC: 'empathetic',
        HUMOROUS: 'humorous',
        QUESTIONING: 'questioning',
        INFORMATIVE: 'informative',
        CASUAL: 'casual',
        SUPPORTIVE: 'supportive',
        REFLECTIVE: 'reflective',
        CLARIFYING: 'clarifying'
    });

    /** Emotional intensity levels */
    const INTENSITY = Object.freeze({
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    });

    /** Pattern match types */
    const MATCH_TYPE = Object.freeze({
        EXACT: 'exact',
        CONTAINS: 'contains',
        STARTS_WITH: 'startsWith',
        ENDS_WITH: 'endsWith',
        REGEX: 'regex',
        FUZZY: 'fuzzy',
        SEMANTIC: 'semantic'
    });

    /** Context types for multi-turn */
    const CONTEXT_TYPE = Object.freeze({
        GREETING: 'greeting',
        FAREWELL: 'farewell',
        QUESTION: 'question',
        ANSWER: 'answer',
        EMOTION_SHARE: 'emotion_share',
        TOPIC_CONTINUE: 'topic_continue',
        TOPIC_CHANGE: 'topic_change',
        CLARIFICATION: 'clarification'
    });

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Edit distance
     */
    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /**
     * Calculate similarity score (0-1)
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Similarity score
     */
    function similarity(a, b) {
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1;
        return 1 - levenshtein(a, b) / maxLen;
    }

    /**
     * Extract n-grams from text
     * @param {string} text - Input text
     * @param {number} n - N-gram size
     * @returns {Set<string>} Set of n-grams
     */
    function getNgrams(text, n = 2) {
        const ngrams = new Set();
        const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
        for (let i = 0; i <= normalized.length - n; i++) {
            ngrams.add(normalized.substring(i, i + n));
        }
        return ngrams;
    }

    /**
     * Calculate Jaccard similarity using n-grams
     * @param {string} a - First string
     * @param {string} b - Second string
     * @param {number} n - N-gram size
     * @returns {number} Jaccard similarity (0-1)
     */
    function jaccardSimilarity(a, b, n = 2) {
        const ngramsA = getNgrams(a, n);
        const ngramsB = getNgrams(b, n);

        if (ngramsA.size === 0 && ngramsB.size === 0) return 1;
        if (ngramsA.size === 0 || ngramsB.size === 0) return 0;

        let intersection = 0;
        for (const gram of ngramsA) {
            if (ngramsB.has(gram)) intersection++;
        }

        const union = ngramsA.size + ngramsB.size - intersection;
        return intersection / union;
    }

    /**
     * Normalize Korean text (remove particles, normalize spacing)
     * @param {string} text - Input text
     * @returns {string} Normalized text
     */
    function normalizeKorean(text) {
        // Remove common Korean particles
        const particles = /[은는이가을를에서로의와과도만도]/g;
        return text
            .toLowerCase()
            .replace(particles, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    // ============================================================
    // PATTERN CLASS
    // ============================================================

    /**
     * Represents a single pattern with matching rules and responses
     * @class Pattern
     */
    class Pattern {
        /**
         * @param {Object} config - Pattern configuration
         * @param {string} config.id - Unique identifier
         * @param {string[]} config.triggers - Trigger patterns
         * @param {string[]} config.responses - Response templates
         * @param {Object} [config.options] - Additional options
         */
        constructor(config) {
            this.id = config.id || generateId();
            this.triggers = config.triggers || [];
            this.responses = config.responses || [];

            // Matching options
            this.matchType = config.matchType || MATCH_TYPE.CONTAINS;
            this.priority = config.priority || 0;
            this.caseSensitive = config.caseSensitive || false;

            // Response metadata
            this.strategy = config.strategy || STRATEGIES.CASUAL;
            this.emotion = config.emotion || 'neutral';
            this.intensity = config.intensity || INTENSITY.MEDIUM;
            this.intent = config.intent || 'unknown';

            // Context rules
            this.contextRequired = config.contextRequired || null;
            this.contextSets = config.contextSets || null;
            this.followUp = config.followUp || null;

            // Language
            this.language = config.language || 'all';

            // Compiled regex patterns
            this._compiledPatterns = null;

            // Usage statistics
            this.usageCount = 0;
            this.lastUsed = null;
        }

        /**
         * Compile trigger patterns to regex
         * @private
         */
        _compilePatterns() {
            if (this._compiledPatterns) return this._compiledPatterns;

            this._compiledPatterns = this.triggers.map(trigger => {
                if (this.matchType === MATCH_TYPE.REGEX) {
                    try {
                        return new RegExp(trigger, this.caseSensitive ? '' : 'i');
                    } catch (e) {
                        console.warn(`Invalid regex pattern: ${trigger}`);
                        return null;
                    }
                }
                return trigger;
            }).filter(p => p !== null);

            return this._compiledPatterns;
        }

        /**
         * Check if input matches this pattern
         * @param {string} input - User input
         * @param {Object} [context] - Conversation context
         * @returns {Object|null} Match result or null
         */
        match(input, context = {}) {
            // Check context requirements
            if (this.contextRequired && context.lastType !== this.contextRequired) {
                return null;
            }

            // Check language
            if (this.language !== 'all' && context.language !== this.language) {
                return null;
            }

            const normalizedInput = this.caseSensitive ? input : input.toLowerCase();
            const patterns = this._compilePatterns();

            let bestScore = 0;
            let matchedPattern = null;

            for (const pattern of patterns) {
                let score = 0;

                switch (this.matchType) {
                    case MATCH_TYPE.EXACT:
                        const normalizedPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        if (normalizedInput === normalizedPattern) {
                            score = 1.0;
                        }
                        break;

                    case MATCH_TYPE.CONTAINS:
                        const containsPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        if (normalizedInput.includes(containsPattern)) {
                            score = 0.8 + (containsPattern.length / normalizedInput.length) * 0.2;
                        }
                        break;

                    case MATCH_TYPE.STARTS_WITH:
                        const startsPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        if (normalizedInput.startsWith(startsPattern)) {
                            score = 0.9;
                        }
                        break;

                    case MATCH_TYPE.ENDS_WITH:
                        const endsPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        if (normalizedInput.endsWith(endsPattern)) {
                            score = 0.85;
                        }
                        break;

                    case MATCH_TYPE.REGEX:
                        if (pattern instanceof RegExp && pattern.test(input)) {
                            score = 0.9;
                        }
                        break;

                    case MATCH_TYPE.FUZZY:
                        const fuzzyPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        const sim = similarity(normalizedInput, fuzzyPattern);
                        if (sim > 0.6) {
                            score = sim;
                        }
                        break;

                    case MATCH_TYPE.SEMANTIC:
                        const semPattern = this.caseSensitive ? pattern : pattern.toLowerCase();
                        const jaccard = jaccardSimilarity(normalizedInput, semPattern);
                        if (jaccard > 0.3) {
                            score = jaccard;
                        }
                        break;
                }

                if (score > bestScore) {
                    bestScore = score;
                    matchedPattern = pattern;
                }
            }

            if (bestScore > 0) {
                return {
                    pattern: this,
                    score: bestScore * (1 + this.priority * 0.1),
                    matchedTrigger: matchedPattern
                };
            }

            return null;
        }

        /**
         * Get a response from this pattern
         * @param {Object} [context] - Conversation context
         * @returns {Object} Response object
         */
        getResponse(context = {}) {
            if (this.responses.length === 0) {
                return null;
            }

            // Select response (weighted by context if available)
            let response;
            if (context.preferVariety && this.responses.length > 1) {
                // Avoid recently used responses
                const unused = this.responses.filter(r => r !== context.lastResponse);
                response = unused.length > 0
                    ? unused[Math.floor(Math.random() * unused.length)]
                    : this.responses[Math.floor(Math.random() * this.responses.length)];
            } else {
                response = this.responses[Math.floor(Math.random() * this.responses.length)];
            }

            // Update usage stats
            this.usageCount++;
            this.lastUsed = Date.now();

            return {
                text: response,
                pattern: this,
                strategy: this.strategy,
                emotion: this.emotion,
                intensity: this.intensity,
                intent: this.intent,
                contextSets: this.contextSets,
                followUp: this.followUp
            };
        }

        /**
         * Serialize pattern to JSON
         * @returns {Object} JSON representation
         */
        toJSON() {
            return {
                id: this.id,
                triggers: this.triggers,
                responses: this.responses,
                matchType: this.matchType,
                priority: this.priority,
                strategy: this.strategy,
                emotion: this.emotion,
                intensity: this.intensity,
                intent: this.intent,
                contextRequired: this.contextRequired,
                contextSets: this.contextSets,
                language: this.language
            };
        }
    }

    // ============================================================
    // PATTERN REGISTRY
    // ============================================================

    /**
     * Central registry for all patterns
     * @class PatternRegistry
     */
    class PatternRegistry {
        constructor() {
            /** @type {Map<string, Pattern>} Pattern storage by ID */
            this.patterns = new Map();

            /** @type {Map<string, Pattern[]>} Patterns indexed by intent */
            this.intentIndex = new Map();

            /** @type {Map<string, Pattern[]>} Patterns indexed by strategy */
            this.strategyIndex = new Map();

            /** @type {Map<string, Pattern[]>} Patterns indexed by language */
            this.languageIndex = new Map();
        }

        /**
         * Register a new pattern
         * @param {Pattern|Object} patternOrConfig - Pattern or config
         * @returns {Pattern} Registered pattern
         */
        register(patternOrConfig) {
            const pattern = patternOrConfig instanceof Pattern
                ? patternOrConfig
                : new Pattern(patternOrConfig);

            this.patterns.set(pattern.id, pattern);

            // Index by intent
            if (!this.intentIndex.has(pattern.intent)) {
                this.intentIndex.set(pattern.intent, []);
            }
            this.intentIndex.get(pattern.intent).push(pattern);

            // Index by strategy
            if (!this.strategyIndex.has(pattern.strategy)) {
                this.strategyIndex.set(pattern.strategy, []);
            }
            this.strategyIndex.get(pattern.strategy).push(pattern);

            // Index by language
            if (!this.languageIndex.has(pattern.language)) {
                this.languageIndex.set(pattern.language, []);
            }
            this.languageIndex.get(pattern.language).push(pattern);

            return pattern;
        }

        /**
         * Register multiple patterns
         * @param {Array} patterns - Array of patterns or configs
         */
        registerAll(patterns) {
            for (const p of patterns) {
                this.register(p);
            }
        }

        /**
         * Get pattern by ID
         * @param {string} id - Pattern ID
         * @returns {Pattern|undefined} Pattern or undefined
         */
        get(id) {
            return this.patterns.get(id);
        }

        /**
         * Get patterns by intent
         * @param {string} intent - Intent type
         * @returns {Pattern[]} Matching patterns
         */
        getByIntent(intent) {
            return this.intentIndex.get(intent) || [];
        }

        /**
         * Get patterns by strategy
         * @param {string} strategy - Strategy type
         * @returns {Pattern[]} Matching patterns
         */
        getByStrategy(strategy) {
            return this.strategyIndex.get(strategy) || [];
        }

        /**
         * Get patterns by language
         * @param {string} language - Language code
         * @returns {Pattern[]} Matching patterns
         */
        getByLanguage(language) {
            const langPatterns = this.languageIndex.get(language) || [];
            const allPatterns = this.languageIndex.get('all') || [];
            return [...langPatterns, ...allPatterns];
        }

        /**
         * Get all patterns as array
         * @returns {Pattern[]} All patterns
         */
        getAll() {
            return Array.from(this.patterns.values());
        }

        /**
         * Remove pattern by ID
         * @param {string} id - Pattern ID
         */
        remove(id) {
            const pattern = this.patterns.get(id);
            if (pattern) {
                this.patterns.delete(id);
                // Remove from indices (simplified)
                for (const [key, arr] of this.intentIndex) {
                    const idx = arr.indexOf(pattern);
                    if (idx > -1) arr.splice(idx, 1);
                }
            }
        }

        /**
         * Clear all patterns
         */
        clear() {
            this.patterns.clear();
            this.intentIndex.clear();
            this.strategyIndex.clear();
            this.languageIndex.clear();
        }

        /**
         * Get statistics about registered patterns
         * @returns {Object} Statistics
         */
        getStats() {
            return {
                totalPatterns: this.patterns.size,
                byIntent: Object.fromEntries(
                    Array.from(this.intentIndex.entries()).map(([k, v]) => [k, v.length])
                ),
                byStrategy: Object.fromEntries(
                    Array.from(this.strategyIndex.entries()).map(([k, v]) => [k, v.length])
                ),
                byLanguage: Object.fromEntries(
                    Array.from(this.languageIndex.entries()).map(([k, v]) => [k, v.length])
                )
            };
        }
    }

    // ============================================================
    // CONTEXT TRACKER
    // ============================================================

    /**
     * Tracks conversation context for multi-turn dialogue
     * @class ContextTracker
     */
    class ContextTracker {
        /**
         * @param {Object} [options] - Tracker options
         */
        constructor(options = {}) {
            this.maxHistory = options.maxHistory || 10;
            this.history = [];
            this.currentTopic = null;
            this.currentEmotion = 'neutral';
            this.emotionHistory = [];
            this.lastType = null;
            this.followUpExpected = null;
            this.userData = {};
        }

        /**
         * Add a turn to conversation history
         * @param {Object} turn - Conversation turn
         */
        addTurn(turn) {
            this.history.push({
                ...turn,
                timestamp: Date.now()
            });

            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }

            // Update state
            if (turn.emotion) {
                this.currentEmotion = turn.emotion;
                this.emotionHistory.push(turn.emotion);
                if (this.emotionHistory.length > 5) {
                    this.emotionHistory.shift();
                }
            }

            if (turn.topic) {
                this.currentTopic = turn.topic;
            }

            if (turn.type) {
                this.lastType = turn.type;
            }

            if (turn.followUpExpected) {
                this.followUpExpected = turn.followUpExpected;
            }
        }

        /**
         * Get recent conversation context
         * @param {number} [turns] - Number of recent turns
         * @returns {Object[]} Recent turns
         */
        getRecentTurns(turns = 3) {
            return this.history.slice(-turns);
        }

        /**
         * Check if follow-up is expected
         * @returns {boolean} Whether follow-up is expected
         */
        isFollowUpExpected() {
            return this.followUpExpected !== null;
        }

        /**
         * Get dominant emotion from history
         * @returns {string} Dominant emotion
         */
        getDominantEmotion() {
            if (this.emotionHistory.length === 0) return 'neutral';

            const counts = {};
            for (const e of this.emotionHistory) {
                counts[e] = (counts[e] || 0) + 1;
            }

            let maxEmotion = 'neutral';
            let maxCount = 0;
            for (const [emotion, count] of Object.entries(counts)) {
                if (count > maxCount) {
                    maxCount = count;
                    maxEmotion = emotion;
                }
            }
            return maxEmotion;
        }

        /**
         * Get context summary for pattern matching
         * @returns {Object} Context summary
         */
        getSummary() {
            return {
                lastType: this.lastType,
                currentTopic: this.currentTopic,
                currentEmotion: this.currentEmotion,
                dominantEmotion: this.getDominantEmotion(),
                followUpExpected: this.followUpExpected,
                turnCount: this.history.length,
                userData: this.userData
            };
        }

        /**
         * Store user data
         * @param {string} key - Data key
         * @param {*} value - Data value
         */
        setUserData(key, value) {
            this.userData[key] = value;
        }

        /**
         * Get user data
         * @param {string} key - Data key
         * @returns {*} Data value
         */
        getUserData(key) {
            return this.userData[key];
        }

        /**
         * Clear context
         */
        clear() {
            this.history = [];
            this.currentTopic = null;
            this.currentEmotion = 'neutral';
            this.emotionHistory = [];
            this.lastType = null;
            this.followUpExpected = null;
        }

        /**
         * Serialize context
         * @returns {Object} Serialized context
         */
        toJSON() {
            return {
                history: this.history,
                currentTopic: this.currentTopic,
                currentEmotion: this.currentEmotion,
                emotionHistory: this.emotionHistory,
                lastType: this.lastType,
                userData: this.userData
            };
        }

        /**
         * Restore context from JSON
         * @param {Object} data - Serialized context
         */
        fromJSON(data) {
            if (data.history) this.history = data.history;
            if (data.currentTopic) this.currentTopic = data.currentTopic;
            if (data.currentEmotion) this.currentEmotion = data.currentEmotion;
            if (data.emotionHistory) this.emotionHistory = data.emotionHistory;
            if (data.lastType) this.lastType = data.lastType;
            if (data.userData) this.userData = data.userData;
        }
    }

    // ============================================================
    // PATTERN MATCHER
    // ============================================================

    /**
     * Matches user input against registered patterns
     * @class PatternMatcher
     */
    class PatternMatcher {
        /**
         * @param {PatternRegistry} registry - Pattern registry
         * @param {Object} [options] - Matcher options
         */
        constructor(registry, options = {}) {
            this.registry = registry;
            this.minScore = options.minScore || 0.3;
            this.maxResults = options.maxResults || 5;
            this.language = options.language || 'ko';
        }

        /**
         * Set current language
         * @param {string} language - Language code
         */
        setLanguage(language) {
            this.language = language;
        }

        /**
         * Find matching patterns for input
         * @param {string} input - User input
         * @param {Object} [context] - Conversation context
         * @returns {Object[]} Matched patterns sorted by score
         */
        match(input, context = {}) {
            const patterns = this.registry.getByLanguage(this.language);
            const results = [];

            const matchContext = {
                ...context,
                language: this.language
            };

            for (const pattern of patterns) {
                const match = pattern.match(input, matchContext);
                if (match && match.score >= this.minScore) {
                    results.push(match);
                }
            }

            // Sort by score (descending)
            results.sort((a, b) => b.score - a.score);

            return results.slice(0, this.maxResults);
        }

        /**
         * Find best matching pattern
         * @param {string} input - User input
         * @param {Object} [context] - Conversation context
         * @returns {Object|null} Best match or null
         */
        matchBest(input, context = {}) {
            const matches = this.match(input, context);
            return matches.length > 0 ? matches[0] : null;
        }

        /**
         * Find patterns by strategy preference
         * @param {string} input - User input
         * @param {string} preferredStrategy - Preferred strategy
         * @param {Object} [context] - Conversation context
         * @returns {Object|null} Best match with strategy preference
         */
        matchWithStrategy(input, preferredStrategy, context = {}) {
            const matches = this.match(input, context);

            // Try to find match with preferred strategy
            const strategyMatch = matches.find(m => m.pattern.strategy === preferredStrategy);
            if (strategyMatch) {
                return strategyMatch;
            }

            // Fall back to best match
            return matches.length > 0 ? matches[0] : null;
        }
    }

    // ============================================================
    // RESPONSE SELECTOR
    // ============================================================

    /**
     * Selects optimal response using various strategies
     * @class ResponseSelector
     */
    class ResponseSelector {
        /**
         * @param {Object} [options] - Selector options
         */
        constructor(options = {}) {
            this.varietyWeight = options.varietyWeight || 0.3;
            this.strategyWeight = options.strategyWeight || 0.4;
            this.contextWeight = options.contextWeight || 0.3;
            this.responseHistory = [];
            this.maxHistory = options.maxHistory || 20;
        }

        /**
         * Select best response from matches
         * @param {Object[]} matches - Pattern matches
         * @param {Object} context - Conversation context
         * @param {string} [preferredStrategy] - Preferred strategy
         * @returns {Object|null} Selected response
         */
        select(matches, context, preferredStrategy = null) {
            if (matches.length === 0) return null;

            // Score each match
            const scored = matches.map(match => {
                let score = match.score;

                // Strategy bonus
                if (preferredStrategy && match.pattern.strategy === preferredStrategy) {
                    score += this.strategyWeight;
                }

                // Context bonus
                if (context.currentEmotion === match.pattern.emotion) {
                    score += this.contextWeight * 0.5;
                }

                // Variety penalty (avoid recently used patterns)
                if (this.responseHistory.includes(match.pattern.id)) {
                    score -= this.varietyWeight;
                }

                return { match, score };
            });

            // Sort by score
            scored.sort((a, b) => b.score - a.score);

            // Get response from best match
            const best = scored[0];
            if (!best) return null;

            const response = best.match.pattern.getResponse({
                preferVariety: true,
                lastResponse: this.responseHistory[this.responseHistory.length - 1]
            });

            if (response) {
                // Update history
                this.responseHistory.push(best.match.pattern.id);
                if (this.responseHistory.length > this.maxHistory) {
                    this.responseHistory.shift();
                }
            }

            return response;
        }

        /**
         * Clear response history
         */
        clearHistory() {
            this.responseHistory = [];
        }
    }

    // ============================================================
    // LANGUAGE ADAPTER
    // ============================================================

    /**
     * Handles language-specific processing
     * @class LanguageAdapter
     */
    class LanguageAdapter {
        constructor(language = 'ko') {
            this.language = language;
            this.adapters = new Map();

            // Register default adapters
            this.registerAdapter('ko', new KoreanAdapter());
            this.registerAdapter('en', new EnglishAdapter());
        }

        /**
         * Register a language adapter
         * @param {string} language - Language code
         * @param {Object} adapter - Adapter implementation
         */
        registerAdapter(language, adapter) {
            this.adapters.set(language, adapter);
        }

        /**
         * Set current language
         * @param {string} language - Language code
         */
        setLanguage(language) {
            this.language = language;
        }

        /**
         * Get current adapter
         * @returns {Object} Current language adapter
         */
        getAdapter() {
            return this.adapters.get(this.language) || this.adapters.get('ko');
        }

        /**
         * Normalize input text
         * @param {string} text - Input text
         * @returns {string} Normalized text
         */
        normalize(text) {
            return this.getAdapter().normalize(text);
        }

        /**
         * Apply personality to response
         * @param {string} response - Raw response
         * @param {string} emotion - Target emotion
         * @returns {string} Personalized response
         */
        personalize(response, emotion) {
            return this.getAdapter().personalize(response, emotion);
        }

        /**
         * Get greeting for current time
         * @returns {string} Time-appropriate greeting
         */
        getGreeting() {
            return this.getAdapter().getGreeting();
        }
    }

    /**
     * Korean language adapter
     * @class KoreanAdapter
     */
    class KoreanAdapter {
        constructor() {
            this.particles = /[은는이가을를에서로의와과도만]/g;
            this.endings = {
                statement: ['요~', '에요!', '어요~', '이에요!', '네요!'],
                question: ['요?', '까요?', '나요?'],
                exclamation: ['요!!', '에요!!', '네요!!'],
                soft: ['요...', '어요...', '네요...']
            };
            this.emoticons = {
                happy: ['>_<', '^_^', '♡', '✨'],
                sad: ['ㅠㅠ', 'ㅜㅜ', '💧'],
                loving: ['♡', '♥', '💕'],
                excited: ['!!', '✨✨', '🔥']
            };
        }

        normalize(text) {
            return text
                .toLowerCase()
                .replace(this.particles, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        personalize(response, emotion) {
            let modified = response.replace(/[.!?~]+$/, '').trim();

            // Add ending based on emotion
            let endingType = 'statement';
            if (emotion === 'happy' || emotion === 'excited') endingType = 'exclamation';
            else if (emotion === 'sad' || emotion === 'worried') endingType = 'soft';

            const endings = this.endings[endingType];
            modified += endings[Math.floor(Math.random() * endings.length)];

            // Maybe add emoticon
            if (Math.random() < 0.4) {
                const emoticons = this.emoticons[emotion] || this.emoticons.happy;
                modified += ' ' + emoticons[Math.floor(Math.random() * emoticons.length)];
            }

            return modified;
        }

        getGreeting() {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) return '좋은 아침이에요!';
            if (hour >= 12 && hour < 18) return '안녕하세요~!';
            if (hour >= 18 && hour < 22) return '좋은 저녁이에요~';
            return '안녕하세요~';
        }
    }

    /**
     * English language adapter
     * @class EnglishAdapter
     */
    class EnglishAdapter {
        constructor() {
            this.endings = {
                statement: ['!', '.', '~'],
                question: ['?', ' right?', ' okay?'],
                exclamation: ['!!', '!', ' :)'],
                soft: ['...', '.', ' :(']
            };
            this.emoticons = {
                happy: [':)', ':D', '^^', '✨'],
                sad: [':(', 'T_T', '💧'],
                loving: ['<3', '♡', '💕'],
                excited: ['!!', '✨', '🔥']
            };
        }

        normalize(text) {
            return text.toLowerCase().replace(/\s+/g, ' ').trim();
        }

        personalize(response, emotion) {
            let modified = response.replace(/[.!?~]+$/, '').trim();

            let endingType = 'statement';
            if (emotion === 'happy' || emotion === 'excited') endingType = 'exclamation';
            else if (emotion === 'sad' || emotion === 'worried') endingType = 'soft';

            const endings = this.endings[endingType];
            modified += endings[Math.floor(Math.random() * endings.length)];

            if (Math.random() < 0.3) {
                const emoticons = this.emoticons[emotion] || this.emoticons.happy;
                modified += ' ' + emoticons[Math.floor(Math.random() * emoticons.length)];
            }

            return modified;
        }

        getGreeting() {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) return 'Good morning!';
            if (hour >= 12 && hour < 18) return 'Hello~!';
            if (hour >= 18 && hour < 22) return 'Good evening~';
            return 'Hello~';
        }
    }

    // ============================================================
    // PATTERN ENGINE (MAIN CLASS)
    // ============================================================

    /**
     * Main pattern engine that combines all components
     * @class PatternEngine
     */
    class PatternEngine {
        /**
         * @param {Object} [options] - Engine options
         */
        constructor(options = {}) {
            this.registry = new PatternRegistry();
            this.context = new ContextTracker(options.context);
            this.matcher = new PatternMatcher(this.registry, options.matcher);
            this.selector = new ResponseSelector(options.selector);
            this.languageAdapter = new LanguageAdapter(options.language || 'ko');

            // Default fallback responses
            this.fallbacks = {
                ko: ['그렇군요!', '오오 그래요?', '재밌네요!', '더 얘기해주세요~'],
                en: ['I see!', 'Oh really?', 'That\'s interesting!', 'Tell me more~']
            };

            this.initialized = false;
        }

        /**
         * Set language
         * @param {string} language - Language code ('ko' or 'en')
         */
        setLanguage(language) {
            this.matcher.setLanguage(language);
            this.languageAdapter.setLanguage(language);
        }

        /**
         * Load patterns from JSON data
         * @param {Object|Array} data - Pattern data
         */
        loadPatterns(data) {
            const patterns = Array.isArray(data) ? data : (data.patterns || []);
            this.registry.registerAll(patterns);
            this.initialized = true;
        }

        /**
         * Load patterns from URL
         * @param {string} url - URL to patterns JSON
         * @returns {Promise<void>}
         */
        async loadPatternsFromUrl(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
                const data = await response.json();
                this.loadPatterns(data);
            } catch (e) {
                console.error('Failed to load patterns:', e);
                throw e;
            }
        }

        /**
         * Process user input and generate response
         * @param {string} input - User input
         * @param {Object} [options] - Processing options
         * @returns {Object} Response object
         */
        process(input, options = {}) {
            const contextSummary = this.context.getSummary();
            const preferredStrategy = options.strategy || null;

            // Find matching patterns
            const matches = this.matcher.match(input, contextSummary);

            // Select best response
            let response = this.selector.select(matches, contextSummary, preferredStrategy);

            // If no match, use fallback
            if (!response) {
                const fallbacks = this.fallbacks[this.languageAdapter.language] || this.fallbacks.ko;
                response = {
                    text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
                    strategy: STRATEGIES.CASUAL,
                    emotion: 'neutral',
                    intent: 'fallback'
                };
            }

            // Apply language personalization
            if (options.personalize !== false) {
                response.text = this.languageAdapter.personalize(
                    response.text,
                    response.emotion
                );
            }

            // Update context
            this.context.addTurn({
                role: 'user',
                message: input,
                type: response.intent,
                emotion: options.userEmotion || 'neutral'
            });

            this.context.addTurn({
                role: 'assistant',
                message: response.text,
                type: response.contextSets || response.intent,
                emotion: response.emotion
            });

            return {
                response: response.text,
                strategy: response.strategy,
                emotion: response.emotion,
                intent: response.intent,
                confidence: matches.length > 0 ? matches[0].score : 0,
                matchCount: matches.length
            };
        }

        /**
         * Get greeting message
         * @returns {string} Greeting
         */
        getGreeting() {
            return this.languageAdapter.getGreeting();
        }

        /**
         * Clear conversation context
         */
        clearContext() {
            this.context.clear();
            this.selector.clearHistory();
        }

        /**
         * Get engine statistics
         * @returns {Object} Statistics
         */
        getStats() {
            return {
                patterns: this.registry.getStats(),
                context: {
                    turnCount: this.context.history.length,
                    currentEmotion: this.context.currentEmotion,
                    currentTopic: this.context.currentTopic
                }
            };
        }

        /**
         * Register a custom pattern
         * @param {Object} config - Pattern configuration
         * @returns {Pattern} Registered pattern
         */
        addPattern(config) {
            return this.registry.register(config);
        }

        /**
         * Set fallback responses
         * @param {string} language - Language code
         * @param {string[]} fallbacks - Fallback responses
         */
        setFallbacks(language, fallbacks) {
            this.fallbacks[language] = fallbacks;
        }
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        /** @type {string} Library version */
        version: '1.0.0',

        // Main classes
        PatternEngine,
        Pattern,
        PatternRegistry,
        PatternMatcher,
        ContextTracker,
        ResponseSelector,
        LanguageAdapter,

        // Language adapters
        KoreanAdapter,
        EnglishAdapter,

        // Constants
        STRATEGIES,
        INTENSITY,
        MATCH_TYPE,
        CONTEXT_TYPE,

        // Utility functions
        utils: {
            levenshtein,
            similarity,
            jaccardSimilarity,
            getNgrams,
            normalizeKorean,
            generateId
        },

        // Factory function
        create: (options) => new PatternEngine(options)
    };
}));
