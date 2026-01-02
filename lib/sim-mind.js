/**
 * SimMind - Lightweight Conversation Neural Network
 * @version 1.0.0
 * @license MIT
 * @module SimMind
 *
 * A small, trainable neural network for conversation AI.
 * Features:
 * - Text embedding with learned vectors
 * - Multi-layer perceptron for classification
 * - Online learning with backpropagation
 * - Relationship/affection tracking
 * - Conversation state machine
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimMind = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ============================================================
    // MATH UTILITIES
    // ============================================================

    const MathOps = {
        // Activation functions
        sigmoid(x) {
            return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
        },

        sigmoidDerivative(x) {
            const s = this.sigmoid(x);
            return s * (1 - s);
        },

        tanh(x) {
            return Math.tanh(x);
        },

        tanhDerivative(x) {
            const t = Math.tanh(x);
            return 1 - t * t;
        },

        relu(x) {
            return Math.max(0, x);
        },

        reluDerivative(x) {
            return x > 0 ? 1 : 0;
        },

        softmax(arr) {
            const max = Math.max(...arr);
            const exps = arr.map(x => Math.exp(x - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            return exps.map(e => e / sum);
        },

        // Vector operations
        dot(a, b) {
            let sum = 0;
            for (let i = 0; i < a.length; i++) {
                sum += a[i] * b[i];
            }
            return sum;
        },

        add(a, b) {
            return a.map((v, i) => v + b[i]);
        },

        scale(a, s) {
            return a.map(v => v * s);
        },

        subtract(a, b) {
            return a.map((v, i) => v - b[i]);
        },

        hadamard(a, b) {
            return a.map((v, i) => v * b[i]);
        },

        normalize(arr) {
            const sum = arr.reduce((a, b) => a + b, 0);
            return sum > 0 ? arr.map(v => v / sum) : arr;
        },

        cosineSimilarity(a, b) {
            let dot = 0, normA = 0, normB = 0;
            for (let i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                normA += a[i] * a[i];
                normB += b[i] * b[i];
            }
            const denom = Math.sqrt(normA) * Math.sqrt(normB);
            return denom > 0 ? dot / denom : 0;
        },

        // Random initialization
        randomNormal(mean = 0, std = 1) {
            const u1 = Math.random();
            const u2 = Math.random();
            return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        },

        // Xavier initialization
        xavier(fanIn, fanOut) {
            const std = Math.sqrt(2 / (fanIn + fanOut));
            return this.randomNormal(0, std);
        }
    };

    // ============================================================
    // VOCABULARY
    // ============================================================

    /**
     * Simple vocabulary for text processing
     */
    class Vocabulary {
        constructor(options = {}) {
            this.wordToId = new Map();
            this.idToWord = new Map();
            this.wordFreq = new Map();
            this.nextId = 0;
            this.minFreq = options.minFreq || 1;
            this.maxSize = options.maxSize || 10000;

            // Special tokens
            this.PAD = this.addWord('[PAD]');
            this.UNK = this.addWord('[UNK]');
        }

        addWord(word) {
            if (!this.wordToId.has(word)) {
                if (this.nextId >= this.maxSize) return this.UNK;
                this.wordToId.set(word, this.nextId);
                this.idToWord.set(this.nextId, word);
                this.nextId++;
            }
            this.wordFreq.set(word, (this.wordFreq.get(word) || 0) + 1);
            return this.wordToId.get(word);
        }

        getIdOrUnk(word) {
            return this.wordToId.get(word) ?? this.UNK;
        }

        getWord(id) {
            return this.idToWord.get(id) || '[UNK]';
        }

        get size() {
            return this.nextId;
        }

        tokenize(text) {
            // Simple tokenization for Korean/English
            return text
                .toLowerCase()
                .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 0);
        }

        encode(text, maxLen = 20) {
            const tokens = this.tokenize(text);
            const ids = tokens.map(t => this.getIdOrUnk(t));

            // Pad or truncate
            while (ids.length < maxLen) ids.push(this.PAD);
            return ids.slice(0, maxLen);
        }

        buildFromTexts(texts) {
            for (const text of texts) {
                const tokens = this.tokenize(text);
                for (const token of tokens) {
                    this.addWord(token);
                }
            }
        }

        toJSON() {
            return {
                wordToId: Array.from(this.wordToId.entries()),
                nextId: this.nextId
            };
        }

        fromJSON(data) {
            this.wordToId = new Map(data.wordToId);
            this.idToWord = new Map(data.wordToId.map(([w, i]) => [i, w]));
            this.nextId = data.nextId;
        }
    }

    // ============================================================
    // EMBEDDING LAYER
    // ============================================================

    /**
     * Learnable word embeddings
     */
    class Embedding {
        constructor(vocabSize, embeddingDim) {
            this.vocabSize = vocabSize;
            this.embeddingDim = embeddingDim;

            // Initialize embeddings with Xavier
            this.weights = [];
            for (let i = 0; i < vocabSize; i++) {
                const vec = [];
                for (let j = 0; j < embeddingDim; j++) {
                    vec.push(MathOps.xavier(vocabSize, embeddingDim));
                }
                this.weights.push(vec);
            }

            // Gradients for training
            this.gradients = null;
        }

        forward(indices) {
            // Average pooling of embeddings
            const result = new Array(this.embeddingDim).fill(0);
            let count = 0;

            for (const idx of indices) {
                if (idx >= 0 && idx < this.vocabSize) {
                    for (let j = 0; j < this.embeddingDim; j++) {
                        result[j] += this.weights[idx][j];
                    }
                    count++;
                }
            }

            if (count > 0) {
                for (let j = 0; j < this.embeddingDim; j++) {
                    result[j] /= count;
                }
            }

            // Store for backward
            this._lastIndices = indices;
            this._lastCount = count;

            return result;
        }

        backward(gradOutput, learningRate) {
            if (!this._lastIndices || this._lastCount === 0) return;

            const scale = learningRate / this._lastCount;
            for (const idx of this._lastIndices) {
                if (idx >= 0 && idx < this.vocabSize) {
                    for (let j = 0; j < this.embeddingDim; j++) {
                        this.weights[idx][j] -= gradOutput[j] * scale;
                    }
                }
            }
        }

        getVector(idx) {
            if (idx >= 0 && idx < this.vocabSize) {
                return [...this.weights[idx]];
            }
            return new Array(this.embeddingDim).fill(0);
        }

        toJSON() {
            return {
                vocabSize: this.vocabSize,
                embeddingDim: this.embeddingDim,
                weights: this.weights
            };
        }

        fromJSON(data) {
            this.vocabSize = data.vocabSize;
            this.embeddingDim = data.embeddingDim;
            this.weights = data.weights;
        }
    }

    // ============================================================
    // DENSE LAYER
    // ============================================================

    /**
     * Fully connected layer with activation
     */
    class Dense {
        constructor(inputDim, outputDim, activation = 'relu') {
            this.inputDim = inputDim;
            this.outputDim = outputDim;
            this.activation = activation;

            // Xavier initialization
            this.weights = [];
            for (let i = 0; i < outputDim; i++) {
                const row = [];
                for (let j = 0; j < inputDim; j++) {
                    row.push(MathOps.xavier(inputDim, outputDim));
                }
                this.weights.push(row);
            }

            this.biases = new Array(outputDim).fill(0);

            // Cache for backward
            this._lastInput = null;
            this._lastPreActivation = null;
        }

        forward(input) {
            this._lastInput = input;

            const preActivation = [];
            for (let i = 0; i < this.outputDim; i++) {
                let sum = this.biases[i];
                for (let j = 0; j < this.inputDim; j++) {
                    sum += this.weights[i][j] * input[j];
                }
                preActivation.push(sum);
            }

            this._lastPreActivation = preActivation;

            // Apply activation
            switch (this.activation) {
                case 'sigmoid':
                    return preActivation.map(x => MathOps.sigmoid(x));
                case 'tanh':
                    return preActivation.map(x => MathOps.tanh(x));
                case 'relu':
                    return preActivation.map(x => MathOps.relu(x));
                case 'softmax':
                    return MathOps.softmax(preActivation);
                default:
                    return preActivation;
            }
        }

        backward(gradOutput, learningRate) {
            // Compute activation derivative
            let gradPreActivation;

            switch (this.activation) {
                case 'sigmoid':
                    gradPreActivation = gradOutput.map((g, i) =>
                        g * MathOps.sigmoidDerivative(this._lastPreActivation[i]));
                    break;
                case 'tanh':
                    gradPreActivation = gradOutput.map((g, i) =>
                        g * MathOps.tanhDerivative(this._lastPreActivation[i]));
                    break;
                case 'relu':
                    gradPreActivation = gradOutput.map((g, i) =>
                        g * MathOps.reluDerivative(this._lastPreActivation[i]));
                    break;
                case 'softmax':
                    // Simplified: assume cross-entropy loss
                    gradPreActivation = gradOutput;
                    break;
                default:
                    gradPreActivation = gradOutput;
            }

            // Gradient for input (to pass back)
            const gradInput = new Array(this.inputDim).fill(0);
            for (let j = 0; j < this.inputDim; j++) {
                for (let i = 0; i < this.outputDim; i++) {
                    gradInput[j] += this.weights[i][j] * gradPreActivation[i];
                }
            }

            // Update weights and biases
            for (let i = 0; i < this.outputDim; i++) {
                for (let j = 0; j < this.inputDim; j++) {
                    this.weights[i][j] -= learningRate * gradPreActivation[i] * this._lastInput[j];
                }
                this.biases[i] -= learningRate * gradPreActivation[i];
            }

            return gradInput;
        }

        toJSON() {
            return {
                inputDim: this.inputDim,
                outputDim: this.outputDim,
                activation: this.activation,
                weights: this.weights,
                biases: this.biases
            };
        }

        fromJSON(data) {
            this.inputDim = data.inputDim;
            this.outputDim = data.outputDim;
            this.activation = data.activation;
            this.weights = data.weights;
            this.biases = data.biases;
        }
    }

    // ============================================================
    // INTENT CLASSIFIER
    // ============================================================

    /**
     * Neural network for intent classification
     */
    class IntentClassifier {
        constructor(options = {}) {
            this.vocabSize = options.vocabSize || 5000;
            this.embeddingDim = options.embeddingDim || 32;
            this.hiddenDim = options.hiddenDim || 64;
            this.numClasses = options.numClasses || 10;
            this.learningRate = options.learningRate || 0.01;

            this.vocab = new Vocabulary({ maxSize: this.vocabSize });
            this.embedding = null;
            this.hidden = null;
            this.output = null;

            this.classNames = options.classNames || [];
            this.trained = false;
        }

        _initLayers() {
            this.embedding = new Embedding(this.vocab.size, this.embeddingDim);
            this.hidden = new Dense(this.embeddingDim, this.hiddenDim, 'relu');
            this.output = new Dense(this.hiddenDim, this.numClasses, 'softmax');
        }

        train(examples, epochs = 10) {
            // examples: [{text: "...", label: "greeting"}, ...]

            // Build vocabulary
            const texts = examples.map(e => e.text);
            this.vocab.buildFromTexts(texts);

            // Get unique labels
            const labels = [...new Set(examples.map(e => e.label))];
            this.classNames = labels;
            this.numClasses = labels.length;

            // Initialize layers
            this._initLayers();

            // Training loop
            for (let epoch = 0; epoch < epochs; epoch++) {
                let totalLoss = 0;

                // Shuffle examples
                const shuffled = [...examples].sort(() => Math.random() - 0.5);

                for (const example of shuffled) {
                    const indices = this.vocab.encode(example.text);
                    const labelIdx = this.classNames.indexOf(example.label);

                    // Forward pass
                    const embedded = this.embedding.forward(indices);
                    const hiddenOut = this.hidden.forward(embedded);
                    const probs = this.output.forward(hiddenOut);

                    // Cross-entropy loss
                    const loss = -Math.log(Math.max(probs[labelIdx], 1e-10));
                    totalLoss += loss;

                    // Backward pass (softmax + cross-entropy gradient)
                    const gradOutput = [...probs];
                    gradOutput[labelIdx] -= 1;

                    const gradHidden = this.output.backward(gradOutput, this.learningRate);
                    const gradEmbedding = this.hidden.backward(gradHidden, this.learningRate);
                    this.embedding.backward(gradEmbedding, this.learningRate);
                }

                if ((epoch + 1) % 5 === 0) {
                    console.log(`Epoch ${epoch + 1}/${epochs}, Loss: ${(totalLoss / examples.length).toFixed(4)}`);
                }
            }

            this.trained = true;
        }

        predict(text) {
            if (!this.trained) {
                return { label: 'unknown', confidence: 0, scores: {} };
            }

            const indices = this.vocab.encode(text);
            const embedded = this.embedding.forward(indices);
            const hiddenOut = this.hidden.forward(embedded);
            const probs = this.output.forward(hiddenOut);

            let maxIdx = 0;
            let maxProb = probs[0];
            for (let i = 1; i < probs.length; i++) {
                if (probs[i] > maxProb) {
                    maxProb = probs[i];
                    maxIdx = i;
                }
            }

            const scores = {};
            for (let i = 0; i < this.classNames.length; i++) {
                scores[this.classNames[i]] = probs[i];
            }

            return {
                label: this.classNames[maxIdx],
                confidence: maxProb,
                scores
            };
        }

        toJSON() {
            return {
                vocabSize: this.vocabSize,
                embeddingDim: this.embeddingDim,
                hiddenDim: this.hiddenDim,
                numClasses: this.numClasses,
                classNames: this.classNames,
                vocab: this.vocab.toJSON(),
                embedding: this.embedding?.toJSON(),
                hidden: this.hidden?.toJSON(),
                output: this.output?.toJSON(),
                trained: this.trained
            };
        }

        fromJSON(data) {
            this.vocabSize = data.vocabSize;
            this.embeddingDim = data.embeddingDim;
            this.hiddenDim = data.hiddenDim;
            this.numClasses = data.numClasses;
            this.classNames = data.classNames;
            this.vocab.fromJSON(data.vocab);

            if (data.embedding) {
                this.embedding = new Embedding(1, 1);
                this.embedding.fromJSON(data.embedding);
            }
            if (data.hidden) {
                this.hidden = new Dense(1, 1);
                this.hidden.fromJSON(data.hidden);
            }
            if (data.output) {
                this.output = new Dense(1, 1);
                this.output.fromJSON(data.output);
            }

            this.trained = data.trained;
        }
    }

    // ============================================================
    // RELATIONSHIP SYSTEM
    // ============================================================

    /**
     * Tracks relationship/affection with user
     */
    class Relationship {
        constructor(options = {}) {
            // Core stats (0-100)
            this.affection = options.affection || 50;
            this.trust = options.trust || 50;
            this.familiarity = options.familiarity || 0;

            // Conversation stats
            this.totalConversations = 0;
            this.totalMessages = 0;
            this.positiveInteractions = 0;
            this.negativeInteractions = 0;

            // Time tracking
            this.firstMet = options.firstMet || Date.now();
            this.lastInteraction = Date.now();
            this.streakDays = 0;
            this.lastStreakDate = null;

            // Personality memory
            this.knownFacts = new Map(); // things user shared
            this.preferences = new Map(); // what user likes/dislikes
            this.nicknames = [];
            this.specialDates = [];

            // Mood influence
            this.moodModifier = 0;
        }

        /**
         * Get relationship level (1-5 stars)
         */
        getLevel() {
            const avg = (this.affection + this.trust + Math.min(this.familiarity, 100)) / 3;
            if (avg >= 90) return 5;
            if (avg >= 70) return 4;
            if (avg >= 50) return 3;
            if (avg >= 30) return 2;
            return 1;
        }

        /**
         * Get relationship title
         */
        getTitle() {
            const level = this.getLevel();
            const titles = {
                1: { ko: '처음 만난 사람', en: 'Stranger' },
                2: { ko: '아는 사람', en: 'Acquaintance' },
                3: { ko: '친구', en: 'Friend' },
                4: { ko: '절친', en: 'Close Friend' },
                5: { ko: '베프', en: 'Best Friend' }
            };
            return titles[level];
        }

        /**
         * Process interaction and update stats
         */
        interact(type, intensity = 1) {
            this.totalMessages++;
            this.lastInteraction = Date.now();

            // Check streak
            const today = new Date().toDateString();
            if (this.lastStreakDate !== today) {
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                if (this.lastStreakDate === yesterday) {
                    this.streakDays++;
                } else if (this.lastStreakDate !== null) {
                    this.streakDays = 1;
                } else {
                    this.streakDays = 1;
                }
                this.lastStreakDate = today;
            }

            // Update based on interaction type
            switch (type) {
                case 'positive':
                    this.affection = Math.min(100, this.affection + 2 * intensity);
                    this.trust = Math.min(100, this.trust + 1 * intensity);
                    this.positiveInteractions++;
                    break;
                case 'negative':
                    this.affection = Math.max(0, this.affection - 3 * intensity);
                    this.trust = Math.max(0, this.trust - 2 * intensity);
                    this.negativeInteractions++;
                    break;
                case 'neutral':
                    this.familiarity = Math.min(100, this.familiarity + 0.5);
                    break;
                case 'share': // user shared something personal
                    this.trust = Math.min(100, this.trust + 3 * intensity);
                    this.familiarity = Math.min(100, this.familiarity + 2);
                    break;
                case 'compliment':
                    this.affection = Math.min(100, this.affection + 4 * intensity);
                    this.positiveInteractions++;
                    break;
                case 'insult':
                    this.affection = Math.max(0, this.affection - 5 * intensity);
                    this.trust = Math.max(0, this.trust - 3 * intensity);
                    this.negativeInteractions++;
                    break;
            }

            // Streak bonus
            if (this.streakDays > 1) {
                this.affection = Math.min(100, this.affection + 0.5);
            }

            // Familiarity grows over time
            this.familiarity = Math.min(100, this.familiarity + 0.2);
        }

        /**
         * Remember a fact about user
         */
        rememberFact(key, value) {
            this.knownFacts.set(key, {
                value,
                timestamp: Date.now()
            });
        }

        /**
         * Get remembered fact
         */
        getFact(key) {
            return this.knownFacts.get(key)?.value;
        }

        /**
         * Set user preference
         */
        setPreference(key, value) {
            this.preferences.set(key, value);
        }

        /**
         * Check if should use informal speech
         */
        shouldBeInformal() {
            return this.familiarity >= 30 && this.getLevel() >= 3;
        }

        /**
         * Get response modifier based on relationship
         */
        getResponseModifier() {
            const level = this.getLevel();
            return {
                intimacy: level / 5,
                enthusiasm: this.affection / 100,
                openness: this.trust / 100,
                useNickname: this.nicknames.length > 0 && level >= 4,
                nickname: this.nicknames[0] || null
            };
        }

        toJSON() {
            return {
                affection: this.affection,
                trust: this.trust,
                familiarity: this.familiarity,
                totalConversations: this.totalConversations,
                totalMessages: this.totalMessages,
                positiveInteractions: this.positiveInteractions,
                negativeInteractions: this.negativeInteractions,
                firstMet: this.firstMet,
                lastInteraction: this.lastInteraction,
                streakDays: this.streakDays,
                lastStreakDate: this.lastStreakDate,
                knownFacts: Array.from(this.knownFacts.entries()),
                preferences: Array.from(this.preferences.entries()),
                nicknames: this.nicknames,
                specialDates: this.specialDates
            };
        }

        fromJSON(data) {
            Object.assign(this, data);
            this.knownFacts = new Map(data.knownFacts || []);
            this.preferences = new Map(data.preferences || []);
        }
    }

    // ============================================================
    // CONVERSATION STATE MACHINE
    // ============================================================

    /**
     * Manages conversation flow states
     */
    class ConversationState {
        constructor() {
            this.currentState = 'idle';
            this.previousState = null;
            this.stateData = {};
            this.transitionHistory = [];
            this.turnsSinceStateChange = 0;

            // Define valid states and transitions
            this.states = {
                idle: ['greeting', 'question', 'statement'],
                greeting: ['conversation', 'question', 'farewell'],
                conversation: ['question', 'emotion', 'topic', 'farewell', 'flirt'],
                question: ['answer', 'conversation', 'topic'],
                answer: ['conversation', 'question', 'topic'],
                emotion: ['comfort', 'celebrate', 'conversation'],
                comfort: ['conversation', 'emotion'],
                celebrate: ['conversation', 'emotion'],
                topic: ['conversation', 'question', 'emotion'],
                flirt: ['conversation', 'emotion', 'farewell'],
                farewell: ['idle']
            };
        }

        /**
         * Transition to new state
         */
        transition(newState, data = {}) {
            if (!this.canTransition(newState)) {
                console.warn(`Invalid transition: ${this.currentState} -> ${newState}`);
                return false;
            }

            this.previousState = this.currentState;
            this.currentState = newState;
            this.stateData = data;
            this.turnsSinceStateChange = 0;

            this.transitionHistory.push({
                from: this.previousState,
                to: newState,
                timestamp: Date.now(),
                data
            });

            // Keep history limited
            if (this.transitionHistory.length > 50) {
                this.transitionHistory.shift();
            }

            return true;
        }

        /**
         * Check if transition is valid
         */
        canTransition(newState) {
            const allowed = this.states[this.currentState] || [];
            return allowed.includes(newState);
        }

        /**
         * Increment turn counter
         */
        tick() {
            this.turnsSinceStateChange++;
        }

        /**
         * Get suggested next states
         */
        getSuggestedTransitions() {
            return this.states[this.currentState] || [];
        }

        /**
         * Reset to idle
         */
        reset() {
            this.currentState = 'idle';
            this.previousState = null;
            this.stateData = {};
            this.turnsSinceStateChange = 0;
        }

        toJSON() {
            return {
                currentState: this.currentState,
                previousState: this.previousState,
                stateData: this.stateData,
                turnsSinceStateChange: this.turnsSinceStateChange
            };
        }

        fromJSON(data) {
            Object.assign(this, data);
        }
    }

    // ============================================================
    // CONDITIONAL RESPONSE SYSTEM
    // ============================================================

    /**
     * Manages conditional responses based on context
     */
    class ConditionalResponder {
        constructor() {
            this.conditions = [];
        }

        /**
         * Add a conditional response rule
         */
        addRule(rule) {
            // rule: { conditions: {...}, responses: [...], priority: 0 }
            this.conditions.push({
                id: rule.id || Date.now().toString(36),
                conditions: rule.conditions || {},
                responses: rule.responses || [],
                priority: rule.priority || 0,
                strategy: rule.strategy || 'casual',
                emotion: rule.emotion || 'neutral'
            });

            // Sort by priority
            this.conditions.sort((a, b) => b.priority - a.priority);
        }

        /**
         * Find matching responses based on context
         */
        findResponses(context) {
            const matches = [];

            for (const rule of this.conditions) {
                if (this._checkConditions(rule.conditions, context)) {
                    matches.push(rule);
                }
            }

            return matches;
        }

        /**
         * Check if all conditions are met
         */
        _checkConditions(conditions, context) {
            for (const [key, value] of Object.entries(conditions)) {
                switch (key) {
                    case 'relationshipLevel':
                        if (context.relationshipLevel < value) return false;
                        break;
                    case 'minAffection':
                        if (context.affection < value) return false;
                        break;
                    case 'maxAffection':
                        if (context.affection > value) return false;
                        break;
                    case 'state':
                        if (context.state !== value) return false;
                        break;
                    case 'previousState':
                        if (context.previousState !== value) return false;
                        break;
                    case 'emotion':
                        if (context.userEmotion !== value) return false;
                        break;
                    case 'turnCount':
                        if (typeof value === 'object') {
                            if (value.min && context.turnCount < value.min) return false;
                            if (value.max && context.turnCount > value.max) return false;
                        } else if (context.turnCount !== value) {
                            return false;
                        }
                        break;
                    case 'timeOfDay':
                        const hour = new Date().getHours();
                        if (value === 'morning' && (hour < 5 || hour >= 12)) return false;
                        if (value === 'afternoon' && (hour < 12 || hour >= 18)) return false;
                        if (value === 'evening' && (hour < 18 || hour >= 22)) return false;
                        if (value === 'night' && (hour >= 5 && hour < 22)) return false;
                        break;
                    case 'streak':
                        if (typeof value === 'object') {
                            if (value.min && context.streak < value.min) return false;
                        } else if (context.streak < value) {
                            return false;
                        }
                        break;
                    case 'hasNickname':
                        if (value && !context.nickname) return false;
                        if (!value && context.nickname) return false;
                        break;
                    case 'knowsFact':
                        if (!context.knownFacts?.has(value)) return false;
                        break;
                }
            }
            return true;
        }

        /**
         * Get best response for context
         */
        getResponse(context) {
            const matches = this.findResponses(context);
            if (matches.length === 0) return null;

            // Get highest priority match
            const best = matches[0];
            const response = best.responses[Math.floor(Math.random() * best.responses.length)];

            return {
                text: response,
                strategy: best.strategy,
                emotion: best.emotion,
                ruleId: best.id
            };
        }

        toJSON() {
            return { conditions: this.conditions };
        }

        fromJSON(data) {
            this.conditions = data.conditions || [];
        }
    }

    // ============================================================
    // MIND ENGINE (MAIN CLASS)
    // ============================================================

    /**
     * Main conversation AI engine
     */
    class MindEngine {
        constructor(options = {}) {
            this.classifier = new IntentClassifier(options.classifier);
            this.relationship = new Relationship(options.relationship);
            this.state = new ConversationState();
            this.responder = new ConditionalResponder();

            this.language = options.language || 'ko';
            this.characterName = options.characterName || '심이';

            // Persistence
            this.storageKey = options.storageKey || 'simmind_data';
        }

        /**
         * Process user input and generate response
         */
        process(input, userEmotion = 'neutral') {
            // Classify intent
            const classification = this.classifier.predict(input);

            // Build context
            const context = {
                input,
                intent: classification.label,
                confidence: classification.confidence,
                userEmotion,
                relationshipLevel: this.relationship.getLevel(),
                affection: this.relationship.affection,
                trust: this.relationship.trust,
                familiarity: this.relationship.familiarity,
                state: this.state.currentState,
                previousState: this.state.previousState,
                turnCount: this.state.turnsSinceStateChange,
                streak: this.relationship.streakDays,
                nickname: this.relationship.nicknames[0],
                knownFacts: this.relationship.knownFacts
            };

            // Find conditional response
            const conditionalResponse = this.responder.getResponse(context);

            // Update relationship based on emotion
            let interactionType = 'neutral';
            if (['happy', 'excited', 'loving'].includes(userEmotion)) {
                interactionType = 'positive';
            } else if (['angry', 'sad'].includes(userEmotion)) {
                interactionType = 'negative';
            }
            this.relationship.interact(interactionType);

            // Update state
            this.state.tick();

            // Determine state transition based on intent
            const stateTransition = this._getStateFromIntent(classification.label);
            if (stateTransition) {
                this.state.transition(stateTransition);
            }

            return {
                response: conditionalResponse,
                intent: classification.label,
                confidence: classification.confidence,
                relationship: this.relationship.getResponseModifier(),
                state: this.state.currentState,
                context
            };
        }

        /**
         * Map intent to conversation state
         */
        _getStateFromIntent(intent) {
            const mapping = {
                greeting: 'greeting',
                farewell: 'farewell',
                question: 'question',
                personal_question: 'question',
                emotion_share: 'emotion',
                compliment: 'flirt',
                gratitude: 'conversation',
                apology: 'conversation',
                humor: 'conversation',
                statement: 'conversation'
            };
            return mapping[intent] || null;
        }

        /**
         * Add training examples for classifier
         */
        trainClassifier(examples, epochs = 10) {
            this.classifier.train(examples, epochs);
        }

        /**
         * Add conditional response rules
         */
        addResponseRule(rule) {
            this.responder.addRule(rule);
        }

        /**
         * Add multiple response rules
         */
        addResponseRules(rules) {
            for (const rule of rules) {
                this.responder.addRule(rule);
            }
        }

        /**
         * Remember something about user
         */
        remember(key, value) {
            this.relationship.rememberFact(key, value);
        }

        /**
         * Set user's nickname
         */
        setNickname(nickname) {
            if (!this.relationship.nicknames.includes(nickname)) {
                this.relationship.nicknames.push(nickname);
            }
        }

        /**
         * Get relationship stats
         */
        getRelationshipStats() {
            return {
                level: this.relationship.getLevel(),
                title: this.relationship.getTitle(),
                affection: this.relationship.affection,
                trust: this.relationship.trust,
                familiarity: this.relationship.familiarity,
                streak: this.relationship.streakDays,
                totalMessages: this.relationship.totalMessages
            };
        }

        /**
         * Save state to localStorage
         */
        save() {
            try {
                const data = {
                    classifier: this.classifier.toJSON(),
                    relationship: this.relationship.toJSON(),
                    state: this.state.toJSON(),
                    responder: this.responder.toJSON(),
                    savedAt: Date.now()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(data));
                return true;
            } catch (e) {
                console.warn('Failed to save MindEngine:', e);
                return false;
            }
        }

        /**
         * Load state from localStorage
         */
        load() {
            try {
                const saved = localStorage.getItem(this.storageKey);
                if (!saved) return false;

                const data = JSON.parse(saved);
                if (data.classifier) this.classifier.fromJSON(data.classifier);
                if (data.relationship) this.relationship.fromJSON(data.relationship);
                if (data.state) this.state.fromJSON(data.state);
                if (data.responder) this.responder.fromJSON(data.responder);

                console.log('MindEngine loaded from', new Date(data.savedAt));
                return true;
            } catch (e) {
                console.warn('Failed to load MindEngine:', e);
                return false;
            }
        }

        /**
         * Reset all state
         */
        reset() {
            this.relationship = new Relationship();
            this.state.reset();
            localStorage.removeItem(this.storageKey);
        }
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        version: '1.0.0',

        // Main class
        MindEngine,

        // Components
        IntentClassifier,
        Relationship,
        ConversationState,
        ConditionalResponder,

        // Neural network building blocks
        Vocabulary,
        Embedding,
        Dense,

        // Utilities
        MathOps,

        // Factory
        create: (options) => new MindEngine(options)
    };
}));
