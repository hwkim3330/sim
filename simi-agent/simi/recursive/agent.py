"""
Recursive Self-Improving Agent.

An agent that learns from its experiences and evolves
its strategies over time through:

1. Task execution with strategy selection
2. Performance evaluation and feedback
3. Experience storage and pattern extraction
4. Strategy evolution via genetic algorithms
5. Meta-learning to improve the improvement process

The improvement loop:

    ┌─────────────────────────────────────────────┐
    │                                             │
    │   ┌──────────┐    ┌──────────┐             │
    │   │  Task    │───>│ Execute  │             │
    │   │  Input   │    │ Strategy │             │
    │   └──────────┘    └────┬─────┘             │
    │                        │                    │
    │   ┌──────────┐    ┌────▼─────┐             │
    │   │  Evolve  │<───│ Evaluate │             │
    │   │ Strategy │    │  Result  │             │
    │   └────┬─────┘    └────┬─────┘             │
    │        │               │                    │
    │   ┌────▼─────┐    ┌────▼─────┐             │
    │   │  Update  │<───│  Store   │             │
    │   │  Memory  │    │Experience│             │
    │   └──────────┘    └──────────┘             │
    │                                             │
    └─────────────────────────────────────────────┘
"""

from __future__ import annotations

import time
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Union

from simi.recursive.strategy import Strategy, StrategyEvolver
from simi.recursive.evaluator import (
    PerformanceTracker,
    TaskResult,
    TaskStatus,
    AutoEvaluator,
)
from simi.recursive.memory import MemoryBank, Experience

logger = logging.getLogger(__name__)


@dataclass
class RecursiveConfig:
    """Configuration for self-improving agent."""

    # VLM Engine
    vlm_model_path: Optional[str] = None
    vlm_device: str = "CPU"
    vlm_threads: int = 0
    vlm_performance: str = "latency"

    # Claude fallback
    claude_api_key: Optional[str] = None
    claude_model: str = "claude-sonnet-4-20250514"

    # Self-improvement settings
    enable_evolution: bool = True
    evolution_interval: int = 10  # Evolve every N tasks
    population_size: int = 20
    mutation_rate: float = 0.15

    # Memory settings
    memory_path: Optional[Path] = None
    max_experiences: int = 1000
    max_patterns: int = 100

    # Behavior
    max_iterations: int = 50
    max_tokens: int = 4096
    temperature: float = 0.7
    use_patterns: bool = True
    explain_reasoning: bool = True

    # Storage
    storage_dir: Path = field(default_factory=lambda: Path.home() / ".simi" / "recursive")

    def __post_init__(self):
        if self.memory_path is None:
            self.memory_path = self.storage_dir / "memory.json"


