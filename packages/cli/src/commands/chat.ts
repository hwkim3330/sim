/**
 * simi chat - Interactive terminal chat
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface PatternData {
  id: string;
  triggers: string[];
  responses: string[];
  intent?: string;
  emotion?: string;
}

interface PatternsFile {
  patterns: PatternData[];
}

export const chatCommand = new Command('chat')
  .description('Start interactive chat in terminal')
  .option('-l, --lang <lang>', 'Language (ko/en)', 'ko')
  .option('-c, --config <path>', 'Config file path', 'simi.config.json')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;

    console.log();
    console.log(chalk.cyan.bold('🎭 Simi Interactive Chat'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation'));
    console.log(chalk.gray('-------------------------------------------'));
    console.log();

    // Load config
    let config = { name: 'Simi', language: options.lang };
    const configPath = path.resolve(process.cwd(), options.config);
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        // Use defaults
      }
    }

    // Load patterns
    let patterns: PatternData[] = [];
    const patternsPath = path.resolve(
      process.cwd(),
      'data',
      'patterns',
      `patterns_${config.language || options.lang}.json`
    );

    if (fs.existsSync(patternsPath)) {
      try {
        const data: PatternsFile = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        patterns = data.patterns || [];
      } catch (e) {
        // Use defaults
      }
    }

    // Default patterns if none loaded
    if (patterns.length === 0) {
      patterns = [
        {
          id: 'greeting',
          triggers: ['hello', 'hi', 'hey', '안녕', '하이'],
          responses: ['Hello!', 'Hi there!', '안녕하세요!'],
        },
        {
          id: 'farewell',
          triggers: ['bye', 'goodbye', '잘가', '바이'],
          responses: ['Goodbye!', 'See you!', '잘가요~'],
        },
        {
          id: 'default',
          triggers: [],
          responses: [
            "I'm not sure how to respond to that.",
            'Can you tell me more?',
            "That's interesting!",
            '음... 잘 모르겠어요',
            '더 말해주세요~',
          ],
        },
      ];
    }

    // Simple pattern matching
    function findResponse(input: string): string {
      const lowerInput = input.toLowerCase().trim();

      for (const pattern of patterns) {
        for (const trigger of pattern.triggers) {
          if (lowerInput.includes(trigger.toLowerCase())) {
            const responses = pattern.responses;
            return responses[Math.floor(Math.random() * responses.length)];
          }
        }
      }

      // Default response
      const defaultPattern = patterns.find(p => p.id === 'default');
      if (defaultPattern) {
        const responses = defaultPattern.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }

      return "I'm here to chat!";
    }

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const characterName = config.name || 'Simi';

    // Greeting
    const greetings = config.language === 'ko'
      ? ['안녕하세요! 심이예요~', '반가워요!', '무슨 이야기 할까요?']
      : ['Hello! I\'m Simi~', 'Nice to meet you!', 'What shall we talk about?'];
    console.log(chalk.green(`${characterName}: `) + greetings[Math.floor(Math.random() * greetings.length)]);
    console.log();

    // Chat loop
    const prompt = () => {
      rl.question(chalk.blue('You: '), (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        if (['exit', 'quit', '종료', '나가기'].includes(trimmed.toLowerCase())) {
          const farewells = config.language === 'ko'
            ? ['다음에 또 봐요!', '잘가요~']
            : ['Goodbye!', 'See you next time!'];
          console.log();
          console.log(chalk.green(`${characterName}: `) + farewells[Math.floor(Math.random() * farewells.length)]);
          console.log();
          rl.close();
          process.exit(0);
        }

        const response = findResponse(trimmed);
        console.log(chalk.green(`${characterName}: `) + response);
        console.log();

        prompt();
      });
    };

    prompt();
  });
