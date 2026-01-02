#!/usr/bin/env node

/**
 * @simi/cli
 * Simi Platform CLI - AI chatbot development toolkit
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { chatCommand } from './commands/chat';
import { trainCommand } from './commands/train';
import { serveCommand } from './commands/serve';
import { exportCommand } from './commands/export';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('simi')
  .description('Simi Platform CLI - AI Character Chatbot Development Toolkit')
  .version(VERSION, '-v, --version', 'Show version number')
  .option('--verbose', 'Enable verbose logging')
  .option('--no-color', 'Disable colored output');

// Add commands
program.addCommand(initCommand);
program.addCommand(chatCommand);
program.addCommand(trainCommand);
program.addCommand(serveCommand);
program.addCommand(exportCommand);

// Parse arguments
program.parse();
