# Simi Agent

An AI coding assistant powered by OpenVINO, similar to Claude Code.

## Features

- **Vision-Language Model**: Analyze screenshots, images, and code
- **Tool Use**: File operations, shell commands, web access
- **ReAct Loop**: Reasoning + Acting for complex tasks
- **Streaming Output**: Real-time response generation
- **Cross-Platform**: Windows, Linux, macOS support

## Requirements

- OpenVINO 2025.x or later
- CMake 3.16+
- C++17 compiler
- Python 3.10+ (for model download)

## Quick Start

### 1. Install OpenVINO

**Windows:**
```powershell
# Download from https://www.intel.com/openvino
# Or use pip:
pip install openvino openvino-genai
```

**Linux:**
```bash
pip install openvino openvino-genai
# Or from APT:
# https://docs.openvino.ai/latest/openvino_docs_install_guides_installing_openvino_apt.html
```

### 2. Download Model

```bash
# Install dependencies
pip install optimum[openvino] transformers torch

# Download Qwen2.5-VL-3B (recommended)
python scripts/download_model.py --model qwen2.5-vl-3b

# Or other models:
python scripts/download_model.py --list
```

### 3. Build

```bash
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

### 4. Run

```bash
./simi -m models/qwen2.5-vl-3b-instruct
```

## Usage

```
simi [options]

Options:
  -m, --model <path>    Path to VLM model directory
  -d, --device <dev>    Device: CPU, GPU, NPU, AUTO (default: CPU)
  -v, --verbose         Enable verbose output
  -h, --help            Show help

Commands (in chat):
  /help       Show help
  /clear      Clear conversation
  /image <path>  Attach image
  /history    Show history
  /exit       Exit
```

## Examples

### Basic Chat
```
You: Hello! What can you do?
Simi: I'm Simi, an AI coding assistant. I can help you with:
- Reading and writing code files
- Executing shell commands
- Analyzing screenshots
- Searching code
...
```

### Analyze Screenshot
```
You: /image screenshot.png
You: What's the error in this screenshot?
Simi: I can see a TypeScript error in the screenshot...
```

### Code Task
```
You: Create a simple HTTP server in Python
Simi: I'll create a simple HTTP server for you.
<tool_call>
name: write_file
arguments:
  file_path: server.py
  content: ...
</tool_call>
```

## Architecture

```
agent/
├── include/simi/
│   ├── types.hpp       # Core types
│   ├── vlm_engine.hpp  # VLM wrapper
│   ├── tools.hpp       # Tool definitions
│   ├── agent.hpp       # Agent implementation
│   └── simi.hpp        # Main header
├── src/
│   ├── core/           # Core implementations
│   ├── tools/          # Tool implementations
│   ├── utils/          # Utilities
│   └── main.cpp        # CLI entry point
└── scripts/
    └── download_model.py
```

## Supported Models

| Model | Size | Best For |
|-------|------|----------|
| Qwen2.5-VL-3B | ~3GB | General use (recommended) |
| Qwen2.5-VL-7B | ~7GB | Higher quality |
| Phi-3.5-vision | ~4GB | Long context |
| MiniCPM-V-2.6 | ~3GB | Compact & efficient |

## API Usage (C++)

```cpp
#include <simi/simi.hpp>

int main() {
    // Create agent
    auto agent = simi::AgentBuilder()
        .with_vlm("models/qwen2.5-vl-3b-instruct")
        .with_device(simi::VLMEngine::Device::CPU)
        .with_default_tools()
        .build();

    // Simple chat
    std::string response = agent->process("Hello!");
    std::cout << response << std::endl;

    // With image
    response = agent->process(
        "What's in this image?",
        {"screenshot.png"}
    );

    // Streaming
    agent->process_stream(
        "Write a function to sort an array",
        {},
        [](const std::string& token) {
            std::cout << token << std::flush;
        }
    );

    return 0;
}
```

## License

MIT License
