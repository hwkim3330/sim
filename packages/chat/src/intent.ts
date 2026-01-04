/**
 * Intent classification for Korean chat
 */

export type Intent =
  | 'greeting' | 'farewell' | 'question' | 'statement' | 'request'
  | 'emotion_share' | 'opinion' | 'humor' | 'compliment' | 'complaint'
  | 'gratitude' | 'apology' | 'personal_question' | 'unknown';

export interface IntentPatterns {
  startsWith?: string[];
  contains?: string[];
  endsWith?: string[];
}

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  scores: Record<Intent, number>;
}

/**
 * Intent classifier using pattern matching
 */
export class IntentClassifier {
  readonly intents: Intent[] = [
    'greeting', 'farewell', 'question', 'statement', 'request',
    'emotion_share', 'opinion', 'humor', 'compliment', 'complaint',
    'gratitude', 'apology', 'personal_question', 'unknown'
  ];

  private patterns: Record<string, IntentPatterns> = {
    greeting: {
      startsWith: ['안녕', '하이', '헬로', '반가', '좋은아침', '좋은저녁'],
      contains: ['오랜만', '처음뵙', '만나서반가'],
      endsWith: ['안녕', '하세요']
    },
    farewell: {
      startsWith: ['잘가', '바이', '안녕히', '다음에'],
      contains: ['나갈게', '들어갈게', '그만할게', '잘자'],
      endsWith: ['바이', '잘자', '잘가']
    },
    question: {
      contains: ['뭐야', '뭐지', '뭐에요', '뭘까', '어떻게', '왜', '언제', '어디', '누구', '몇'],
      endsWith: ['?', '까요', '나요', '가요', '어요', '아요', '죠']
    },
    request: {
      contains: ['해줘', '해주세요', '해줄래', '부탁', '해볼래', '할래'],
      endsWith: ['해줘', '해주세요', '해줄래요', '줘', '주세요', '줄래']
    },
    emotion_share: {
      contains: ['기분이', '느낌이', '마음이', '감정이', '슬퍼', '기뻐', '화나', '무서', '외로', '행복'],
      startsWith: ['나', '내가', '오늘']
    },
    humor: {
      contains: ['ㅋㅋㅋ', 'ㅎㅎㅎ', '웃겨', '장난', '농담', '재밌', '개그'],
      endsWith: ['ㅋㅋ', 'ㅎㅎ']
    },
    compliment: {
      contains: ['최고', '짱', '대단', '멋져', '예뻐', '이뻐', '잘했', '잘한다', '굿'],
      startsWith: ['와', '우와', '오']
    },
    complaint: {
      contains: ['싫어', '짜증', '화나', '별로', '왜이래', '이상해', '못해', '안돼'],
      endsWith: ['ㅡㅡ', '-_-']
    },
    gratitude: {
      contains: ['고마워', '감사', '땡큐', '쌩유', '고맙'],
      startsWith: ['감사', '고마워']
    },
    apology: {
      contains: ['미안', '죄송', '사과', '잘못'],
      startsWith: ['미안', '죄송']
    },
    personal_question: {
      contains: ['너는', '네가', '니가', '넌', '이름이', '몇살', '어디살', '좋아하', '싫어하'],
      startsWith: ['너', '넌', '니']
    }
  };

  private questionWords = ['뭐', '뭘', '왜', '어떻게', '언제', '어디', '누구', '누가', '몇', '얼마', '어느', '무슨'];

  /** Classify intent from text */
  classify(text: string): ClassificationResult {
    const normalized = text.trim().toLowerCase();
    const scores = {} as Record<Intent, number>;

    for (const intent of this.intents) {
      scores[intent] = 0;
    }

    // Pattern matching
    for (const [intent, patterns] of Object.entries(this.patterns)) {
      let score = 0;

      if (patterns.startsWith) {
        for (const p of patterns.startsWith) {
          if (normalized.startsWith(p)) score += 2;
        }
      }

      if (patterns.contains) {
        for (const p of patterns.contains) {
          if (normalized.includes(p)) score += 1.5;
        }
      }

      if (patterns.endsWith) {
        for (const p of patterns.endsWith) {
          if (normalized.endsWith(p)) score += 1.5;
        }
      }

      scores[intent as Intent] = score;
    }

    // Question detection
    if (normalized.includes('?')) scores.question += 2;
    for (const qw of this.questionWords) {
      if (normalized.includes(qw)) scores.question += 1;
    }

    // Default to statement for longer text
    if (normalized.length > 10 && Object.values(scores).every(s => s < 2)) {
      scores.statement += 1;
    }

    // Find max
    let maxIntent: Intent = 'unknown';
    let maxScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent as Intent;
      }
    }

    // Fallback for low confidence
    if (maxScore < 1.5) {
      maxIntent = normalized.endsWith('?') || /[까요나요가요]$/.test(normalized) ? 'question' : 'statement';
    }

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = total > 0 ? Math.min(maxScore / total, 1.0) : 0.3;

    return { intent: maxIntent, confidence, scores };
  }
}
