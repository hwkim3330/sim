"""
Simi Agent CLI - Interactive terminal interface.
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
from rich.syntax import Syntax
from prompt_toolkit import prompt
from prompt_toolkit.history import FileHistory

from simi import __version__
from simi.agent import Agent, AgentConfig


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
[dim]  Hybrid AI Coding Assistant - v{version}[/dim]
""".format(version=__version__)
    console.print(banner)


def print_help():
    """Print help message."""
    help_text = """
[cyan bold]Commands:[/cyan bold]
  [bold]/help[/bold]      Show this help
  [bold]/clear[/bold]     Clear conversation
  [bold]/image[/bold]     Attach image (usage: /image path/to/file.png)
  [bold]/history[/bold]   Show conversation history
  [bold]/stats[/bold]     Show usage statistics
  [bold]/exit[/bold]      Exit the program

[dim]Type a message and press Enter to chat.
Press Ctrl+C to interrupt generation.[/dim]
"""
    console.print(help_text)


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
    "-t", "--threads",
    default=0,
    type=int,
    help="Number of CPU threads (0 = auto)"
)
@click.option(
    "--perf", "--performance",
    "performance",
    default="latency",
    type=click.Choice(["latency", "throughput"]),
    help="Performance mode: latency (fast) or throughput (batch)"
)
@click.option(
    "--prefer-local/--prefer-api",
    default=True,
    help="Prefer local model over API"
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
    threads: int,
    performance: str,
    prefer_local: bool,
    verbose: bool,
):
    """Simi Agent - AI Coding Assistant"""

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
        console.print()
        console.print("Or both for hybrid mode:")
        console.print("  [cyan]simi -m models/qwen2.5-vl-3b -k sk-...[/cyan]")
        return

    # Check local model exists
    if model and not Path(model).exists():
        console.print(f"[red]Model not found: {model}[/red]")
        console.print()
        console.print("Download a model with:")
        console.print("  [cyan]pip install optimum[openvino] transformers[/cyan]")
        console.print("  [cyan]optimum-cli export openvino --model Qwen/Qwen2.5-VL-3B-Instruct \\[/cyan]")
        console.print("    [cyan]--weight-format int4 --trust-remote-code models/qwen2.5-vl-3b[/cyan]")
        return

    # Create agent
    try:
        config = AgentConfig(
            vlm_model_path=model,
            vlm_device=device,
            vlm_threads=threads,
            vlm_performance=performance,
            claude_api_key=api_key,
            prefer_local=prefer_local,
        )

        with console.status("[bold green]Loading model...", spinner="dots"):
            agent = Agent(config)

        console.print(f"[green]✓ Agent ready[/green]")
        console.print(f"[dim]  Engine: {agent._engine.name}[/dim]")
        console.print()

    except Exception as e:
        console.print(f"[red]Failed to initialize agent: {e}[/red]")
        return

    print_help()

    # Setup history
    history_file = Path.home() / ".simi_history"
    history = FileHistory(str(history_file))

    pending_images: list[str] = []

    # Main loop
    while True:
        try:
            # Get input
            user_input = prompt(
                "You: ",
                history=history,
            ).strip()

            if not user_input:
                continue

            # Handle commands
            if user_input.startswith("/"):
                cmd = user_input.lower()

                if cmd in ("/exit", "/quit", "/q"):
                    console.print("[cyan]Goodbye![/cyan]")
                    break

                elif cmd == "/help":
                    print_help()

                elif cmd == "/clear":
                    agent.reset()
                    pending_images.clear()
                    console.print("[dim]Conversation cleared.[/dim]")

                elif cmd == "/history":
                    console.print("[dim]--- History ---[/dim]")
                    for msg in agent.history:
                        role_color = {
                            "system": "yellow",
                            "user": "green",
                            "assistant": "blue",
                            "tool": "magenta",
                        }.get(msg.role.value, "white")
                        console.print(f"[{role_color}][{msg.role.value}][/{role_color}] {msg.content[:200]}...")
                    console.print("[dim]---------------[/dim]")

                elif cmd == "/stats":
                    stats = agent.stats
                    console.print("[cyan]Usage Statistics:[/cyan]")
                    console.print(f"  Tool calls: {stats.tool_call_count}")
                    console.print(f"  Local inferences: {stats.local_inference_count}")
                    console.print(f"  API calls: {stats.api_call_count}")

                elif user_input.startswith("/image "):
                    img_path = user_input[7:].strip()
                    if Path(img_path).exists():
                        pending_images.append(img_path)
                        console.print(f"[dim]Image attached: {img_path}[/dim]")
                    else:
                        console.print(f"[red]Image not found: {img_path}[/red]")

                else:
                    console.print(f"[red]Unknown command: {user_input}[/red]")

                continue

            # Process message
            console.print("[blue bold]Simi:[/blue bold] ", end="")

            try:
                response = agent.run(
                    user_input,
                    images=pending_images if pending_images else None,
                    stream_callback=lambda t: console.print(t, end=""),
                    tool_callback=lambda c, r: (
                        console.print(f"\n[dim][Tool: {c.name}][/dim]", end="")
                        if verbose else None
                    ),
                )

                # If not streaming, print response
                if not agent.config.stream:
                    console.print(response)

                console.print()  # Newline after response
                pending_images.clear()

            except KeyboardInterrupt:
                console.print("\n[yellow]Interrupted[/yellow]")

            except Exception as e:
                console.print(f"\n[red]Error: {e}[/red]")

        except KeyboardInterrupt:
            console.print("\n[cyan]Goodbye![/cyan]")
            break

        except EOFError:
            break


if __name__ == "__main__":
    main()
