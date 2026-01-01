/**
 * SimI18n - Internationalization Library
 * @version 1.0.0
 *
 * Multi-language support for SimChat with Korean and English.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimI18n = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ========================================
    // Language Definitions
    // ========================================
    const LANGUAGES = {
        ko: {
            code: 'ko',
            name: '한국어',
            nativeName: '한국어',
            speechCode: 'ko-KR',
            direction: 'ltr'
        },
        en: {
            code: 'en',
            name: 'English',
            nativeName: 'English',
            speechCode: 'en-US',
            direction: 'ltr'
        }
    };

    // ========================================
    // UI Translations
    // ========================================
    const TRANSLATIONS = {
        ko: {
            // App
            appTitle: '심이',
            appSubtitle: 'AI 캐릭터 챗봇',
            appDescription: '심이와 대화해보세요!',

            // Chat
            inputPlaceholder: '심이에게 말해보세요...',
            sendButton: '전송',
            clearChat: '대화 지우기',
            clearChatConfirm: '대화 내용을 모두 지울까요?',

            // Settings
            settings: '설정',
            voiceOutput: '음성 출력',
            voiceSelect: '음성 선택',
            soundEffects: '효과음',
            hapticFeedback: '진동 피드백',
            language: '언어',
            theme: '테마',
            darkTheme: '다크',
            lightTheme: '라이트',

            // Voice
            voiceNotSupported: '이 브라우저에서는 음성 인식이 지원되지 않아요.',
            listening: '듣고 있어요...',
            voiceError: '음성 인식 중 오류가 발생했어요.',

            // Status
            thinking: '음...',
            typing: '입력 중...',
            online: '온라인',
            offline: '오프라인',

            // Errors
            errorGeneral: '앗, 잠깐 문제가 생겼어요...',
            errorNetwork: '네트워크 연결을 확인해주세요.',
            errorTimeout: '응답 시간이 초과되었어요.',

            // Time
            justNow: '방금',
            minutesAgo: '{n}분 전',
            hoursAgo: '{n}시간 전',
            yesterday: '어제',

            // Greetings (time-based)
            greetingMorning: '좋은 아침이에요!',
            greetingAfternoon: '안녕하세요~!',
            greetingEvening: '좋은 저녁이에요~',
            greetingNight: '안녕하세요~',

            // Character
            characterName: '심이',
            characterMood: {
                happy: '기분 좋음',
                sad: '슬픔',
                excited: '신남',
                thinking: '생각 중',
                neutral: '평온'
            },

            // Notifications
            notificationTitle: '심이',
            notificationNewMessage: '새 메시지가 있어요!',

            // Accessibility
            a11yCharacter: '캐릭터 이미지',
            a11ySendMessage: '메시지 보내기',
            a11yVoiceInput: '음성으로 입력하기',
            a11ySettings: '설정 열기',
            a11yCloseSettings: '설정 닫기'
        },

        en: {
            // App
            appTitle: 'Simi',
            appSubtitle: 'AI Character Chatbot',
            appDescription: 'Chat with Simi!',

            // Chat
            inputPlaceholder: 'Say something to Simi...',
            sendButton: 'Send',
            clearChat: 'Clear chat',
            clearChatConfirm: 'Clear all messages?',

            // Settings
            settings: 'Settings',
            voiceOutput: 'Voice Output',
            voiceSelect: 'Voice',
            soundEffects: 'Sound Effects',
            hapticFeedback: 'Haptic Feedback',
            language: 'Language',
            theme: 'Theme',
            darkTheme: 'Dark',
            lightTheme: 'Light',

            // Voice
            voiceNotSupported: 'Speech recognition is not supported in this browser.',
            listening: 'Listening...',
            voiceError: 'An error occurred during voice recognition.',

            // Status
            thinking: 'Hmm...',
            typing: 'Typing...',
            online: 'Online',
            offline: 'Offline',

            // Errors
            errorGeneral: 'Oops, something went wrong...',
            errorNetwork: 'Please check your network connection.',
            errorTimeout: 'Response timed out.',

            // Time
            justNow: 'Just now',
            minutesAgo: '{n}m ago',
            hoursAgo: '{n}h ago',
            yesterday: 'Yesterday',

            // Greetings (time-based)
            greetingMorning: 'Good morning!',
            greetingAfternoon: 'Hello~!',
            greetingEvening: 'Good evening~',
            greetingNight: 'Hello~',

            // Character
            characterName: 'Simi',
            characterMood: {
                happy: 'Happy',
                sad: 'Sad',
                excited: 'Excited',
                thinking: 'Thinking',
                neutral: 'Calm'
            },

            // Notifications
            notificationTitle: 'Simi',
            notificationNewMessage: 'You have a new message!',

            // Accessibility
            a11yCharacter: 'Character image',
            a11ySendMessage: 'Send message',
            a11yVoiceInput: 'Voice input',
            a11ySettings: 'Open settings',
            a11yCloseSettings: 'Close settings'
        }
    };

    // ========================================
    // I18n Manager
    // ========================================
    class I18nManager {
        constructor(options = {}) {
            this.currentLanguage = options.defaultLanguage || this._detectLanguage();
            this.fallbackLanguage = options.fallbackLanguage || 'en';
            this.translations = { ...TRANSLATIONS };
            this.listeners = [];

            // Load saved preference
            this._loadPreference();
        }

        _detectLanguage() {
            // Check navigator language
            const navLang = navigator.language || navigator.userLanguage;
            const langCode = navLang?.split('-')[0] || 'en';

            // Return if supported, otherwise fallback
            return LANGUAGES[langCode] ? langCode : 'en';
        }

        _loadPreference() {
            try {
                const saved = localStorage.getItem('simi_language');
                if (saved && LANGUAGES[saved]) {
                    this.currentLanguage = saved;
                }
            } catch (e) {
                // localStorage not available
            }
        }

        _savePreference() {
            try {
                localStorage.setItem('simi_language', this.currentLanguage);
            } catch (e) {
                // localStorage not available
            }
        }

        // Get current language info
        getLanguage() {
            return LANGUAGES[this.currentLanguage] || LANGUAGES[this.fallbackLanguage];
        }

        // Get all supported languages
        getLanguages() {
            return Object.values(LANGUAGES);
        }

        // Set language
        setLanguage(langCode) {
            if (!LANGUAGES[langCode]) {
                console.warn(`Language '${langCode}' not supported`);
                return false;
            }

            const oldLang = this.currentLanguage;
            this.currentLanguage = langCode;
            this._savePreference();

            // Update document
            document.documentElement.lang = langCode;
            document.documentElement.dir = LANGUAGES[langCode].direction;

            // Notify listeners
            this.listeners.forEach(fn => fn(langCode, oldLang));

            return true;
        }

        // Toggle between languages
        toggleLanguage() {
            const langs = Object.keys(LANGUAGES);
            const currentIdx = langs.indexOf(this.currentLanguage);
            const nextIdx = (currentIdx + 1) % langs.length;
            this.setLanguage(langs[nextIdx]);
            return langs[nextIdx];
        }

        // Get translation
        t(key, params = {}) {
            const keys = key.split('.');
            let value = this.translations[this.currentLanguage];

            for (const k of keys) {
                if (value && typeof value === 'object') {
                    value = value[k];
                } else {
                    value = undefined;
                    break;
                }
            }

            // Fallback
            if (value === undefined) {
                value = this.translations[this.fallbackLanguage];
                for (const k of keys) {
                    if (value && typeof value === 'object') {
                        value = value[k];
                    } else {
                        value = key;
                        break;
                    }
                }
            }

            // Replace placeholders
            if (typeof value === 'string' && Object.keys(params).length > 0) {
                for (const [param, val] of Object.entries(params)) {
                    value = value.replace(new RegExp(`\\{${param}\\}`, 'g'), val);
                }
            }

            return value;
        }

        // Add custom translations
        extend(langCode, translations) {
            if (!this.translations[langCode]) {
                this.translations[langCode] = {};
            }
            this.translations[langCode] = {
                ...this.translations[langCode],
                ...translations
            };
        }

        // Listen for language changes
        onChange(callback) {
            this.listeners.push(callback);
            return () => {
                const idx = this.listeners.indexOf(callback);
                if (idx > -1) this.listeners.splice(idx, 1);
            };
        }

        // Get time-based greeting
        getGreeting() {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) return this.t('greetingMorning');
            if (hour >= 12 && hour < 18) return this.t('greetingAfternoon');
            if (hour >= 18 && hour < 22) return this.t('greetingEvening');
            return this.t('greetingNight');
        }

        // Format relative time
        formatRelativeTime(date) {
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);

            if (minutes < 1) return this.t('justNow');
            if (minutes < 60) return this.t('minutesAgo', { n: minutes });
            if (hours < 24) return this.t('hoursAgo', { n: hours });

            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) {
                return this.t('yesterday');
            }

            return date.toLocaleDateString(this.getLanguage().speechCode);
        }

        // Speech code for TTS/STT
        getSpeechCode() {
            return this.getLanguage().speechCode;
        }

        // Character name based on language
        getCharacterName() {
            return this.t('characterName');
        }
    }

    // ========================================
    // Response Data URLs by Language
    // ========================================
    const RESPONSE_URLS = {
        ko: 'data/responses/responses.json',
        en: 'data/responses/responses_en.json'
    };

    // ========================================
    // Public API
    // ========================================
    const instance = new I18nManager();

    return {
        version: '1.0.0',

        // Main instance
        instance,

        // Shorthand methods
        t: (key, params) => instance.t(key, params),
        setLanguage: (lang) => instance.setLanguage(lang),
        getLanguage: () => instance.getLanguage(),
        getLanguages: () => instance.getLanguages(),
        toggleLanguage: () => instance.toggleLanguage(),
        onChange: (cb) => instance.onChange(cb),
        getSpeechCode: () => instance.getSpeechCode(),
        getGreeting: () => instance.getGreeting(),

        // Create new instance
        create: (options) => new I18nManager(options),

        // Response URL helper
        getResponseUrl: (lang) => RESPONSE_URLS[lang || instance.currentLanguage] || RESPONSE_URLS.en,

        // Languages and translations
        LANGUAGES,
        TRANSLATIONS,
        RESPONSE_URLS
    };
}));
