"""
OpenVINO VLM Engine for local inference.
"""

from __future__ import annotations

import base64
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncIterator, Optional, Union
import asyncio

if TYPE_CHECKING:
    from simi.types import Message, GenerationConfig, ToolSchema

from simi.engines.base import BaseEngine


class VLMEngine(BaseEngine):
    """
    Local Vision-Language Model engine using OpenVINO GenAI.

    Supports models like:
    - Qwen2.5-VL
    - Phi-3-vision
    - LLaVA
    - MiniCPM-V

    Example:
        >>> engine = VLMEngine("models/qwen2.5-vl-3b")
        >>> response = engine.generate([Message.user("Hello!")])
    """

    def __init__(
        self,
        model_path: Union[str, Path],
        device: str = "CPU",
        *,
        enable_cache: bool = True,
        num_threads: int = 0,
    ):
        """
        Initialize VLM engine.

        Args:
            model_path: Path to OpenVINO model directory
            device: Device to run on ("CPU", "GPU", "NPU", "AUTO")
            enable_cache: Enable KV-cache for faster inference
            num_threads: Number of CPU threads (0 = auto)
        """
        self.model_path = Path(model_path)
        self.device = device
        self.enable_cache = enable_cache
        self.num_threads = num_threads

        self._pipeline: Any = None
        self._loaded = False

        # Load model
        self._load_model()

    def _load_model(self) -> None:
        """Load the OpenVINO model."""
        try:
            import openvino_genai as ov_genai

            self._pipeline = ov_genai.VLMPipeline(
                str(self.model_path),
                self.device
            )
            self._loaded = True

        except ImportError:
            raise ImportError(
                "OpenVINO GenAI not installed. "
                "Install with: pip install openvino-genai"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to load model: {e}")

    @property
    def name(self) -> str:
        return f"VLM({self.model_path.name})"

    @property
    def supports_vision(self) -> bool:
        return True

    @property
    def supports_tools(self) -> bool:
        # Tools are handled via prompt engineering
        return True

    @property
    def is_local(self) -> bool:
        return True

    def is_available(self) -> bool:
        return self._loaded

    def generate(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> str:
        """Generate response synchronously."""
        if not self._loaded:
            raise RuntimeError("Model not loaded")

        from simi.types import GenerationConfig as GenConfig
        config = config or GenConfig()

        # Build prompt
        prompt = self._build_prompt(messages, tools)

        # Collect images
        images = self._collect_images(messages)

        # Generate
        try:
            if images:
                import openvino as ov
                result = self._pipeline.generate(
                    prompt,
                    images=images,
                    max_new_tokens=config.max_tokens,
                )
            else:
                result = self._pipeline.generate(
                    prompt,
                    max_new_tokens=config.max_tokens,
                )

            return str(result)

        except Exception as e:
            raise RuntimeError(f"Generation failed: {e}")

    async def generate_stream(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> AsyncIterator[str]:
        """Generate response with streaming."""
        if not self._loaded:
            raise RuntimeError("Model not loaded")

        from simi.types import GenerationConfig as GenConfig
        config = config or GenConfig()

        prompt = self._build_prompt(messages, tools)
        images = self._collect_images(messages)

        # Buffer for streamed tokens
        buffer: list[str] = []
        done = False

        def streamer(token: str) -> bool:
            buffer.append(token)
            return False  # Continue generation

        # Run generation in thread
        loop = asyncio.get_event_loop()

        def _generate():
            nonlocal done
            try:
                if images:
                    self._pipeline.generate(
                        prompt,
                        images=images,
                        max_new_tokens=config.max_tokens,
                        streamer=streamer,
                    )
                else:
                    self._pipeline.generate(
                        prompt,
                        max_new_tokens=config.max_tokens,
                        streamer=streamer,
                    )
            finally:
                done = True

        # Start generation in background
        task = loop.run_in_executor(None, _generate)

        # Yield tokens as they arrive
        while not done or buffer:
            if buffer:
                yield buffer.pop(0)
            else:
                await asyncio.sleep(0.01)

        await task

    def _build_prompt(
        self,
        messages: list[Message],
        tools: Optional[list[ToolSchema]] = None
    ) -> str:
        """Build prompt string from messages."""
        from simi.types import Role

        parts: list[str] = []

        # Add system message with tools
        system_content = ""
        for msg in messages:
            if msg.role == Role.SYSTEM:
                system_content = msg.content
                break

        if tools:
            tool_desc = self._format_tools(tools)
            system_content = f"{system_content}\n\n{tool_desc}"

        if system_content:
            parts.append(f"<|im_start|>system\n{system_content}<|im_end|>")

        # Add conversation
        for msg in messages:
            if msg.role == Role.SYSTEM:
                continue
            elif msg.role == Role.USER:
                # Add image placeholders
                img_tags = ""
                for _ in msg.images:
                    img_tags += "<|vision_start|><|image_pad|><|vision_end|>"
                parts.append(f"<|im_start|>user\n{img_tags}{msg.content}<|im_end|>")
            elif msg.role == Role.ASSISTANT:
                parts.append(f"<|im_start|>assistant\n{msg.content}<|im_end|>")
            elif msg.role == Role.TOOL:
                parts.append(f"<|im_start|>tool\n{msg.content}<|im_end|>")

        # Start assistant turn
        parts.append("<|im_start|>assistant\n")

        return "\n".join(parts)

    def _format_tools(self, tools: list[ToolSchema]) -> str:
        """Format tools as system prompt."""
        lines = ["## Available Tools", ""]
        lines.append("Use tools with this format:")
        lines.append("```")
        lines.append("<tool_call>")
        lines.append('{"name": "tool_name", "arguments": {"param": "value"}}')
        lines.append("</tool_call>")
        lines.append("```")
        lines.append("")

        for tool in tools:
            lines.append(f"### {tool.name}")
            lines.append(tool.description)
            lines.append("Parameters:")
            for param in tool.parameters:
                req = "required" if param.required else "optional"
                lines.append(f"  - {param.name} ({param.type}, {req}): {param.description}")
            lines.append("")

        return "\n".join(lines)

    def _collect_images(self, messages: list[Message]) -> list[Any]:
        """Collect and process images from messages."""
        images = []

        for msg in messages:
            for img in msg.images:
                if isinstance(img, bytes):
                    # Raw bytes
                    images.append(self._bytes_to_tensor(img))
                elif isinstance(img, (str, Path)):
                    path = Path(img)
                    if path.exists():
                        # File path
                        images.append(self._load_image(path))
                    elif isinstance(img, str) and img.startswith("data:"):
                        # Data URL
                        images.append(self._decode_data_url(img))

        return images

    def _load_image(self, path: Path) -> Any:
        """Load image from file."""
        import openvino as ov
        data = path.read_bytes()
        return ov.Tensor(data)

    def _bytes_to_tensor(self, data: bytes) -> Any:
        """Convert bytes to OpenVINO tensor."""
        import openvino as ov
        return ov.Tensor(data)

    def _decode_data_url(self, url: str) -> Any:
        """Decode base64 data URL to tensor."""
        # Extract base64 part
        match = re.match(r"data:image/\w+;base64,(.+)", url)
        if match:
            data = base64.b64decode(match.group(1))
            return self._bytes_to_tensor(data)
        raise ValueError("Invalid data URL")

    def start_chat(self) -> None:
        """Start a new chat session (clears KV cache)."""
        if self._pipeline:
            self._pipeline.start_chat()

    def shutdown(self) -> None:
        """Release model resources."""
        self._pipeline = None
        self._loaded = False
