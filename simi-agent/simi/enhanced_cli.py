"""
Enhanced CLI for Simi Agent.

Provides a rich terminal interface with Build/Plan modes,
MCP integration, and TUI support.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from prompt_toolkit import prompt
from prompt_toolkit.history import FileHistory
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory

from simi import __version__
from simi.mode import AgentMode
from simi.enhanced_agent import EnhancedAgent, EnhancedAgentConfig


console = Console()


def print_banner():
    """Print welcome banner."""
    banner = """
[cyan bold]
   _____ _           _    _                    _
  / ____(_)         (_)  / \\   __ _  ___ _ __ | |_
  \\___ \\ _ _ __ ___  _  / _ \\ / _` |/ _ \\ '_ \\| __|
   ___) | | '_ ` _ \\| |/ ___ \\ (_| |  __/ | | | |_
  |____/|_| |_| |_| |_/_/   \\_\\__, |\\___|_| |_|\\__|
                               __/ |
                              |___/
[/cyan bold]
[dim]  Enhanced AI Coding Assistant - v{version}[/dim]
""".format(version=__version__)
    console.print(banner)


def print_mode_status(mode: AgentMode):
    """Print current mode status."""
    if mode == AgentMode.BUILD:
        console.print(
            Panel(
                "[green bold]BUILD MODE[/green bold]\\n"
                "[dim]Full access to read, write, and execute[/dim]",
                border_style="green",
                width=50,
            )
        )
    else:
        console.print(
            Panel(
                "[blue bold]PLAN MODE[/blue bold]\\n"
                "[dim]Read-only - research and planning[/dim]",
                border_style="blue",
                width=50,
            )
        )


def print_help():
    """Print help message."""
    table = Table(title="Commands", show_header=True, header_style="bold cyan")
    table.add_column("Command", style="bold")
    table.add_column("Description")

    commands = [
        ("/help", "Show this help"),
        ("/mode", "Toggle Build/Plan mode"),
        ("/plan", "Switch to Plan mode"),
        ("/build", "Switch to Build mode"),
        ("/status", "Show agent status"),
        ("/clear", "Clear conversation"),
        ("/save", "Save session"),
        ("/load", "Load session"),
        ("/image <path>", "Attach image"),
        ("/tools", "List available tools"),
        ("/mcp", "Show MCP status"),
        ("/exit", "Exit the program"),
    ]

    for cmd, desc in commands:
        table.add_row(cmd, desc)

    console.print(table)
    console.print()
    console.print("[dim]Press Tab to toggle mode. Type a message and press Enter to chat.[/dim]")


def print_status(agent: EnhancedAgent):
    """Print agent status."""
    status = agent.get_status()

    table = Table(title="Agent Status", show_header=False)
    table.add_column("Key", style="bold")
    table.add_column("Value")

    mode_color = "green" if status["mode"] == "build" else "blue"
    table.add_row("Mode", f"[{mode_color}]{status['mode'].upper()}[/{mode_color}]")
    table.add_row("Description", status["mode_description"])
    table.add_row("History", f"{status['history_length']} messages")
    table.add_row("Tools", f"{status['tools']['available_in_mode']} / {status['tools']['registered']}")
    table.add_row("MCP", "Connected" if status["mcp_connected"] else "Not connected")
    table.add_row("Has Plan", "Yes" if status["has_plan"] else "No")

    stats = status["stats"]
    table.add_row("Tool Calls", str(stats["tool_call_count"]))
    table.add_row("API Calls", str(stats["api_call_count"]))

    console.print(table)


def print_tools(agent: EnhancedAgent):
    """Print available tools."""
    table = Table(title=f"Tools (Mode: {agent.mode.value.upper()})", show_header=True)
    table.add_column("Name", style="bold")
    table.add_column("Status")
    table.add_column("Description")

    for tool in agent._tools.list():
        is_allowed = agent._is_tool_allowed(tool.name)
        status = "[green]Available[/green]" if is_allowed else "[red]Blocked[/red]"
        table.add_row(tool.name, status, tool.description[:50] + "...")

    console.print(table)


def get_prompt_style(mode: AgentMode) -> str:
    """Get prompt style based on mode."""
    if mode == AgentMode.BUILD:
        return "[green bold]build>[/green bold] "
    else:
        return "[blue bold]plan>[/blue bold] "


@click.command()
@click.option(
    "-m", "--model",
    default=None,
    help="Path to local VLM model"
)
@click.option(
    "-k", "--api-key",
    envvar="ANTHROPIC_API_KEY",
    default=None,
    help="Anthropic API key"
)
@click.option(
    "-d", "--device",
    default="CPU",
    type=click.Choice(["CPU", "GPU", "NPU", "AUTO"]),
    help="Device for local inference"
)
@click.option(
    "--mode",
    "initial_mode",
    default="build",
    type=click.Choice(["build", "plan"]),
    help="Initial agent mode"
)
@click.option(
    "--mcp-config",
    type=click.Path(exists=True),
    help="MCP configuration file"
)
@click.option(
    "--tools-config",
    type=click.Path(exists=True),
    help="Custom tools configuration file"
)
@click.option(
    "--session",
    type=click.Path(),
    help="Session file to save/load"
)
@click.option(
    "--tui/--no-tui",
    default=False,
    help="Use TUI mode"
)
@click.option(
    "-v", "--verbose",
    is_flag=True,
    help="Enable verbose output"
)
@click.version_option(__version__)
def main(
    model: Optional[str],
    api_key: Optional[str],
    device: str,
    initial_mode: str,
    mcp_config: Optional[str],
    tools_config: Optional[str],
    session: Optional[str],
    tui: bool,
    verbose: bool,
):
    """Simi Agent - Enhanced AI Coding Assistant"""

    print_banner()

    # Validate we have at least one inference backend
    if not model and not api_key:
        console.print("[yellow]No model or API key provided.[/yellow]")
        console.print()
        console.print("To use local model:")
        console.print("  [cyan]simi -m models/qwen2.5-vl-3b[/cyan]")
        console.print()
        console.print("To use Claude API:")
        console.print("  [cyan]export ANTHROPIC_API_KEY=sk-...[/cyan]")
        console.print("  [cyan]simi[/cyan]")
        return

    # Create config
    config = EnhancedAgentConfig(
        vlm_model_path=model,
        vlm_device=device,
        claude_api_key=api_key,
        initial_mode=AgentMode(initial_mode),
        mcp_config_path=Path(mcp_config) if mcp_config else None,
        custom_tools_path=Path(tools_config) if tools_config else None,
        session_file=Path(session) if session else None,
    )

    # Use TUI mode if requested
    if tui:
        try:
            from simi.tui import SimiTUI
            tui_app = SimiTUI(model=config.claude_model)

            # Create agent after TUI loads
            with console.status("[bold green]Loading...", spinner="dots"):
                agent = EnhancedAgent(config)

            # Connect callbacks
            async def on_send(text: str) -> str:
                return agent.run(text)

            def on_mode_change(mode):
                agent.set_mode(AgentMode(mode.value))

            tui_app.on_send(on_send)
            tui_app.on_mode_change(on_mode_change)
            tui_app.run()
            return

        except ImportError:
            console.print("[yellow]TUI mode requires 'rich' package[/yellow]")

    # Initialize agent
    try:
        with console.status("[bold green]Loading agent...", spinner="dots"):
            agent = EnhancedAgent(config)

        console.print(f"[green]Agent ready[/green]")
        console.print(f"[dim]  Engine: {agent._engine.name}[/dim]")
        console.print()

    except Exception as e:
        console.print(f"[red]Failed to initialize agent: {e}[/red]")
        return

    # Load session if exists
    if session and Path(session).exists():
        if agent.load_session():
            console.print(f"[dim]Session loaded from {session}[/dim]")

    print_mode_status(agent.mode)
    print_help()

    # Setup history
    history_file = Path.home() / ".simi_history"
    history = FileHistory(str(history_file))

    pending_images: list[str] = []

    # Main loop
    while True:
        try:
            # Get input with mode-aware prompt
            mode_char = ">" if agent.mode == AgentMode.BUILD else "?"
            mode_color = "green" if agent.mode == AgentMode.BUILD else "blue"

            user_input = prompt(
                f"({agent.mode.value}) {mode_char} ",
                history=history,
                auto_suggest=AutoSuggestFromHistory(),
            ).strip()

            if not user_input:
                continue

            # Handle Tab for mode toggle
            if user_input.lower() in ("tab", "\\t"):
                new_mode = agent.toggle_mode()
                print_mode_status(new_mode)
                continue

            # Handle commands
            if user_input.startswith("/"):
                cmd_parts = user_input.lower().split()
                cmd = cmd_parts[0]

                if cmd in ("/exit", "/quit", "/q"):
                    if session:
                        agent.save_session()
                        console.print(f"[dim]Session saved to {session}[/dim]")
                    console.print("[cyan]Goodbye![/cyan]")
                    break

                elif cmd == "/help":
                    print_help()

                elif cmd == "/mode":
                    new_mode = agent.toggle_mode()
                    print_mode_status(new_mode)

                elif cmd == "/plan":
                    agent.set_mode(AgentMode.PLAN)
                    print_mode_status(AgentMode.PLAN)

                elif cmd == "/build":
                    agent.set_mode(AgentMode.BUILD)
                    print_mode_status(AgentMode.BUILD)

                elif cmd == "/status":
                    print_status(agent)

                elif cmd == "/clear":
                    agent.reset()
                    pending_images.clear()
                    console.print("[dim]Conversation cleared.[/dim]")

                elif cmd == "/save":
                    path = agent.save_session()
                    console.print(f"[green]Session saved to: {path}[/green]")

                elif cmd == "/load":
                    if agent.load_session():
                        console.print("[green]Session loaded.[/green]")
                        print_mode_status(agent.mode)
                    else:
                        console.print("[yellow]No session found.[/yellow]")

                elif cmd == "/tools":
                    print_tools(agent)

                elif cmd == "/mcp":
                    if agent._mcp_client and agent._mcp_client.connected:
                        mcp_status = agent._mcp_client.get_status()
                        console.print(Panel(
                            str(mcp_status),
                            title="MCP Status",
                            border_style="cyan"
                        ))
                    else:
                        console.print("[yellow]MCP not connected[/yellow]")

                elif user_input.startswith("/image "):
                    img_path = user_input[7:].strip()
                    if Path(img_path).exists():
                        pending_images.append(img_path)
                        console.print(f"[dim]Image attached: {img_path}[/dim]")
                    else:
                        console.print(f"[red]Image not found: {img_path}[/red]")

                elif cmd == "/history":
                    console.print("[dim]--- History ---[/dim]")
                    for i, msg in enumerate(agent.history[-10:]):
                        role_color = {
                            "system": "yellow",
                            "user": "green",
                            "assistant": "blue",
                            "tool": "magenta",
                        }.get(msg.role.value, "white")
                        preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
                        console.print(f"[{role_color}][{msg.role.value}][/{role_color}] {preview}")
                    console.print("[dim]---------------[/dim]")

                else:
                    console.print(f"[red]Unknown command: {cmd}[/red]")

                continue

            # Process message
            console.print(f"[{mode_color} bold]Simi:[/{mode_color} bold] ", end="")

            try:
                response = agent.run(
                    user_input,
                    images=pending_images if pending_images else None,
                    stream_callback=lambda t: console.print(t, end=""),
                    tool_callback=lambda c, r: (
                        console.print(f"\\n[dim][Tool: {c.name}][/dim]", end="")
                        if verbose else None
                    ),
                )

                # If not streaming, print response
                if not agent.config.stream:
                    console.print(response)

                console.print()  # Newline after response
                pending_images.clear()

            except KeyboardInterrupt:
                console.print("\\n[yellow]Interrupted[/yellow]")

            except Exception as e:
                console.print(f"\\n[red]Error: {e}[/red]")
                if verbose:
                    import traceback
                    console.print(f"[dim]{traceback.format_exc()}[/dim]")

        except KeyboardInterrupt:
            if session:
                agent.save_session()
                console.print(f"\\n[dim]Session saved to {session}[/dim]")
            console.print("\\n[cyan]Goodbye![/cyan]")
            break

        except EOFError:
            break


if __name__ == "__main__":
    main()
