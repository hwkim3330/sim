"""
Simi Agent - Hybrid AI Coding Assistant

A library for building AI coding assistants with local VLM and Claude API support.

Quick Start:
    >>> from simi import Agent, Config
    >>> agent = Agent(Config(vlm_model="models/qwen2.5-vl-3b"))
    >>> response = agent.run("Hello!")
    >>> print(response)

Features:
    - Local VLM inference with OpenVINO
    - Claude API fallback for complex tasks
    - Tool system for file operations, shell commands, etc.
    - ReAct-style reasoning loop
    - Streaming output support
    - Vision-language understanding
"""

from simi.agent import Agent, AgentConfig
from simi.types import (
    Message,
    Role,
    ToolCall,
    ToolResult,
    GenerationConfig,
    StreamCallback,
)
from simi.engines import (
    BaseEngine,
    VLMEngine,
    ClaudeEngine,
    HybridEngine,
)
from simi.tools import (
    Tool,
    ToolRegistry,
    ReadFile,
    WriteFile,
    EditFile,
    Shell,
    Grep,
    Glob,
    Screenshot,
    WebFetch,
)
from simi.tts import (
    TTS,
    Voice,
    KlattSynthesizer,
    save_wav,
    Audio,
)

__version__ = "1.0.0"
__all__ = [
    # Core
    "Agent",
    "AgentConfig",
    # Types
    "Message",
    "Role",
    "ToolCall",
    "ToolResult",
    "GenerationConfig",
    "StreamCallback",
    # Engines
    "BaseEngine",
    "VLMEngine",
    "ClaudeEngine",
    "HybridEngine",
    # Tools
    "Tool",
    "ToolRegistry",
    "ReadFile",
    "WriteFile",
    "EditFile",
    "Shell",
    "Grep",
    "Glob",
    "Screenshot",
    "WebFetch",
    # TTS
    "TTS",
    "Voice",
    "KlattSynthesizer",
    "save_wav",
    "Audio",
]
