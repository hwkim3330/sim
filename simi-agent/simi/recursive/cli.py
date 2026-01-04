"""
CLI extension for recursive self-improving agent.

Commands:
    simi-recursive run <task>     Execute task with self-improvement
    simi-recursive evolve         Force evolution cycle
    simi-recursive stats          Show improvement statistics
    simi-recursive strategies     List current strategies
    simi-recursive reset          Reset learning state
"""

from __future__ import annotations

import argparse
import sys
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        prog="simi-recursive",
        description="Recursive Self-Improving AI Agent"
    )

    parser.add_argument(
        "--model", "-m",
        type=str,
        default=os.environ.get("SIMI_VLM_MODEL"),
        help="Path to VLM model"
    )
    parser.add_argument(
        "--device", "-d",
        type=str,
        default="CPU",
        choices=["CPU", "GPU", "NPU", "AUTO"],
        help="Device for inference"
    )
    parser.add_argument(
        "--threads", "-t",
        type=int,
        default=0,
        help="Number of threads (0 = auto)"
    )
    parser.add_argument(
        "--claude-key",
        type=str,
        default=os.environ.get("ANTHROPIC_API_KEY"),
        help="Claude API key for fallback"
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Run command
    run_parser = subparsers.add_parser("run", help="Execute a task")
    run_parser.add_argument("task", type=str, help="Task description")
    run_parser.add_argument("--type", "-t", type=str, default="general", help="Task type")
    run_parser.add_argument("--image", "-i", type=str, action="append", help="Image files")

    # Evolve command
    subparsers.add_parser("evolve", help="Force evolution cycle")

    # Stats command
    subparsers.add_parser("stats", help="Show improvement statistics")

    # Strategies command
    strat_parser = subparsers.add_parser("strategies", help="List strategies")
    strat_parser.add_argument("--top", "-n", type=int, default=10, help="Number to show")

    # Reset command
    reset_parser = subparsers.add_parser("reset", help="Reset learning state")
    reset_parser.add_argument("--confirm", action="store_true", help="Confirm reset")

    # Report command
    subparsers.add_parser("report", help="Generate improvement report")

    # Interactive command
    subparsers.add_parser("interactive", help="Start interactive session")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Import here to avoid slow startup
    from simi.recursive import SelfImprovingAgent, RecursiveConfig

    config = RecursiveConfig(
        vlm_model_path=args.model,
        vlm_device=args.device,
        vlm_threads=args.threads,
        claude_api_key=args.claude_key,
    )

    agent = SelfImprovingAgent(config)

    if args.command == "run":
        return cmd_run(agent, args)
    elif args.command == "evolve":
        return cmd_evolve(agent)
    elif args.command == "stats":
        return cmd_stats(agent)
    elif args.command == "strategies":
        return cmd_strategies(agent, args.top)
    elif args.command == "reset":
        return cmd_reset(agent, args.confirm)
    elif args.command == "report":
        return cmd_report(agent)
    elif args.command == "interactive":
        return cmd_interactive(agent)

    return 0


def cmd_run(agent, args):
    """Execute a task."""
    print(f"Running task: {args.task}")
    print(f"Task type: {args.type}")
    print()

    images = args.image or []
    result = agent.run(args.task, task_type=args.type, images=images)

    print(f"Status: {result.status.value}")
    print(f"Duration: {result.duration:.2f}s")
    print(f"Strategy: {result.strategy_id[:8]}")
    print(f"Reward: {result.reward:.3f}")
    print()
    print("Response:")
    print("-" * 40)
    print(getattr(result, "response", "No response"))
    print("-" * 40)

    return 0 if result.status.value == "success" else 1


def cmd_evolve(agent):
    """Force evolution."""
    print("Starting evolution cycle...")
    result = agent.evolve()

    print(f"Generation: {result['generation']}")
    print(f"Best fitness: {result['best_fitness']:.3f}")
    print(f"Improvement: {result['improvement']:+.3f}")
    print(f"Best strategy: {result['best_strategy']}")

    return 0


def cmd_stats(agent):
    """Show statistics."""
    stats = agent.get_stats()

    print("=" * 50)
    print("SELF-IMPROVEMENT STATISTICS")
    print("=" * 50)

    print("\nEvolution:")
    for k, v in stats["evolution"].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.3f}")
        else:
            print(f"  {k}: {v}")

    print("\nPerformance:")
    for k, v in stats["performance"].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.3f}")
        elif isinstance(v, list):
            print(f"  {k}: {len(v)} items")
        else:
            print(f"  {k}: {v}")

    print("\nMemory:")
    for k, v in stats["memory"].items():
        if isinstance(v, list):
            print(f"  {k}: {len(v)} items")
        else:
            print(f"  {k}: {v}")

    if stats["weaknesses"]:
        print("\nWeaknesses:")
        for w in stats["weaknesses"]:
            if w["type"] == "task_type":
                print(f"  - {w['name']}: {w['success_rate']:.1%} success")
            else:
                print(f"  - Strategy {w['id'][:8]}: {w['avg_reward']:.2f} avg reward")

    return 0


def cmd_strategies(agent, top):
    """List strategies."""
    strategies = agent.get_best_strategies(top)

    print(f"Top {len(strategies)} Strategies:")
    print("-" * 60)

    for i, s in enumerate(strategies, 1):
        print(f"\n{i}. {s['name']}")
        print(f"   ID: {s['id'][:12]}")
        print(f"   Fitness: {s['fitness']:.3f}")
        print(f"   Uses: {s['uses']}, Successes: {s['successes']}")
        print(f"   Description: {s['description'][:60]}")

    return 0


def cmd_reset(agent, confirm):
    """Reset learning state."""
    if not confirm:
        print("Warning: This will delete all learning data!")
        print("Use --confirm to proceed.")
        return 1

    agent.reset()
    print("Learning state reset successfully.")
    return 0


def cmd_report(agent):
    """Generate report."""
    report = agent.explain_improvement()
    print(report)
    return 0


def cmd_interactive(agent):
    """Interactive session."""
    print("=" * 50)
    print("RECURSIVE SELF-IMPROVING AGENT")
    print("=" * 50)
    print("Commands: /stats, /evolve, /report, /quit")
    print()

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        if user_input == "/quit":
            print("Goodbye!")
            break
        elif user_input == "/stats":
            cmd_stats(agent)
        elif user_input == "/evolve":
            cmd_evolve(agent)
        elif user_input == "/report":
            cmd_report(agent)
        else:
            # Run as task
            result = agent.run(user_input)
            print(f"\n[{result.status.value} | {result.duration:.1f}s | reward={result.reward:.2f}]")
            print(f"Agent: {getattr(result, 'response', 'No response')}")
            print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
