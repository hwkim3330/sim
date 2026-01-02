"""
Inference engines for Simi Agent.

Provides multiple backends:
- VLMEngine: Local OpenVINO inference
- ClaudeEngine: Anthropic Claude API
- HybridEngine: Smart routing between local and API
"""

from simi.engines.base import BaseEngine
from simi.engines.vlm import VLMEngine
from simi.engines.claude import ClaudeEngine
from simi.engines.hybrid import HybridEngine

__all__ = [
    "BaseEngine",
    "VLMEngine",
    "ClaudeEngine",
    "HybridEngine",
]
