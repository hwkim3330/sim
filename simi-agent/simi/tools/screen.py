"""
Screenshot tool.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from simi.tools.base import Tool
from simi.types import ToolParameter, ToolResult


class Screenshot(Tool):
    """Capture screenshots."""

    name = "screenshot"
    description = "Capture a screenshot of the screen or active window."
    parameters = [
        ToolParameter("output", "string", "Output file path (auto-generated if not provided)", required=False),
        ToolParameter("region", "string", "Region: 'full', 'active', or 'x,y,width,height'", required=False),
    ]

    output_dir = "screenshots"

    def execute(self, **kwargs: Any) -> ToolResult:
        output = kwargs.get("output")
        region = kwargs.get("region", "full")

        # Generate output path if not provided
        if not output:
            Path(self.output_dir).mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output = f"{self.output_dir}/screenshot_{timestamp}.png"

        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            if sys.platform == "win32":
                return self._capture_windows(output_path, region)
            elif sys.platform == "darwin":
                return self._capture_macos(output_path, region)
            else:
                return self._capture_linux(output_path, region)
        except Exception as e:
            return ToolResult("", False, "", f"Screenshot failed: {e}")

    def _capture_windows(self, output: Path, region: str) -> ToolResult:
        """Capture screenshot on Windows using PIL."""
        try:
            from PIL import ImageGrab

            if region == "full":
                img = ImageGrab.grab()
            elif region == "active":
                # Get active window bounds
                import ctypes
                user32 = ctypes.windll.user32
                hwnd = user32.GetForegroundWindow()

                rect = ctypes.wintypes.RECT()
                user32.GetWindowRect(hwnd, ctypes.byref(rect))
                bbox = (rect.left, rect.top, rect.right, rect.bottom)
                img = ImageGrab.grab(bbox)
            else:
                # Parse x,y,w,h
                parts = [int(x) for x in region.split(",")]
                if len(parts) == 4:
                    x, y, w, h = parts
                    img = ImageGrab.grab((x, y, x + w, y + h))
                else:
                    img = ImageGrab.grab()

            img.save(str(output))
            return ToolResult("", True, f"Screenshot saved: {output}")

        except ImportError:
            return ToolResult("", False, "", "PIL not installed. Install with: pip install pillow")

    def _capture_macos(self, output: Path, region: str) -> ToolResult:
        """Capture screenshot on macOS using screencapture."""
        import subprocess

        cmd = ["screencapture"]

        if region == "active":
            cmd.append("-w")  # Window mode
        elif region != "full":
            cmd.extend(["-R", region])

        cmd.append(str(output))

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return ToolResult("", True, f"Screenshot saved: {output}")
        return ToolResult("", False, "", result.stderr or "Screenshot failed")

    def _capture_linux(self, output: Path, region: str) -> ToolResult:
        """Capture screenshot on Linux using scrot or gnome-screenshot."""
        import shutil
        import subprocess

        # Try scrot first
        if shutil.which("scrot"):
            cmd = ["scrot"]
            if region == "active":
                cmd.append("-u")
            elif region != "full":
                cmd.extend(["-a", region])
            cmd.append(str(output))

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return ToolResult("", True, f"Screenshot saved: {output}")

        # Try gnome-screenshot
        if shutil.which("gnome-screenshot"):
            cmd = ["gnome-screenshot", "-f", str(output)]
            if region == "active":
                cmd.append("-w")

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return ToolResult("", True, f"Screenshot saved: {output}")

        return ToolResult("", False, "", "No screenshot tool found. Install scrot or gnome-screenshot.")

    def is_available(self) -> bool:
        """Check if screenshot is possible."""
        if sys.platform == "win32":
            try:
                from PIL import ImageGrab
                return True
            except ImportError:
                return False
        elif sys.platform == "darwin":
            return True  # screencapture is built-in
        else:
            import shutil
            return bool(shutil.which("scrot") or shutil.which("gnome-screenshot"))
