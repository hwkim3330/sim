/**
 * Personality engine for response modification
 */

import { Emotion } from './emotion';

export interface PersonalityTraits {
  cuteness: number;
  friendliness: number;
  empathy: number;
  playfulness: number;
  politeness: number;
}

export interface PersonalityOptions {
  name?: string;
  cuteness?: number;
  friendliness?: number;
  empathy?: number;
  playfulness?: number;
  politeness?: number;
}

/**
 * Personality engine for Korean speech patterns
 */
export class Personality {
  readonly name: string;
  readonly traits: PersonalityTraits;

  private endings = {
    statement: ['요~', '에요!', '어요~', '이에요!', '네요!'],
    question: ['요?', '까요?', '나요?', '에요?'],
    exclamation: ['요!!', '에요!!', '네요!!'],
    soft: ['요...', '어요...', '네요...']
  };

  private emoticons: Record<Emotion, string[]> = {
    happy: ['>_<', '^_^', '♡', '✨'],
    sad: ['ㅠㅠ', 'ㅜㅜ', '💧'],
    angry: ['ㅡㅡ', '💢'],
    surprised: ['ㅇㅁㅇ', 'ㄷㄷ', '⁉️'],
    loving: ['♡', '♥', '💕'],
    worried: ['ㅠ', '💦'],
    excited: ['!!', '✨✨', '🔥'],
    neutral: ['^_^', '✨']
  };

  private expressions: Record<string, string[]> = {
    happy: ['헤헤', '히히', 'ㅎㅎ'],
    surprised: ['앗', '어머', '헐', '오오'],
    thinking: ['음...', '글쎄요...'],
    agreement: ['네네!', '맞아요!'],
    sympathy: ['아...', '그랬구나...', '힘들었겠다...']
  };

  constructor(options: PersonalityOptions = {}) {
    this.name = options.name || '심이';
    this.traits = {
      cuteness: options.cuteness ?? 0.9,
      friendliness: options.friendliness ?? 0.85,
      empathy: options.empathy ?? 0.8,
      playfulness: options.playfulness ?? 0.7,
      politeness: options.politeness ?? 0.9
    };
  }

  /** Apply personality to response */
  apply(response: string, emotion: Emotion = 'neutral'): string {
    let modified = response;
    modified = this._adjustEnding(modified, emotion);

    if (Math.random() < this.traits.playfulness) {
      modified = this._addExpression(modified, emotion);
    }

    if (Math.random() < this.traits.cuteness * 0.6) {
      modified = this._addEmoticon(modified, emotion);
    }

    return modified;
  }

  private _adjustEnding(text: string, emotion: Emotion): string {
    const base = text.replace(/[.!?~]+$/, '').trim();
    let endingType: keyof typeof this.endings = 'statement';

    if (emotion === 'happy' || emotion === 'excited') endingType = 'exclamation';
    else if (emotion === 'sad' || emotion === 'worried') endingType = 'soft';
    else if (text.includes('?')) endingType = 'question';

    if (/[요죠]$/.test(base)) {
      const endings = this.endings[endingType];
      return base + endings[Math.floor(Math.random() * endings.length)].replace(/^[요죠]/, '');
    }

    const endings = this.endings[endingType];
    return base + endings[Math.floor(Math.random() * endings.length)];
  }

  private _addExpression(text: string, emotion: Emotion): string {
    const expMap: Record<string, string[]> = {
      happy: this.expressions.happy,
      excited: this.expressions.happy,
      sad: this.expressions.sympathy,
      worried: this.expressions.sympathy,
      surprised: this.expressions.surprised,
      neutral: this.expressions.agreement
    };
    const exps = expMap[emotion] || this.expressions.agreement;
    const exp = exps[Math.floor(Math.random() * exps.length)];
    return Math.random() < 0.5 ? `${exp} ${text}` : `${text} ${exp}`;
  }

  private _addEmoticon(text: string, emotion: Emotion): string {
    const emoticons = this.emoticons[emotion] || this.emoticons.neutral;
    return `${text} ${emoticons[Math.floor(Math.random() * emoticons.length)]}`;
  }

  /** Get time-appropriate greeting */
  getGreeting(): string {
    const hour = new Date().getHours();
    let greeting: string;
    if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요!';
    else if (hour >= 12 && hour < 18) greeting = '안녕하세요~!';
    else if (hour >= 18 && hour < 22) greeting = '좋은 저녁이에요~';
    else greeting = '안녕하세요~';
    return this.apply(greeting, 'happy');
  }

  /** Get farewell message */
  getFarewell(): string {
    const farewells = ['다음에 또 놀러오세요', '잘가요', '또 봐요'];
    return this.apply(farewells[Math.floor(Math.random() * farewells.length)], 'loving');
  }

  /** Get introduction */
  introduce(): string {
    return this.apply(`안녕하세요! 저는 ${this.name}이에요. 심심할 때 같이 얘기해요`, 'happy');
  }

  /** Get empathetic response */
  getEmpathetic(emotion: Emotion): string {
    const responses: Partial<Record<Emotion, string[]>> = {
      sad: ['많이 힘드셨겠어요', '마음이 아프시겠어요', '제가 옆에 있을게요'],
      angry: ['화나셨겠어요', '속상하시겠네요'],
      worried: ['걱정되시겠어요', '다 잘 될 거예요'],
      happy: ['좋으셨겠다', '저도 기뻐요']
    };
    const pool = responses[emotion] || responses.happy!;
    return this.apply(pool[Math.floor(Math.random() * pool.length)], emotion === 'happy' ? 'happy' : 'loving');
  }
}
