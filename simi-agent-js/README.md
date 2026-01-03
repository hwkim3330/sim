# Simi Agent (JavaScript/Bun)

A lightweight AI coding agent powered by Claude API.

## Features

- 🚀 **Bun/Node.js** - Fast JavaScript runtime
- 🤖 **Claude API** - Powered by Anthropic's Claude
- 🛠️ **Tool Use** - File ops, shell, grep, glob
- 📡 **Streaming** - Real-time token output
- 🔄 **ReAct Loop** - Reasoning + Acting

## Installation

```bash
# Using bun
bun add simi-agent

# Using npm
npm install simi-agent
```

## Quick Start

### CLI

```bash
export ANTHROPIC_API_KEY=sk-...
bun run src/cli.ts

# Or after build
npx simi
```

### As Library

```typescript
import { Agent } from 'simi-agent';

const agent = new Agent({
  claudeApiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple usage
const response = await agent.run('Hello!');
console.log(response);

// With streaming
await agent.run('Write a function', {
  onStream: (token) => process.stdout.write(token),
  onTool: (call, result) => console.log(`[Tool: ${call.name}]`),
});
```

## Available Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write content to file |
| `shell` | Execute shell command |
| `glob` | Find files by pattern |
| `grep` | Search in files |

## Custom Tools

```typescript
import { Agent, Tool, ToolResult } from 'simi-agent';

const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something custom',
  parameters: [
    { name: 'input', type: 'string', description: 'Input value', required: true }
  ],
  async execute(args) {
    return { success: true, output: `Processed: ${args.input}` };
  }
};

const agent = new Agent({
  claudeApiKey: '...',
  tools: [myTool],
});
```

## Project Structure

```
simi-agent-js/
├── src/
│   ├── index.ts       # Main exports
│   ├── agent.ts       # Agent with ReAct loop
│   ├── types.ts       # TypeScript types
│   ├── cli.ts         # CLI interface
│   ├── engines/
│   │   └── claude.ts  # Claude API engine
│   └── tools/
│       └── index.ts   # Tool implementations
├── bin/
│   └── simi.js        # CLI entry
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
bun install

# Run CLI in dev mode
bun run dev

# Type check
bun run typecheck

# Build
bun run build
```

## Requirements

- Bun 1.0+ or Node.js 18+
- Anthropic API key

## Credits

- [klatt-syn](https://github.com/chdh/klatt-syn) - Klatt formant synthesizer
- [dsp-collection-js](https://github.com/chdh/dsp-collection-js) - DSP utilities

## License

MIT
