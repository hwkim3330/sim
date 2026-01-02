# Simi Agent

A hybrid AI coding assistant that combines local VLM inference with Claude API.

## Features

- 🏠 **Local Inference** - OpenVINO-powered VLM for privacy and speed
- ☁️ **Cloud Fallback** - Claude API for complex tasks
- 🛠️ **Tool Use** - File ops, shell commands, screenshots, web fetch
- 👁️ **Vision** - Analyze images and screenshots
- 🔄 **ReAct Loop** - Reasoning + Acting for multi-step tasks
- 📡 **Streaming** - Real-time token output

## Installation

```bash
pip install simi-agent

# With all dependencies (for model download)
pip install simi-agent[all]
```

## Quick Start

### As CLI

```bash
# With Claude API
export ANTHROPIC_API_KEY=sk-...
simi

# With local model
simi -m models/qwen2.5-vl-3b

# Hybrid mode (both)
simi -m models/qwen2.5-vl-3b -k $ANTHROPIC_API_KEY
```

### As Library

```python
from simi import Agent, AgentConfig

# Simple usage with Claude
agent = Agent(AgentConfig(claude_api_key="sk-..."))
response = agent.run("Hello!")
print(response)

# With local VLM
agent = Agent(AgentConfig(vlm_model_path="models/qwen2.5-vl-3b"))

# Hybrid mode
agent = Agent(AgentConfig(
    vlm_model_path="models/qwen2.5-vl-3b",
    claude_api_key="sk-...",
    prefer_local=True,  # Use local first, API as fallback
))

# With image
response = agent.run(
    "What's in this screenshot?",
    images=["screenshot.png"]
)

# Streaming
for token in agent.stream("Write a function"):
    print(token, end="")
```

## Download Models

```bash
# Install dependencies
pip install optimum[openvino] transformers torch

# Download Qwen2.5-VL-3B (recommended)
optimum-cli export openvino \
    --model Qwen/Qwen2.5-VL-3B-Instruct \
    --weight-format int4 \
    --trust-remote-code \
    models/qwen2.5-vl-3b
```

## Available Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write content to file |
| `edit_file` | Search and replace in file |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `shell` | Execute shell commands |
| `screenshot` | Capture screenshots |
| `web_fetch` | Fetch URL content |

## Custom Tools

```python
from simi import Agent, AgentConfig, Tool, ToolParameter, ToolResult

class MyTool(Tool):
    name = "my_tool"
    description = "Does something custom"
    parameters = [
        ToolParameter("input", "string", "Input value", required=True)
    ]

    def execute(self, **kwargs) -> ToolResult:
        result = process(kwargs["input"])
        return ToolResult("", True, result)

agent = Agent(AgentConfig(
    claude_api_key="...",
    tools=[MyTool()]
))
```

## Architecture

```
simi/
├── agent.py         # Main Agent with ReAct loop
├── engines/
│   ├── base.py      # Engine interface
│   ├── vlm.py       # OpenVINO VLM
│   ├── claude.py    # Claude API
│   └── hybrid.py    # Smart routing
├── tools/
│   ├── base.py      # Tool interface
│   ├── file.py      # File operations
│   ├── shell.py     # Shell execution
│   ├── screen.py    # Screenshots
│   └── web.py       # Web fetch
├── types.py         # Type definitions
└── cli.py           # CLI interface
```

## Hybrid Mode

The hybrid engine intelligently routes between local and cloud:

- **Use Local** (fast, free, private):
  - Simple queries
  - Short context
  - Basic tool use

- **Use API** (powerful, paid):
  - Complex reasoning
  - Long context
  - Keywords like "analyze", "explain in detail"
  - When local fails

```python
# Force specific engine
engine = agent._engine
result = engine.force_local(messages)   # Always local
result = engine.force_api(messages)     # Always API
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help |
| `/clear` | Clear conversation |
| `/image <path>` | Attach image |
| `/history` | Show history |
| `/stats` | Show usage stats |
| `/exit` | Exit |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SIMI_MODEL_PATH` | Default model path |
| `SIMI_DEVICE` | Default device (CPU/GPU/NPU) |

## Requirements

- Python 3.10+
- OpenVINO 2024+ (for local inference)
- Anthropic API key (for cloud inference)

## License

MIT
