/**
 * Emotion detection for Korean chat
 */

export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'loving' | 'worried' | 'excited';

export interface EmotionResult {
  emotion: Emotion;
  confidence: number;
  scores: Record<Emotion, number>;
}

/**
 * Emotion detector using keyword matching
 */
export class EmotionDetector {
  readonly emotions: Emotion[] = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'loving', 'worried', 'excited'];

  private keywords: Record<Emotion, string[]> = {
    happy: ['좋아', '행복', '기뻐', '신나', '즐거', '웃', '최고', '대박', '굿', '짱', 'ㅋㅋ', 'ㅎㅎ', '감사', '고마'],
    sad: ['슬퍼', '슬프', '우울', '힘들', '아파', '눈물', '울', '외로', 'ㅠㅠ', 'ㅜㅜ', '미안', '죄송', '그리워', '보고싶', '속상'],
    angry: ['화나', '짜증', '싫어', '열받', '빡', '분노', '미워', 'ㅡㅡ', '-_-', '최악', '별로'],
    surprised: ['놀라', '깜짝', '헐', '대박', '뭐야', '진짜', '실화', 'ㅇㅁㅇ', 'ㄷㄷ', '와', '우와', '헉'],
    loving: ['사랑', '좋아해', '사랑해', '♡', '♥', '애정', '설레', '두근', '귀여', '깜찍'],
    worried: ['걱정', '불안', '두려', '무서', '겁나', '초조', '어떡', '어쩌', '고민', '모르겠'],
    excited: ['기대', '설레', '신나', '두근', '드디어', '빨리', '얼른', '재밌', '흥미'],
    neutral: []
  };

  private intensifiers = ['너무', '진짜', '완전', '엄청', '매우', '정말', '아주', '겁나', '개'];

  private keywordIndex: Map<string, Emotion[]>;

  constructor() {
    this.keywordIndex = new Map();
    for (const [emotion, words] of Object.entries(this.keywords)) {
      for (const word of words) {
        if (!this.keywordIndex.has(word)) {
          this.keywordIndex.set(word, []);
        }
        this.keywordIndex.get(word)!.push(emotion as Emotion);
      }
    }
  }

  /** Detect emotion from text */
  detect(text: string): EmotionResult {
    const lowerText = text.toLowerCase();
    const scores = {} as Record<Emotion, number>;
    for (const emotion of this.emotions) {
      scores[emotion] = 0;
    }

    // Check intensifiers
    let intensity = 1.0;
    for (const mod of this.intensifiers) {
      if (lowerText.includes(mod)) {
        intensity = 1.5;
        break;
      }
    }

    // Keyword matching
    for (const [word, emotions] of this.keywordIndex) {
      if (lowerText.includes(word)) {
        for (const emotion of emotions) {
          scores[emotion] += intensity;
        }
      }
    }

    // Emoticon detection
    this._detectEmoticons(lowerText, scores);
    this._detectRepetition(lowerText, scores);

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return { emotion: 'neutral', confidence: 0.5, scores };
    }

    let maxEmotion: Emotion = 'neutral';
    let maxScore = 0;
    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as Emotion;
      }
    }

    const confidence = Math.min(maxScore / (total + 1), 1.0);
    return { emotion: maxEmotion, confidence, scores };
  }

  private _detectEmoticons(text: string, scores: Record<Emotion, number>): void {
    if (/[ㅋ]{2,}|[ㅎ]{2,}|:\)|:D|😊|😄/.test(text)) scores.happy += 1.5;
    if (/[ㅠㅜ]{2,}|:\(|😢|😭/.test(text)) scores.sad += 1.5;
    if (/[♡♥❤💕💖]/.test(text)) scores.loving += 2;
    if (/[ㅡ]{2,}|-_-|😠|😡/.test(text)) scores.angry += 1.5;
    if (/[ㅇㅁ]{2,}|ㄷㄷ|😮|😲/.test(text)) scores.surprised += 1.5;
  }

  private _detectRepetition(text: string, scores: Record<Emotion, number>): void {
    const kMatches = text.match(/ㅋ+/g);
    if (kMatches) {
      for (const k of kMatches) {
        if (k.length >= 3) scores.happy += k.length * 0.3;
      }
    }
    const cryMatches = text.match(/[ㅠㅜ]+/g);
    if (cryMatches) {
      for (const c of cryMatches) {
        if (c.length >= 2) scores.sad += c.length * 0.3;
      }
    }
  }

  /** Get appropriate response emotion */
  getResponseEmotion(inputEmotion: Emotion): Emotion {
    const map: Record<Emotion, Emotion> = {
      happy: 'happy',
      sad: 'loving',
      angry: 'worried',
      surprised: 'excited',
      loving: 'loving',
      worried: 'loving',
      excited: 'excited',
      neutral: 'happy'
    };
    return map[inputEmotion] || 'happy';
  }

  /** Get emoji for emotion */
  getEmoji(emotion: Emotion): string {
    const map: Record<Emotion, string[]> = {
      happy: ['😊', '😄', '🥰', '✨'],
      sad: ['🥺', '😢', '💧'],
      angry: ['😤', '💢'],
      surprised: ['😮', '😲', '❗'],
      loving: ['💕', '💖', '🥰', '♡'],
      worried: ['😰', '🤔', '💦'],
      excited: ['🎉', '✨', '🔥'],
      neutral: ['😊', '✨']
    };
    const emojis = map[emotion] || map.neutral;
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
}
