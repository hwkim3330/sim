"""
Main TUI application for Simi Agent.

Uses Rich library for terminal rendering.
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Callable
from datetime import datetime

try:
    from rich.console import Console, Group
    from rich.panel import Panel
    from rich.text import Text
    from rich.markdown import Markdown
    from rich.table import Table
    from rich.layout import Layout
    from rich.live import Live
    from rich.prompt import Prompt
    from rich.style import Style
    from rich.syntax import Syntax
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

from simi.tui.theme import Theme, DEFAULT_THEME


class AgentMode(Enum):
    BUILD = "build"
    PLAN = "plan"


@dataclass
class Message:
    """Chat message."""
    role: str  # "user", "assistant", "system", "tool"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TUIState:
    """TUI application state."""
    mode: AgentMode = AgentMode.BUILD
    messages: list[Message] = field(default_factory=list)
    input_buffer: str = ""
    status: str = "Ready"
    model: str = "Unknown"
    session_id: Optional[str] = None
    is_processing: bool = False
    show_sidebar: bool = False


class SimiTUI:
    """
    Terminal User Interface for Simi Agent.

    Example:
        >>> from simi.tui import SimiTUI
        >>> tui = SimiTUI()
        >>> tui.run()

    Keybindings:
        Tab     - Switch between Build/Plan mode
        Ctrl+L  - Clear screen
        Ctrl+S  - Toggle sidebar
        Ctrl+C  - Exit
        Enter   - Send message
        @       - File/symbol reference
    """

    def __init__(
        self,
        theme: Optional[Theme] = None,
        agent=None,
        model: str = "auto",
    ):
        if not HAS_RICH:
            raise ImportError("rich package required: pip install rich")

        self.theme = theme or DEFAULT_THEME
        self.agent = agent
        self.console = Console()
        self.state = TUIState(model=model)

        # Callbacks
        self._on_send: Optional[Callable] = None
        self._on_mode_change: Optional[Callable] = None

    def on_send(self, callback: Callable[[str], Any]) -> None:
        """Set callback for message send."""
        self._on_send = callback

    def on_mode_change(self, callback: Callable[[AgentMode], Any]) -> None:
        """Set callback for mode change."""
        self._on_mode_change = callback

    def _render_header(self) -> Panel:
        """Render header with mode and status."""
        mode_color = (
            self.theme.build_color
            if self.state.mode == AgentMode.BUILD
            else self.theme.plan_color
        )
        mode_text = f"[bold {mode_color}]{self.state.mode.value.upper()}[/]"

        header = Table.grid(padding=1)
        header.add_column(justify="left", ratio=1)
        header.add_column(justify="center", ratio=2)
        header.add_column(justify="right", ratio=1)

        header.add_row(
            f"[bold {self.theme.primary}]SIMI[/]",
            mode_text,
            f"[dim]{self.state.model}[/]",
        )

        return Panel(
            header,
            style=f"on {self.theme.bg_secondary}",
            border_style=self.theme.border,
            height=3,
        )

    def _render_messages(self) -> Panel:
        """Render chat messages."""
        if not self.state.messages:
            return Panel(
                "[dim]No messages yet. Start typing to chat![/]",
                title="[bold]Chat[/]",
                border_style=self.theme.border,
            )

        content = []
        for msg in self.state.messages[-20:]:  # Show last 20
            if msg.role == "user":
                prefix = f"[bold {self.theme.secondary}]You:[/]"
            elif msg.role == "assistant":
                prefix = f"[bold {self.theme.primary}]Simi:[/]"
            elif msg.role == "tool":
                prefix = f"[bold {self.theme.accent}]Tool:[/]"
            else:
                prefix = f"[bold]System:[/]"

            # Truncate long messages
            text = msg.content
            if len(text) > 500:
                text = text[:500] + "..."

            content.append(f"{prefix} {text}\n")

        return Panel(
            Text.from_markup("\n".join(content)),
            title="[bold]Chat[/]",
            border_style=self.theme.border,
        )

    def _render_input(self) -> Panel:
        """Render input area."""
        if self.state.is_processing:
            prompt = "[dim]Processing...[/]"
        else:
            mode_indicator = (
                "[green]>[/]"
                if self.state.mode == AgentMode.BUILD
                else "[blue]?[/]"
            )
            prompt = f"{mode_indicator} {self.state.input_buffer}[blink]|[/]"

        return Panel(
            prompt,
            title=f"[bold]Input[/] [dim](Tab: switch mode, @: reference file)[/]",
            border_style=self.theme.border_focus,
            height=3,
        )

    def _render_status(self) -> Text:
        """Render status bar."""
        status = Text()
        status.append(f" {self.state.status} ", style=f"on {self.theme.bg_secondary}")
        status.append(" | ", style="dim")
        status.append(f"Mode: {self.state.mode.value}", style="dim")

        if self.state.session_id:
            status.append(" | ", style="dim")
            status.append(f"Session: {self.state.session_id[:8]}", style="dim")

        return status

    def _render(self) -> Layout:
        """Render full TUI layout."""
        layout = Layout()

        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="input", size=5),
            Layout(name="status", size=1),
        )

        layout["header"].update(self._render_header())
        layout["main"].update(self._render_messages())
        layout["input"].update(self._render_input())
        layout["status"].update(self._render_status())

        return layout

    def add_message(self, role: str, content: str, **metadata) -> None:
        """Add a message to the chat."""
        self.state.messages.append(Message(
            role=role,
            content=content,
            metadata=metadata,
        ))

    def set_mode(self, mode: AgentMode) -> None:
        """Switch agent mode."""
        self.state.mode = mode
        if self._on_mode_change:
            self._on_mode_change(mode)

    def toggle_mode(self) -> None:
        """Toggle between Build and Plan mode."""
        new_mode = (
            AgentMode.PLAN
            if self.state.mode == AgentMode.BUILD
            else AgentMode.BUILD
        )
        self.set_mode(new_mode)

    async def process_input(self, text: str) -> None:
        """Process user input."""
        if not text.strip():
            return

        # Check for commands
        if text.startswith("/"):
            await self._handle_command(text[1:])
            return

        # Add user message
        self.add_message("user", text)
        self.state.is_processing = True
        self.state.status = "Thinking..."

        try:
            # Call agent if available
            if self._on_send:
                response = await self._on_send(text)
                if response:
                    self.add_message("assistant", response)
            elif self.agent:
                response = self.agent.run(text)
                self.add_message("assistant", response)
            else:
                self.add_message("assistant", f"Echo: {text}")

        except Exception as e:
            self.add_message("system", f"Error: {e}")
        finally:
            self.state.is_processing = False
            self.state.status = "Ready"

    async def _handle_command(self, cmd: str) -> None:
        """Handle slash commands."""
        parts = cmd.split()
        command = parts[0].lower()
        args = parts[1:]

        if command == "help":
            self.add_message("system", """
