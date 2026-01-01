/**
 * SimGame - Game-Theoretic AI Engine
 * @version 1.1.0
 * @license MIT
 * @module SimGame
 *
 * Implements game-theoretic algorithms for conversation strategy selection:
 * - Multi-Armed Bandit (Thompson Sampling + UCB1)
 * - Markov Decision Process (Q-Learning)
 * - Bayesian User Preference Modeling
 * - Reward Estimation from User Signals
 *
 * @example
 * const engine = SimGame.create({ storageKey: 'my_game' });
 * const strategy = engine.selectStrategy();
 * engine.processFeedback(strategy, userResponse);
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimGame = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ========================================
    // Validation Helpers
    // ========================================

    /**
     * Clamp value to range
     * @private
     */
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Validate number in range
     * @private
     */
    function validateNumber(value, name, min = -Infinity, max = Infinity) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new TypeError(`${name} must be a number`);
        }
        return clamp(value, min, max);
    }

    /**
     * Validate non-negative integer
     * @private
     */
    function validateNonNegativeInt(value, name) {
        if (!Number.isInteger(value) || value < 0) {
            throw new TypeError(`${name} must be a non-negative integer`);
        }
        return value;
    }

    // ========================================
    // Math Utilities
    // ========================================
    const MathUtils = {
        // Beta distribution sampling using Gamma distribution
        sampleBeta(alpha, beta) {
            const gammaAlpha = this.sampleGamma(alpha);
            const gammaBeta = this.sampleGamma(beta);
            return gammaAlpha / (gammaAlpha + gammaBeta);
        },

        // Gamma distribution sampling (Marsaglia and Tsang's method)
        sampleGamma(shape) {
            if (shape < 1) {
                return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
            }
            const d = shape - 1/3;
            const c = 1 / Math.sqrt(9 * d);
            while (true) {
                let x, v;
                do {
                    x = this.sampleNormal();
                    v = 1 + c * x;
                } while (v <= 0);
                v = v * v * v;
                const u = Math.random();
                if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
                if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
            }
        },

        // Standard normal sampling (Box-Muller)
        sampleNormal() {
            const u1 = Math.random();
            const u2 = Math.random();
            return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        },

        // Softmax with temperature
        softmax(values, temperature = 1.0) {
            const maxVal = Math.max(...values);
            const exps = values.map(v => Math.exp((v - maxVal) / temperature));
            const sum = exps.reduce((a, b) => a + b, 0);
            return exps.map(e => e / sum);
        },

        // Weighted random selection
        weightedChoice(items, weights) {
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < items.length; i++) {
                r -= weights[i];
                if (r <= 0) return items[i];
            }
            return items[items.length - 1];
        },

        // Argmax
        argmax(arr) {
            return arr.reduce((maxIdx, val, idx, a) => val > a[maxIdx] ? idx : maxIdx, 0);
        }
    };

    // ========================================
    // Strategy Types
    // ========================================
    const STRATEGIES = ['empathetic', 'humorous', 'questioning', 'informative', 'casual'];
    const STRATEGY_MAP = Object.fromEntries(STRATEGIES.map((s, i) => [s, i]));

    // ========================================
    // Multi-Armed Bandit (Thompson Sampling + UCB)
    // ========================================

    /**
     * Multi-Armed Bandit with Thompson Sampling and UCB1
     * @class MultiArmedBandit
     */
    class MultiArmedBandit {
        /**
         * Create a Multi-Armed Bandit
         * @param {Object} [options] - Configuration options
         * @param {number} [options.numArms] - Number of arms (strategies)
         * @param {number} [options.explorationParam=2.0] - UCB exploration parameter
         */
        constructor(options = {}) {
            /** @type {number} Number of arms */
            this.numArms = options.numArms || STRATEGIES.length;
            /** @type {number} UCB exploration parameter */
            this.c = options.explorationParam || 2.0;

            // Beta distribution parameters for each arm
            /** @type {number[]} Alpha parameters (successes + 1) */
            this.alpha = new Array(this.numArms).fill(1);
            /** @type {number[]} Beta parameters (failures + 1) */
            this.beta = new Array(this.numArms).fill(1);

            // Statistics
            /** @type {number[]} Pull counts per arm */
            this.pulls = new Array(this.numArms).fill(0);
            /** @type {number} Total pulls */
            this.totalPulls = 0;
            /** @type {number[]} Cumulative rewards per arm */
            this.rewards = new Array(this.numArms).fill(0);
        }

        // Thompson Sampling: sample from posterior and select best
        selectThompson() {
            const samples = [];
            for (let i = 0; i < this.numArms; i++) {
                samples.push(MathUtils.sampleBeta(this.alpha[i], this.beta[i]));
            }
            return MathUtils.argmax(samples);
        }

        // UCB1: Upper Confidence Bound
        selectUCB() {
            // If any arm hasn't been pulled, pull it
            for (let i = 0; i < this.numArms; i++) {
                if (this.pulls[i] === 0) return i;
            }

            const ucbValues = [];
            for (let i = 0; i < this.numArms; i++) {
                const avgReward = this.rewards[i] / this.pulls[i];
                const exploration = this.c * Math.sqrt(Math.log(this.totalPulls) / this.pulls[i]);
                ucbValues.push(avgReward + exploration);
            }
            return MathUtils.argmax(ucbValues);
        }

        // Combined selection (default: Thompson Sampling)
        select(method = 'thompson') {
            return method === 'ucb' ? this.selectUCB() : this.selectThompson();
        }

        // Get score for each arm (for weighted combination)
        getScores() {
            const scores = [];
            for (let i = 0; i < this.numArms; i++) {
                // Expected value of Beta distribution
                scores.push(this.alpha[i] / (this.alpha[i] + this.beta[i]));
            }
            return scores;
        }

        /**
         * Update arm with reward
         * @param {number} arm - Arm index
         * @param {number} reward - Reward value (clamped to 0-1)
         */
        update(arm, reward) {
            // Validate inputs
            arm = validateNonNegativeInt(arm, 'arm');
            if (arm >= this.numArms) {
                throw new RangeError(`arm must be < ${this.numArms}, got ${arm}`);
            }
            reward = clamp(reward, 0, 1);

            this.pulls[arm]++;
            this.totalPulls++;
            this.rewards[arm] += reward;

            // Bayesian update for Beta distribution
            // Success: α += reward, Failure: β += (1 - reward)
            this.alpha[arm] += reward;
            this.beta[arm] += (1 - reward);
        }

        // Serialize for persistence
        toJSON() {
            return {
                alpha: this.alpha,
                beta: this.beta,
                pulls: this.pulls,
                totalPulls: this.totalPulls,
                rewards: this.rewards
            };
        }

        // Restore from saved state
        fromJSON(data) {
            if (data.alpha) this.alpha = data.alpha;
            if (data.beta) this.beta = data.beta;
            if (data.pulls) this.pulls = data.pulls;
            if (data.totalPulls) this.totalPulls = data.totalPulls;
            if (data.rewards) this.rewards = data.rewards;
            return this;
        }
    }

    // ========================================
    // Game State
    // ========================================
    class GameState {
        constructor(options = {}) {
            this.userEmotion = options.userEmotion || 'neutral'; // positive, neutral, negative
            this.engagementLevel = options.engagementLevel || 0.5; // 0-1
            this.turnCount = options.turnCount || 0;
            this.lastStrategy = options.lastStrategy || null;
            this.topicCategory = options.topicCategory || 'general';
        }

        // Discretize state for Q-table
        discretize() {
            const emotionMap = { positive: 0, neutral: 1, negative: 2 };
            const emotionIdx = emotionMap[this.userEmotion] || 1;

            const engagementIdx = this.engagementLevel < 0.33 ? 0 :
                                  this.engagementLevel < 0.66 ? 1 : 2;

            const turnIdx = Math.min(Math.floor(this.turnCount / 3), 3); // 0-3

            return `${emotionIdx}_${engagementIdx}_${turnIdx}`;
        }

        // Feature vector for more complex models
        toFeatures() {
            return {
                emotionPositive: this.userEmotion === 'positive' ? 1 : 0,
                emotionNegative: this.userEmotion === 'negative' ? 1 : 0,
                engagement: this.engagementLevel,
                turnNormalized: Math.min(this.turnCount / 10, 1),
                lastStrategyIdx: this.lastStrategy ? STRATEGY_MAP[this.lastStrategy] : -1
            };
        }

        clone() {
            return new GameState({
                userEmotion: this.userEmotion,
                engagementLevel: this.engagementLevel,
                turnCount: this.turnCount,
                lastStrategy: this.lastStrategy,
                topicCategory: this.topicCategory
            });
        }
    }

    // ========================================
    // Conversation MDP (Q-Learning)
    // ========================================
    class ConversationMDP {
        constructor(options = {}) {
            this.alpha = options.learningRate || 0.1;    // Learning rate
            this.gamma = options.discountFactor || 0.95; // Discount factor
            this.epsilon = options.epsilon || 0.2;       // Exploration rate
            this.epsilonDecay = options.epsilonDecay || 0.995;
            this.epsilonMin = options.epsilonMin || 0.01;

            this.numActions = STRATEGIES.length;
            this.qTable = {}; // State -> Action -> Q-value

            this.lastState = null;
            this.lastAction = null;
        }

        // Get Q-values for a state
        getQValues(stateKey) {
            if (!this.qTable[stateKey]) {
                // Optimistic initialization
                this.qTable[stateKey] = new Array(this.numActions).fill(0.5);
            }
            return this.qTable[stateKey];
        }

        // ε-greedy action selection
        selectAction(state) {
            const stateKey = state.discretize();
            const qValues = this.getQValues(stateKey);

            // Exploration
            if (Math.random() < this.epsilon) {
                return Math.floor(Math.random() * this.numActions);
            }

            // Exploitation
            return MathUtils.argmax(qValues);
        }

        // Get action scores (Q-values) for weighted combination
        getScores(state) {
            const stateKey = state.discretize();
            return this.getQValues(stateKey).slice();
        }

        // TD Update: Q(s,a) ← Q(s,a) + α[r + γ·maxQ(s',a') - Q(s,a)]
        update(prevState, action, reward, nextState) {
            const prevStateKey = prevState.discretize();
            const nextStateKey = nextState.discretize();

            const qValues = this.getQValues(prevStateKey);
            const nextQValues = this.getQValues(nextStateKey);
            const maxNextQ = Math.max(...nextQValues);

            // Bellman equation update
            const tdTarget = reward + this.gamma * maxNextQ;
            const tdError = tdTarget - qValues[action];
            qValues[action] += this.alpha * tdError;

            // Decay exploration rate
            this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
        }

        // Store transition for delayed update
        remember(state, action) {
            this.lastState = state.clone();
            this.lastAction = action;
        }

        // Apply delayed update with received reward
        applyReward(reward, nextState) {
            if (this.lastState !== null && this.lastAction !== null) {
                this.update(this.lastState, this.lastAction, reward, nextState);
            }
        }

        // Serialize for persistence
        toJSON() {
            return {
                qTable: this.qTable,
                epsilon: this.epsilon
            };
        }

        fromJSON(data) {
            if (data.qTable) this.qTable = data.qTable;
            if (data.epsilon) this.epsilon = data.epsilon;
            return this;
        }
    }

    // ========================================
    // Bayesian User Model
    // ========================================
    class BayesianUserModel {
        constructor(options = {}) {
            // Beta distribution priors for each preference
            // Higher alpha/beta = more confidence, alpha/(alpha+beta) = expected value
            this.preferences = {
                empathetic: { alpha: 2, beta: 2 },   // Prior: 0.5, moderate confidence
                humorous: { alpha: 2, beta: 2 },
                questioning: { alpha: 1.5, beta: 2.5 }, // Prior: 0.375, slight negative
                informative: { alpha: 2, beta: 2 },
                casual: { alpha: 2.5, beta: 1.5 }       // Prior: 0.625, slight positive
            };

            this.observationCount = 0;
        }

        // Get preference score (expected value of Beta)
        getScore(strategy) {
            const pref = this.preferences[strategy];
            if (!pref) return 0.5;
            return pref.alpha / (pref.alpha + pref.beta);
        }

        // Get all scores
        getScores() {
            return STRATEGIES.map(s => this.getScore(s));
        }

        // Get confidence (inverse of variance)
        getConfidence(strategy) {
            const pref = this.preferences[strategy];
            if (!pref) return 0;
            const n = pref.alpha + pref.beta;
            // Variance of Beta = αβ / ((α+β)²(α+β+1))
            const variance = (pref.alpha * pref.beta) / (n * n * (n + 1));
            return 1 / (1 + variance * 10); // Normalize to 0-1
        }

        // Bayesian update with observation
        update(strategy, success) {
            if (!this.preferences[strategy]) return;

            const reward = typeof success === 'number' ? success : (success ? 1 : 0);

            // Beta-Bernoulli conjugate update
            this.preferences[strategy].alpha += reward;
            this.preferences[strategy].beta += (1 - reward);

            this.observationCount++;
        }

        // Get recommended strategy based on preferences
        recommend() {
            const scores = this.getScores();
            return STRATEGIES[MathUtils.argmax(scores)];
        }

        // Sample from posterior (for exploration)
        sample() {
            const samples = STRATEGIES.map(s => {
                const pref = this.preferences[s];
                return MathUtils.sampleBeta(pref.alpha, pref.beta);
            });
            return STRATEGIES[MathUtils.argmax(samples)];
        }

        toJSON() {
            return {
                preferences: this.preferences,
                observationCount: this.observationCount
            };
        }

        fromJSON(data) {
            if (data.preferences) this.preferences = data.preferences;
            if (data.observationCount) this.observationCount = data.observationCount;
            return this;
        }
    }

    // ========================================
    // Reward Estimator
    // ========================================
    class RewardEstimator {
        constructor(options = {}) {
            this.weights = {
                responseTime: options.responseTimeWeight || 0.15,
                responseLength: options.responseLengthWeight || 0.15,
                emotionPositivity: options.emotionWeight || 0.25,
                continuation: options.continuationWeight || 0.30,
                topicRelevance: options.topicWeight || 0.15
            };

            this.lastInteractionTime = null;
            this.lastTopic = null;

            // Adaptive weight learning
            this.weightHistory = [];
            this.rewardHistory = [];
        }

        // Start timing for response time measurement
        startTiming() {
            this.lastInteractionTime = Date.now();
        }

        // Calculate reward from user signals
        estimate(signals) {
            let reward = 0;

            // Response time: faster = better (max 30 seconds)
            if (signals.responseTime !== undefined) {
                const timeFactor = Math.max(0, 1 - signals.responseTime / 30000);
                reward += this.weights.responseTime * timeFactor;
            }

            // Response length: longer responses indicate engagement (normalize to ~80 chars)
            if (signals.responseLength !== undefined) {
                const lengthFactor = Math.min(1, signals.responseLength / 80);
                reward += this.weights.responseLength * lengthFactor;
            }

            // Emotion positivity: positive = good
            if (signals.emotion !== undefined) {
                const emotionMap = { positive: 1, neutral: 0.5, negative: 0.2 };
                const emotionFactor = emotionMap[signals.emotion] || 0.5;
                reward += this.weights.emotionPositivity * emotionFactor;
            }

            // Continuation: user continued conversation = success
            if (signals.continued !== undefined) {
                reward += this.weights.continuation * (signals.continued ? 1 : 0);
            }

            // Topic relevance: staying on topic
            if (signals.topicMatch !== undefined) {
                reward += this.weights.topicRelevance * (signals.topicMatch ? 1 : 0.3);
            }

            // Clamp to [0, 1]
            return Math.max(0, Math.min(1, reward));
        }

        // Quick estimate from just user response
        quickEstimate(userResponse, prevBotMessage) {
            const now = Date.now();
            const responseTime = this.lastInteractionTime ? now - this.lastInteractionTime : 5000;

            // Simple emotion detection
            const positiveWords = ['좋아', '감사', 'ㅋㅋ', '재밌', '웃겨', '고마워', '좋네', '멋져', '대박'];
            const negativeWords = ['싫어', '별로', '지루', '재미없', '그만', '몰라', '뭐야'];

            let emotion = 'neutral';
            const text = userResponse.toLowerCase();
            if (positiveWords.some(w => text.includes(w))) emotion = 'positive';
            else if (negativeWords.some(w => text.includes(w))) emotion = 'negative';

            return this.estimate({
                responseTime,
                responseLength: userResponse.length,
                emotion,
                continued: true,
                topicMatch: true
            });
        }

        toJSON() {
            return { weights: this.weights };
        }

        fromJSON(data) {
            if (data.weights) this.weights = { ...this.weights, ...data.weights };
            return this;
        }
    }

    // ========================================
    // Main Game Engine
    // ========================================
    class GameEngine {
        constructor(options = {}) {
            this.bandit = new MultiArmedBandit(options.bandit);
            this.mdp = new ConversationMDP(options.mdp);
            this.userModel = new BayesianUserModel(options.userModel);
            this.rewardEstimator = new RewardEstimator(options.reward);

            this.state = new GameState();

            // Combination weights
            this.combinationWeights = {
                bandit: options.banditWeight || 0.35,
                mdp: options.mdpWeight || 0.35,
                userModel: options.userModelWeight || 0.30
            };

            // Persistence
            this.storageKey = options.storageKey || 'simgame_state';
            this.autoSaveInterval = options.autoSaveInterval || 30000;
            this.autoSaveTimer = null;

            // Load saved state
            this.load();

            // Start auto-save
            if (typeof window !== 'undefined' && this.autoSaveInterval > 0) {
                this.startAutoSave();
            }
        }

        // Select best strategy for current state
        selectStrategy(candidates = null) {
            // Get scores from each component
            const banditScores = this.bandit.getScores();
            const mdpScores = this.mdp.getScores(this.state);
            const userScores = this.userModel.getScores();

            // Weighted combination
            const combinedScores = STRATEGIES.map((_, i) => {
                return this.combinationWeights.bandit * banditScores[i] +
                       this.combinationWeights.mdp * mdpScores[i] +
                       this.combinationWeights.userModel * userScores[i];
            });

            // If candidates provided, filter
            if (candidates && candidates.length > 0) {
                const candidateIndices = candidates.map(c => STRATEGY_MAP[c]).filter(i => i !== undefined);
                if (candidateIndices.length > 0) {
                    const filteredScores = candidateIndices.map(i => combinedScores[i]);
                    const bestIdx = MathUtils.argmax(filteredScores);
                    return candidates[bestIdx];
                }
            }

            // Select best overall
            const bestIdx = MathUtils.argmax(combinedScores);
            return STRATEGIES[bestIdx];
        }

        // Select from response candidates
        selectResponse(responses) {
            if (!responses || responses.length === 0) return null;
            if (responses.length === 1) return responses[0];

            // Get scores for each response based on its strategy
            const scores = responses.map(r => {
                const strategy = r.strategy || 'casual';
                const strategyIdx = STRATEGY_MAP[strategy] || 4;

                const banditScores = this.bandit.getScores();
                const mdpScores = this.mdp.getScores(this.state);
                const userScores = this.userModel.getScores();

                return this.combinationWeights.bandit * banditScores[strategyIdx] +
                       this.combinationWeights.mdp * mdpScores[strategyIdx] +
                       this.combinationWeights.userModel * userScores[strategyIdx];
            });

            // Probabilistic selection with softmax
            const probs = MathUtils.softmax(scores, 0.5);
            return MathUtils.weightedChoice(responses, probs);
        }

        // Update state after user message
        updateState(userMessage, emotion = 'neutral') {
            this.state.turnCount++;
            this.state.userEmotion = emotion;

            // Update engagement based on message characteristics
            const engagement = Math.min(1, userMessage.length / 50) * 0.5 + 0.5;
            this.state.engagementLevel = 0.7 * this.state.engagementLevel + 0.3 * engagement;
        }

        // Process feedback after bot response
        processFeedback(strategy, userResponse = null) {
            const strategyIdx = STRATEGY_MAP[strategy];
            if (strategyIdx === undefined) return;

            // Remember for MDP update
            this.mdp.remember(this.state, strategyIdx);
            this.state.lastStrategy = strategy;

            // If user responded, calculate reward
            if (userResponse) {
                const reward = this.rewardEstimator.quickEstimate(userResponse, '');

                // Update all components
                this.bandit.update(strategyIdx, reward);
                this.userModel.update(strategy, reward);

                // Update MDP with next state
                const nextState = this.state.clone();
                this.mdp.applyReward(reward, nextState);
            }

            this.rewardEstimator.startTiming();
        }

        // Manual reward update (for explicit feedback)
        applyReward(strategy, reward) {
            const strategyIdx = STRATEGY_MAP[strategy];
            if (strategyIdx === undefined) return;

            this.bandit.update(strategyIdx, reward);
            this.userModel.update(strategy, reward);

            const nextState = this.state.clone();
            this.mdp.applyReward(reward, nextState);
        }

        // Get statistics
        getStats() {
            return {
                totalInteractions: this.bandit.totalPulls,
                strategyStats: STRATEGIES.map((s, i) => ({
                    strategy: s,
                    pulls: this.bandit.pulls[i],
                    avgReward: this.bandit.pulls[i] > 0 ?
                        this.bandit.rewards[i] / this.bandit.pulls[i] : 0,
                    userPreference: this.userModel.getScore(s),
                    confidence: this.userModel.getConfidence(s)
                })),
                currentState: this.state,
                explorationRate: this.mdp.epsilon
            };
        }

        // Persistence methods
        save() {
            if (typeof localStorage === 'undefined') return false;

            try {
                const data = {
                    bandit: this.bandit.toJSON(),
                    mdp: this.mdp.toJSON(),
                    userModel: this.userModel.toJSON(),
                    rewardEstimator: this.rewardEstimator.toJSON(),
                    state: {
                        turnCount: this.state.turnCount,
                        engagementLevel: this.state.engagementLevel
                    },
                    savedAt: Date.now()
                };
                localStorage.setItem(this.storageKey, JSON.stringify(data));
                return true;
            } catch (e) {
                console.warn('SimGame: Failed to save state', e);
                return false;
            }
        }

        load() {
            if (typeof localStorage === 'undefined') return false;

            try {
                const saved = localStorage.getItem(this.storageKey);
                if (!saved) return false;

                const data = JSON.parse(saved);

                if (data.bandit) this.bandit.fromJSON(data.bandit);
                if (data.mdp) this.mdp.fromJSON(data.mdp);
                if (data.userModel) this.userModel.fromJSON(data.userModel);
                if (data.rewardEstimator) this.rewardEstimator.fromJSON(data.rewardEstimator);
                if (data.state) {
                    this.state.turnCount = data.state.turnCount || 0;
                    this.state.engagementLevel = data.state.engagementLevel || 0.5;
                }

                console.log('SimGame: Loaded saved state from', new Date(data.savedAt));
                return true;
            } catch (e) {
                console.warn('SimGame: Failed to load state', e);
                return false;
            }
        }

        reset() {
            this.bandit = new MultiArmedBandit();
            this.mdp = new ConversationMDP();
            this.userModel = new BayesianUserModel();
            this.rewardEstimator = new RewardEstimator();
            this.state = new GameState();

            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(this.storageKey);
            }
        }

        startAutoSave() {
            if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = setInterval(() => this.save(), this.autoSaveInterval);
        }

        stopAutoSave() {
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = null;
            }
        }

        destroy() {
            this.stopAutoSave();
            this.save();
        }
    }

    // ========================================
    // Factory Function
    // ========================================
    function create(options = {}) {
        return new GameEngine(options);
    }

    // ========================================
    // Public API
    // ========================================
    return {
        /** @type {string} Library version */
        version: '1.1.0',

        // Factory function
        create,

        // Classes
        GameEngine,
        MultiArmedBandit,
        ConversationMDP,
        BayesianUserModel,
        RewardEstimator,
        GameState,

        // Constants
        STRATEGIES,
        STRATEGY_MAP,

        // Utilities
        MathUtils
    };
}));
