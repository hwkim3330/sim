/**
 * simi serve - Start development server
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

interface PatternData {
  id: string;
  triggers: string[];
  responses: string[];
  intent?: string;
}

export const serveCommand = new Command('serve')
  .description('Start the Simi development server')
  .option('-p, --port <number>', 'Server port', '3000')
  .option('-h, --host <host>', 'Server host', 'localhost')
  .option('-c, --config <path>', 'Config file path', 'simi.config.json')
  .option('--no-open', 'Do not open browser')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;
    const express = (await import('express')).default;

    console.log();
    console.log(chalk.cyan.bold('🎭 Simi Development Server'));
    console.log();

    const spinner = ora('Starting server...').start();

    try {
      // Load config
      let config: Record<string, unknown> = { language: 'ko' };
      const configPath = path.resolve(process.cwd(), options.config);
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      const lang = (config.language as string) || 'ko';

      // Load patterns
      let patterns: PatternData[] = [];
      const patternsPath = path.resolve(
        process.cwd(),
        'data',
        'patterns',
        `patterns_${lang}.json`
      );

      if (fs.existsSync(patternsPath)) {
        const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        patterns = data.patterns || [];
      }

      // Simple response function
      function getResponse(input: string): { response: string; intent: string; emotion: string } {
        const lowerInput = input.toLowerCase().trim();

        for (const pattern of patterns) {
          for (const trigger of pattern.triggers) {
            if (lowerInput.includes(trigger.toLowerCase())) {
              const responses = pattern.responses;
              return {
                response: responses[Math.floor(Math.random() * responses.length)],
                intent: pattern.intent || pattern.id,
                emotion: 'happy',
              };
            }
          }
        }

        return {
          response: lang === 'ko' ? '음, 잘 모르겠어요~' : "I'm not sure about that.",
          intent: 'unknown',
          emotion: 'neutral',
        };
      }

      // Create Express app
      const app = express();
      app.use(express.json());

      // Serve static files
      const publicPath = path.resolve(process.cwd(), 'public');
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
      }

      // Chat API endpoint
      app.post('/api/chat', (req, res) => {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
          res.status(400).json({ error: 'Message required' });
          return;
        }

        const result = getResponse(message);
        res.json(result);
      });

      // Health check
      app.get('/api/health', (_req, res) => {
        res.json({
          status: 'ok',
          version: '1.0.0',
          patterns: patterns.length,
        });
      });

      // Config endpoint
      app.get('/api/config', (_req, res) => {
        res.json({
          name: config.name || 'Simi',
          language: lang,
        });
      });

      // Patterns endpoint (for debugging)
      app.get('/api/patterns', (_req, res) => {
        res.json({ patterns });
      });

      // Start server
      const port = parseInt(options.port, 10);
      const host = options.host;

      app.listen(port, host, () => {
        spinner.succeed(chalk.green('Server started!'));

        console.log();
        console.log(chalk.cyan('Server Info:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`  Local:    http://${host}:${port}`);
        console.log(`  Network:  http://0.0.0.0:${port}`);
        console.log();
        console.log(chalk.cyan('API Endpoints:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`  POST /api/chat     Send chat message`);
        console.log(`  GET  /api/health   Health check`);
        console.log(`  GET  /api/config   Get configuration`);
        console.log(`  GET  /api/patterns Get patterns (debug)`);
        console.log();
        console.log(chalk.gray('Press Ctrl+C to stop the server'));
        console.log();
      });

    } catch (error) {
      spinner.fail(chalk.red('Failed to start server'));
      console.error(error);
      process.exit(1);
    }
  });
