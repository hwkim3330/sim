"""
Simi TUI - Terminal User Interface

Rich terminal interface for Simi AI Agent.
Inspired by OpenCode's TUI design.

Features:
- Interactive chat interface
- Agent mode switching (Build/Plan)
- File reference with @ symbol
- Status bar with model info
- Vim-like keybindings
"""

from simi.tui.app import SimiTUI
from simi.tui.theme import Theme, DEFAULT_THEME

__all__ = ["SimiTUI", "Theme", "DEFAULT_THEME"]