Available commands:
  /help     - Show this help
  /clear    - Clear chat history
  /mode     - Toggle Build/Plan mode
  /model    - Show current model
  /session  - Show session info
  /quit     - Exit
            """.strip())

        elif command == "clear":
            self.state.messages.clear()
            self.add_message("system", "Chat cleared.")

        elif command == "mode":
            self.toggle_mode()
            self.add_message("system", f"Switched to {self.state.mode.value} mode")

        elif command == "model":
            self.add_message("system", f"Current model: {self.state.model}")

        elif command == "session":
            self.add_message("system", f"Session: {self.state.session_id or 'New'}")

        elif command in ("quit", "exit", "q"):
            raise KeyboardInterrupt()

        else:
            self.add_message("system", f"Unknown command: /{command}")

    def run(self) -> None:
        """Run the TUI (blocking)."""
        self.console.clear()

        # Welcome message
        self.add_message("system", f"""
Welcome to Simi!

Mode: {self.state.mode.value.upper()}
Commands: /help for available commands
Press Tab to switch between Build/Plan mode
        """.strip())

        try:
            while True:
                # Render
                self.console.print(self._render())

                # Get input
                try:
                    text = Prompt.ask(
                        f"[{'green' if self.state.mode == AgentMode.BUILD else 'blue'}]>[/]"
                    )
                except EOFError:
                    break

                # Handle Tab for mode switch
                if text == "\t" or text.lower() == "tab":
                    self.toggle_mode()
                    self.console.clear()
                    continue

                # Process
                asyncio.run(self.process_input(text))
                self.console.clear()

        except KeyboardInterrupt:
            self.console.print("\n[dim]Goodbye![/]")

    async def run_async(self) -> None:
        """Run the TUI asynchronously."""
        self.console.clear()

        self.add_message("system", f"Welcome to Simi! Mode: {self.state.mode.value.upper()}")

        try:
            while True:
                self.console.print(self._render())

                # Non-blocking input would require additional libraries
                text = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: Prompt.ask(f"[{'green' if self.state.mode == AgentMode.BUILD else 'blue'}]>[/]")
                )

                if text.lower() == "tab":
                    self.toggle_mode()
                    self.console.clear()
                    continue

                await self.process_input(text)
                self.console.clear()

        except KeyboardInterrupt:
            self.console.print("\n[dim]Goodbye![/]")


def main():
    """CLI entry point."""
    tui = SimiTUI()
    tui.run()


if __name__ == "__main__":
    main()
