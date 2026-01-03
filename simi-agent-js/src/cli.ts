#!/usr/bin/env bun
/**
 * Simi Agent CLI
 */

import { createInterface } from 'readline';
import { Agent } from './agent.js';

const VERSION = '1.0.0';

const BANNER = `
\x1b[36m   _____ _           _    _                    _
  / ____(_)         (_)  / \\   __ _  ___ _ __ | |_
  \\___ \\ _ _ __ ___  _  / _ \\ / _\` |/ _ \\ '_ \\| __|
   ___) | | '_ \` _ \\| |/ ___ \\ (_| |  __/ | | | |_
  |____/|_| |_| |_| |_/_/   \\_\\__, |\\___|_| |_|\\__|
                               __/ |
                              |___/
\x1b[0m
\x1b[2m  AI Coding Assistant - v${VERSION}\x1b[0m
`;

const HELP = `
\x1b[36;1mCommands:\x1b[0m
  \x1b[1m/help\x1b[0m      Show this help
  \x1b[1m/clear\x1b[0m     Clear conversation
  \x1b[1m/history\x1b[0m   Show history
  \x1b[1m/exit\x1b[0m      Exit

\x1b[2mType a message and press Enter to chat.\x1b[0m
`;

async function main() {
  console.log(BANNER);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('\x1b[33mNo API key found.\x1b[0m');
    console.log('Set ANTHROPIC_API_KEY environment variable:');
    console.log('  \x1b[36mexport ANTHROPIC_API_KEY=sk-...\x1b[0m');
    process.exit(1);
  }

  let agent: Agent;
  try {
    console.log('\x1b[2mInitializing agent...\x1b[0m');
    agent = new Agent({ claudeApiKey: apiKey });
    console.log(`\x1b[32m✓ Agent ready\x1b[0m \x1b[2m(${agent.engineName})\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31mFailed to initialize: ${err}\x1b[0m`);
    process.exit(1);
  }

  console.log(HELP);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('\x1b[32mYou:\x1b[0m ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        const cmd = trimmed.toLowerCase();

        if (cmd === '/exit' || cmd === '/quit' || cmd === '/q') {
          console.log('\x1b[36mGoodbye!\x1b[0m');
          rl.close();
          process.exit(0);
        }

        if (cmd === '/help') {
          console.log(HELP);
          prompt();
          return;
        }

        if (cmd === '/clear') {
          agent.reset();
          console.log('\x1b[2mConversation cleared.\x1b[0m');
          prompt();
          return;
        }

        if (cmd === '/history') {
          const history = agent.getHistory();
          console.log('\x1b[2m--- History ---\x1b[0m');
          for (const msg of history) {
            const color = msg.role === 'user' ? '32' : '34';
            console.log(`\x1b[${color}m[${msg.role}]\x1b[0m ${msg.content.slice(0, 100)}...`);
          }
          console.log('\x1b[2m---------------\x1b[0m');
          prompt();
          return;
        }

        console.log(`\x1b[31mUnknown command: ${trimmed}\x1b[0m`);
        prompt();
        return;
      }

      // Process message
      process.stdout.write('\x1b[34;1mSimi:\x1b[0m ');

      try {
        await agent.run(trimmed, {
          onStream: (token) => process.stdout.write(token),
          onTool: (call, result) => {
            process.stdout.write(`\n\x1b[2m[Tool: ${call.name}]\x1b[0m`);
          },
        });
        console.log(); // Newline
      } catch (err) {
        console.log(`\n\x1b[31mError: ${err}\x1b[0m`);
      }

      prompt();
    });
  };

  // Handle Ctrl+C
  rl.on('close', () => {
    console.log('\n\x1b[36mGoodbye!\x1b[0m');
    process.exit(0);
  });

  prompt();
}

main().catch(console.error);