class SelfImprovingAgent:
    """
    An AI agent that recursively improves itself.

    Features:
    - Evolutionary strategy optimization
    - Experience-based learning
    - Pattern recognition and reuse
    - Automatic performance evaluation
    - Meta-learning for improvement

    Example:
        >>> from simi.recursive import SelfImprovingAgent, RecursiveConfig
        >>> agent = SelfImprovingAgent(RecursiveConfig(
        ...     vlm_model_path="models/qwen2.5-vl-3b"
        ... ))
        >>>
        >>> # Run task with self-improvement
        >>> result = agent.run("Write a function to calculate factorial")
        >>> print(result.response)
        >>>
        >>> # View improvement stats
        >>> print(agent.get_stats())
        >>>
        >>> # Force evolution
        >>> agent.evolve()
    """

    def __init__(self, config: Optional[RecursiveConfig] = None):
        self.config = config or RecursiveConfig()

        # Create storage directory
        self.config.storage_dir.mkdir(parents=True, exist_ok=True)

        # Initialize components
        self._evolver = StrategyEvolver(
            population_size=self.config.population_size,
            mutation_rate=self.config.mutation_rate,
        )

        self._tracker = PerformanceTracker(
            self.config.storage_dir / "performance.json"
        )

        self._memory = MemoryBank(
            self.config.memory_path,
            max_experiences=self.config.max_experiences,
            max_patterns=self.config.max_patterns,
        )

        self._evaluator = AutoEvaluator()

        # Load saved state
        self._load_state()

        # Task counter for evolution trigger
        self._task_count = 0

        # Base agent (lazy initialization)
        self._base_agent = None

    def _load_state(self) -> None:
        """Load saved state from disk."""
        evolver_path = self.config.storage_dir / "strategies.json"
        if evolver_path.exists():
            self._evolver.load(evolver_path)
            logger.info(f"Loaded {len(self._evolver.population)} strategies")

    def _save_state(self) -> None:
        """Save state to disk."""
        self._evolver.save(self.config.storage_dir / "strategies.json")
        self._tracker.save()
        self._memory.save()

    def _get_base_agent(self):
        """Get or create the base agent."""
        if self._base_agent is None:
            from simi.agent import Agent, AgentConfig

            self._base_agent = Agent(AgentConfig(
                vlm_model_path=self.config.vlm_model_path,
                vlm_device=self.config.vlm_device,
                vlm_threads=self.config.vlm_threads,
                vlm_performance=self.config.vlm_performance,
                claude_api_key=self.config.claude_api_key,
                claude_model=self.config.claude_model,
                max_iterations=self.config.max_iterations,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            ))

        return self._base_agent

    def run(
        self,
        task: str,
        *,
        task_type: str = "general",
        images: Optional[list[Union[str, Path, bytes]]] = None,
    ) -> TaskResult:
        """
        Execute a task with self-improvement.

        Args:
            task: The task description
            task_type: Category of task for strategy selection
            images: Optional images to include

        Returns:
            TaskResult with outcome and metrics
        """
        task_id = str(uuid.uuid4())[:8]
        start_time = time.time()

        # Select strategy
        strategy = self._select_strategy(task_type, task)
        logger.info(f"Selected strategy: {strategy.name} (fitness={strategy.fitness:.2f})")

        # Check for applicable patterns
        patterns = []
        if self.config.use_patterns:
            patterns = self._memory.find_applicable_patterns(task_type, task)
            if patterns:
                logger.info(f"Found {len(patterns)} applicable patterns")

        # Find similar experiences
        similar = self._memory.find_similar_experiences(task_type, task, top_k=3)

        # Build enhanced prompt
        enhanced_task = self._enhance_task(task, strategy, patterns, similar)

        # Execute with base agent
        try:
            agent = self._get_base_agent()
            response = agent.run(enhanced_task, images=images)
            status = TaskStatus.SUCCESS
            error = None
        except Exception as e:
            response = str(e)
            status = TaskStatus.ERROR
            error = str(e)
            logger.error(f"Task execution failed: {e}")

        duration = time.time() - start_time

        # Evaluate result
        metrics = self._evaluator.evaluate(task_type, task, response)

        # Determine final status based on metrics
        if status == TaskStatus.SUCCESS:
            avg_metric = sum(metrics.values()) / len(metrics) if metrics else 0.5
            if avg_metric < 0.3:
                status = TaskStatus.FAILURE
            elif avg_metric < 0.6:
                status = TaskStatus.PARTIAL

        # Create result
        result = TaskResult(
            task_id=task_id,
            task_type=task_type,
            description=task[:100],
            status=status,
            duration=duration,
            strategy_id=strategy.id,
            metrics=metrics,
        )

        # Record and learn
        self._process_result(result, strategy, task, response)

        # Check for evolution
        self._task_count += 1
        if (
            self.config.enable_evolution
            and self._task_count % self.config.evolution_interval == 0
        ):
            self.evolve()

        # Return result with response
        result.response = response
        return result

    def _select_strategy(self, task_type: str, task: str) -> Strategy:
        """Select best strategy for task."""
        # Check if we have a known best strategy for this type
        best = self._tracker.get_best_strategy_for_task(task_type)

        if best:
            # Find it in population
            for strategy in self._evolver.population:
                if strategy.id == best:
                    return strategy

        # Fall back to fitness-based selection
        return self._evolver.get_strategy_for_task(task_type)

    def _enhance_task(
        self,
        task: str,
        strategy: Strategy,
        patterns: list,
        similar: list[Experience],
    ) -> str:
        """Enhance task with strategy guidance and context."""
        parts = []

        # Strategy guidance
        if self.config.explain_reasoning:
            parts.append(f"[Strategy: {strategy.name}]")
            parts.append(f"Approach: {strategy.description}")

            if strategy.parameters.get("verify_each_step"):
                parts.append("- Verify each step before proceeding")
            if strategy.parameters.get("create_backup"):
                parts.append("- Create backups before making changes")
            if strategy.parameters.get("explain_reasoning"):
                parts.append("- Explain your reasoning")

        # Pattern guidance
        if patterns:
            parts.append("\n[Relevant patterns from past success:]")
            for pattern, score in patterns[:2]:
                parts.append(f"- {pattern.description}")
                parts.append(f"  Template: {pattern.solution_template[:100]}...")

        # Similar experience insights
        if similar:
            parts.append("\n[Insights from similar tasks:]")
            for exp in similar[:2]:
                if exp.learnings:
                    parts.append(f"- {exp.learnings[0]}")

        # Original task
        parts.append(f"\n[Task]\n{task}")

        return "\n".join(parts)

    def _process_result(
        self,
        result: TaskResult,
        strategy: Strategy,
        task: str,
        response: str,
    ) -> None:
        """Process result for learning."""
        # Record in tracker
        self._tracker.record(result)

        # Update strategy fitness
        success = result.status == TaskStatus.SUCCESS
        self._evolver.report_outcome(strategy.id, success, result.reward)

        # Extract learnings
        learnings = self._extract_learnings(result, response)

        # Store experience
        experience = Experience(
            task_type=result.task_type,
            input_summary=task[:200],
            approach=strategy.name,
            outcome=f"{result.status.value}: {response[:200]}",
            strategy_id=strategy.id,
            reward=result.reward,
            learnings=learnings,
        )
        self._memory.add_experience(experience)

        # Save state
        self._save_state()

    def _extract_learnings(self, result: TaskResult, response: str) -> list[str]:
        """Extract learnings from task result."""
        learnings = []

        if result.status == TaskStatus.SUCCESS:
            if result.duration < 5:
                learnings.append("Fast execution - approach was efficient")
            if result.metrics.get("completeness", 0) > 0.8:
                learnings.append("High completeness - thorough approach")

        elif result.status == TaskStatus.FAILURE:
            if "error" in response.lower():
                learnings.append("Error occurred - may need error handling")
            if "not found" in response.lower():
                learnings.append("Resource not found - verify paths/names first")

        elif result.status == TaskStatus.PARTIAL:
            learnings.append("Partial success - may need follow-up")

        return learnings

    def evolve(self) -> dict[str, Any]:
        """
        Perform one evolution cycle.

        Returns:
            Evolution statistics
        """
        logger.info("Starting evolution cycle...")

        before_stats = self._evolver.get_stats()
        self._evolver.evolve()
        after_stats = self._evolver.get_stats()

        improvement = after_stats["best_fitness"] - before_stats.get("best_fitness", 0)

        logger.info(
            f"Evolution complete: gen={after_stats['generation']}, "
            f"best={after_stats['best_fitness']:.3f} ({improvement:+.3f})"
        )

        self._save_state()

        return {
            "generation": after_stats["generation"],
            "best_fitness": after_stats["best_fitness"],
            "avg_fitness": after_stats["avg_fitness"],
            "improvement": improvement,
            "best_strategy": after_stats["best_strategy"],
        }

    def get_stats(self) -> dict[str, Any]:
        """Get comprehensive statistics."""
        return {
            "evolution": self._evolver.get_stats(),
            "performance": self._tracker.get_summary(),
            "memory": self._memory.get_stats(),
            "tasks_since_evolution": self._task_count % self.config.evolution_interval,
            "weaknesses": self._tracker.identify_weaknesses()[:5],
        }

    def get_strategies(self) -> list[dict[str, Any]]:
        """Get all current strategies."""
        return [s.to_dict() for s in self._evolver.population]

    def get_best_strategies(self, n: int = 5) -> list[dict[str, Any]]:
        """Get top performing strategies."""
        return [s.to_dict() for s in self._evolver.get_best(n)]

    def add_feedback(
        self,
        task_id: str,
        success: bool,
        feedback: Optional[str] = None,
    ) -> None:
        """Add human feedback for a task."""
        # Find the result
        for result in self._tracker.results:
            if result.task_id == task_id:
                result.feedback = feedback

                # Update strategy with feedback
                reward = 1.0 if success else -0.5
                self._evolver.report_outcome(result.strategy_id, success, reward)

                self._save_state()
                return

        logger.warning(f"Task {task_id} not found")

    def reset(self) -> None:
        """Reset all learning state."""
        self._evolver = StrategyEvolver(
            population_size=self.config.population_size,
            mutation_rate=self.config.mutation_rate,
        )
        self._tracker = PerformanceTracker(
            self.config.storage_dir / "performance.json"
        )
        self._memory.clear()
        self._task_count = 0

        # Delete saved files
        for f in self.config.storage_dir.glob("*.json"):
            f.unlink()

        logger.info("Learning state reset")

    def explain_improvement(self) -> str:
        """Generate explanation of self-improvement progress."""
        stats = self.get_stats()
        trend = stats["performance"].get("improvement_trend", 0)

        lines = [
            "# Self-Improvement Report",
            "",
            f"## Evolution Status",
            f"- Generation: {stats['evolution']['generation']}",
            f"- Best Strategy: {stats['evolution']['best_strategy']}",
            f"- Best Fitness: {stats['evolution']['best_fitness']:.3f}",
            f"- Average Fitness: {stats['evolution']['avg_fitness']:.3f}",
            "",
            f"## Performance",
            f"- Total Tasks: {stats['performance']['total_tasks']}",
            f"- Success Rate: {stats['performance'].get('success_rate', 0):.1%}",
            f"- Improvement Trend: {trend:+.3f}",
            "",
            f"## Memory",
            f"- Stored Experiences: {stats['memory']['total_experiences']}",
            f"- Learned Patterns: {stats['memory']['total_patterns']}",
            "",
        ]

        if stats["weaknesses"]:
            lines.append("## Areas for Improvement")
            for w in stats["weaknesses"]:
                if w["type"] == "task_type":
                    lines.append(f"- {w['name']}: {w['success_rate']:.1%} success rate")
                else:
                    lines.append(f"- Strategy {w['id'][:8]}: avg reward {w['avg_reward']:.2f}")

        # Trend interpretation
        lines.append("")
        if trend > 0.1:
            lines.append("*Overall: Significant improvement detected*")
        elif trend > 0:
            lines.append("*Overall: Gradual improvement*")
        elif trend < -0.1:
            lines.append("*Overall: Performance declining - may need intervention*")
        else:
            lines.append("*Overall: Performance stable*")

        return "\n".join(lines)


def create_recursive_agent(
    vlm_path: Optional[str] = None,
    claude_key: Optional[str] = None,
    **kwargs,
) -> SelfImprovingAgent:
    """
    Create a self-improving agent with simple parameters.

    Args:
        vlm_path: Path to local VLM model
        claude_key: Anthropic API key
        **kwargs: Additional RecursiveConfig parameters

    Returns:
        Configured SelfImprovingAgent
    """
    config = RecursiveConfig(
        vlm_model_path=vlm_path,
        claude_api_key=claude_key,
        **kwargs,
    )
    return SelfImprovingAgent(config)
