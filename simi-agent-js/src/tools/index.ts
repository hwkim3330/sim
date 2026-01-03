/**
 * Tool System - File, Shell, Grep tools
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'fs/promises';
import path from 'path';
import type { Tool, ToolResult, ToolSchema } from '../types.js';

const execAsync = promisify(exec);

// ============================================================================
// Read File Tool
// ============================================================================

export class ReadFileTool implements Tool {
  name = 'read_file';
  description = 'Read the contents of a file';
  parameters = [
    {
      name: 'path',
      type: 'string' as const,
      description: 'Path to the file to read',
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = args.path as string;
      const content = await readFile(filePath, 'utf-8');
      return { success: true, output: content };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Failed to read file: ${err}`,
      };
    }
  }
}

// ============================================================================
// Write File Tool
// ============================================================================

export class WriteFileTool implements Tool {
  name = 'write_file';
  description = 'Write content to a file';
  parameters = [
    {
      name: 'path',
      type: 'string' as const,
      description: 'Path to the file to write',
      required: true,
    },
    {
      name: 'content',
      type: 'string' as const,
      description: 'Content to write',
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = args.path as string;
      const content = args.content as string;
      await writeFile(filePath, content, 'utf-8');
      return { success: true, output: `Wrote ${content.length} bytes to ${filePath}` };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Failed to write file: ${err}`,
      };
    }
  }
}

// ============================================================================
// Shell Tool
// ============================================================================

export class ShellTool implements Tool {
  name = 'shell';
  description = 'Execute a shell command';
  parameters = [
    {
      name: 'command',
      type: 'string' as const,
      description: 'Shell command to execute',
      required: true,
    },
    {
      name: 'cwd',
      type: 'string' as const,
      description: 'Working directory (optional)',
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const command = args.command as string;
      const cwd = (args.cwd as string) || process.cwd();

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10,
      });

      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
      return { success: true, output };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message || String(err),
      };
    }
  }
}

// ============================================================================
// Glob Tool
// ============================================================================

export class GlobTool implements Tool {
  name = 'glob';
  description = 'Find files matching a glob pattern';
  parameters = [
    {
      name: 'pattern',
      type: 'string' as const,
      description: 'Glob pattern (e.g., "**/*.ts")',
      required: true,
    },
    {
      name: 'cwd',
      type: 'string' as const,
      description: 'Base directory',
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const pattern = args.pattern as string;
      const cwd = (args.cwd as string) || process.cwd();

      // Simple glob implementation using readdir
      const files = await this.globFiles(pattern, cwd);
      return { success: true, output: files.join('\n') };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Glob failed: ${err}`,
      };
    }
  }

  private async globFiles(pattern: string, cwd: string): Promise<string[]> {
    const results: string[] = [];
    const parts = pattern.split('/');

    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth >= parts.length) return;

      const part = parts[depth];
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (part === '**') {
          // Recursive
          if (entry.isDirectory()) {
            await walk(fullPath, depth);
            await walk(fullPath, depth + 1);
          } else if (depth === parts.length - 1 || this.matchPart(entry.name, parts[depth + 1])) {
            results.push(fullPath);
          }
        } else if (this.matchPart(entry.name, part)) {
          if (depth === parts.length - 1) {
            results.push(fullPath);
          } else if (entry.isDirectory()) {
            await walk(fullPath, depth + 1);
          }
        }
      }
    };

    await walk(cwd, 0);
    return results;
  }

  private matchPart(name: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );
    return regex.test(name);
  }
}

// ============================================================================
// Grep Tool
// ============================================================================

export class GrepTool implements Tool {
  name = 'grep';
  description = 'Search for a pattern in files';
  parameters = [
    {
      name: 'pattern',
      type: 'string' as const,
      description: 'Regex pattern to search for',
      required: true,
    },
    {
      name: 'path',
      type: 'string' as const,
      description: 'File or directory to search',
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const pattern = args.pattern as string;
      const searchPath = args.path as string;
      const regex = new RegExp(pattern, 'gm');

      const stats = await stat(searchPath);
      const results: string[] = [];

      if (stats.isFile()) {
        const content = await readFile(searchPath, 'utf-8');
        const matches = this.searchFile(searchPath, content, regex);
        results.push(...matches);
      } else if (stats.isDirectory()) {
        await this.searchDir(searchPath, regex, results);
      }

      return { success: true, output: results.join('\n') };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Grep failed: ${err}`,
      };
    }
  }

  private searchFile(filePath: string, content: string, regex: RegExp): string[] {
    const results: string[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        results.push(`${filePath}:${i + 1}:${lines[i]}`);
      }
    }

    return results;
  }

  private async searchDir(dir: string, regex: RegExp, results: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.searchDir(fullPath, regex, results);
      } else if (entry.isFile()) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const matches = this.searchFile(fullPath, content, regex);
          results.push(...matches);
        } catch {
          // Skip binary files
        }
      }
    }
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerDefaults(): void {
    this.register(new ReadFileTool());
    this.register(new WriteFileTool());
    this.register(new ShellTool());
    this.register(new GlobTool());
    this.register(new GrepTool());
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
    return tool.execute(args);
  }
}

export const defaultTools = [
  new ReadFileTool(),
  new WriteFileTool(),
  new ShellTool(),
  new GlobTool(),
  new GrepTool(),
];
