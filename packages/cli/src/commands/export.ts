/**
 * simi export - Export trained model
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const exportCommand = new Command('export')
  .description('Export Simi model and assets')
  .option('-o, --output <path>', 'Output directory', 'dist')
  .option('-f, --format <type>', 'Export format (json/bundle)', 'json')
  .option('-c, --config <path>', 'Config file path', 'simi.config.json')
  .option('--minify', 'Minify output')
  .action(async (options) => {
    const chalk = (await import('chalk')).default;
    const ora = (await import('ora')).default;

    console.log();
    console.log(chalk.cyan.bold('🎭 Simi Export'));
    console.log();

    const spinner = ora('Preparing export...').start();

    try {
      // Load config
      let config: Record<string, unknown> = { language: 'ko' };
      const configPath = path.resolve(process.cwd(), options.config);
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      const lang = (config.language as string) || 'ko';

      // Create output directory
      const outputDir = path.resolve(process.cwd(), options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      spinner.text = 'Collecting assets...';

      // Collect patterns
      const patternsPath = path.resolve(
        process.cwd(),
        'data',
        'patterns',
        `patterns_${lang}.json`
      );

      let patterns = { patterns: [] };
      if (fs.existsSync(patternsPath)) {
        patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      }

      // Collect model
      const modelPath = path.resolve(process.cwd(), 'models', 'model.json');
      let model = null;
      if (fs.existsSync(modelPath)) {
        model = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      }

      spinner.text = 'Generating export...';

      if (options.format === 'bundle') {
        // Create a bundled JavaScript file
        const bundle = `
/**
 * Simi Chatbot Bundle
 * Generated: ${new Date().toISOString()}
 */
(function(global) {
  'use strict';

  const config = ${JSON.stringify(config, null, options.minify ? 0 : 2)};
  const patterns = ${JSON.stringify(patterns.patterns, null, options.minify ? 0 : 2)};
  ${model ? `const model = ${JSON.stringify(model, null, options.minify ? 0 : 2)};` : 'const model = null;'}

  function findResponse(input) {
    const lowerInput = input.toLowerCase().trim();

    for (const pattern of patterns) {
      for (const trigger of pattern.triggers) {
        if (lowerInput.includes(trigger.toLowerCase())) {
          const responses = pattern.responses;
          return {
            response: responses[Math.floor(Math.random() * responses.length)],
            intent: pattern.intent || pattern.id,
            emotion: pattern.emotion || 'neutral'
          };
        }
      }
    }

    return {
      response: "I'm not sure how to respond.",
      intent: 'unknown',
      emotion: 'neutral'
    };
  }

  const Simi = {
    version: '1.0.0',
    config: config,
    patterns: patterns,
    model: model,
    chat: function(message) {
      return findResponse(message);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Simi;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return Simi; });
  } else {
    global.Simi = Simi;
  }
})(typeof self !== 'undefined' ? self : this);
`;

        const bundlePath = path.join(outputDir, 'simi.bundle.js');
        fs.writeFileSync(bundlePath, options.minify ? bundle.replace(/\s+/g, ' ') : bundle);

        spinner.succeed(chalk.green('Bundle exported!'));
        console.log();
        console.log(chalk.cyan('Export Summary:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`  Format:   JavaScript Bundle`);
        console.log(`  Output:   ${bundlePath}`);
        console.log(`  Patterns: ${patterns.patterns.length}`);
        console.log(`  Size:     ${(fs.statSync(bundlePath).size / 1024).toFixed(2)} KB`);

      } else {
        // JSON export
        const exportData = {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          config,
          patterns: patterns.patterns,
          model,
        };

        const jsonPath = path.join(outputDir, 'simi-export.json');
        fs.writeFileSync(
          jsonPath,
          JSON.stringify(exportData, null, options.minify ? 0 : 2)
        );

        spinner.succeed(chalk.green('JSON exported!'));
        console.log();
        console.log(chalk.cyan('Export Summary:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(`  Format:   JSON`);
        console.log(`  Output:   ${jsonPath}`);
        console.log(`  Patterns: ${patterns.patterns.length}`);
        console.log(`  Size:     ${(fs.statSync(jsonPath).size / 1024).toFixed(2)} KB`);
      }

      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Export failed'));
      console.error(error);
      process.exit(1);
    }
  });
