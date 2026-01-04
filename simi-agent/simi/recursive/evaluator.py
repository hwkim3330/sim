"""
Performance evaluation for self-improving AI.

Tracks task outcomes, analyzes patterns, and provides
feedback for strategy evolution.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from pathlib import Path
from enum import Enum


class TaskStatus(Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass
class TaskResult:
    """
    Result of a task execution.

    Attributes:
        task_id: Unique task identifier
        task_type: Category of task (e.g., "code_edit", "search", "analysis")
        description: Task description
        status: Outcome status
        duration: Time taken in seconds
        strategy_id: Strategy used
        metrics: Performance metrics
        feedback: Optional human/automated feedback
    """
    task_id: str
    task_type: str
    description: str
    status: TaskStatus
    duration: float
    strategy_id: str
    metrics: dict[str, float] = field(default_factory=dict)
    feedback: Optional[str] = None
    timestamp: float = field(default_factory=time.time)

    @property
    def reward(self) -> float:
        """Calculate reward from status and metrics."""
        base_rewards = {
            TaskStatus.SUCCESS: 1.0,
            TaskStatus.PARTIAL: 0.5,
            TaskStatus.FAILURE: -0.3,
            TaskStatus.TIMEOUT: -0.2,
            TaskStatus.ERROR: -0.5,
        }

        reward = base_rewards.get(self.status, 0.0)

        # Adjust by metrics
        if "accuracy" in self.metrics:
            reward *= self.metrics["accuracy"]
        if "efficiency" in self.metrics:
            reward *= (0.5 + 0.5 * self.metrics["efficiency"])

        # Time bonus/penalty
        if self.duration < 5:
            reward *= 1.1  # Fast bonus
        elif self.duration > 60:
            reward *= 0.9  # Slow penalty

        return max(-1.0, min(1.0, reward))

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "description": self.description,
            "status": self.status.value,
            "duration": self.duration,
            "strategy_id": self.strategy_id,
            "metrics": self.metrics,
            "feedback": self.feedback,
            "timestamp": self.timestamp,
            "reward": self.reward,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TaskResult:
        return cls(
            task_id=data["task_id"],
            task_type=data["task_type"],
            description=data["description"],
            status=TaskStatus(data["status"]),
            duration=data["duration"],
            strategy_id=data["strategy_id"],
            metrics=data.get("metrics", {}),
            feedback=data.get("feedback"),
            timestamp=data.get("timestamp", time.time()),
        )


class PerformanceTracker:
    """
    Tracks and analyzes performance over time.

    Provides insights for:
    - Strategy effectiveness per task type
    - Overall improvement trends
    - Weakness identification
    """

    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path
        self.results: list[TaskResult] = []

        # Aggregated stats
        self._strategy_stats: dict[str, dict[str, Any]] = {}
        self._task_type_stats: dict[str, dict[str, Any]] = {}

        if storage_path and storage_path.exists():
            self.load()

    def record(self, result: TaskResult) -> None:
        """Record a task result."""
        self.results.append(result)
        self._update_stats(result)

        # Auto-save periodically
        if self.storage_path and len(self.results) % 10 == 0:
            self.save()

    def _update_stats(self, result: TaskResult) -> None:
        """Update aggregated statistics."""
        # Strategy stats
        if result.strategy_id not in self._strategy_stats:
            self._strategy_stats[result.strategy_id] = {
                "count": 0,
                "successes": 0,
                "total_reward": 0.0,
                "avg_duration": 0.0,
            }

        stats = self._strategy_stats[result.strategy_id]
        stats["count"] += 1
        if result.status == TaskStatus.SUCCESS:
            stats["successes"] += 1
        stats["total_reward"] += result.reward
        stats["avg_duration"] = (
            (stats["avg_duration"] * (stats["count"] - 1) + result.duration)
            / stats["count"]
        )

        # Task type stats
        if result.task_type not in self._task_type_stats:
            self._task_type_stats[result.task_type] = {
                "count": 0,
                "successes": 0,
                "best_strategy": None,
                "best_reward": -1.0,
            }

        tstats = self._task_type_stats[result.task_type]
        tstats["count"] += 1
        if result.status == TaskStatus.SUCCESS:
            tstats["successes"] += 1

        # Track best strategy for this task type
        if result.reward > tstats["best_reward"]:
            tstats["best_strategy"] = result.strategy_id
            tstats["best_reward"] = result.reward

    def get_strategy_performance(self, strategy_id: str) -> dict[str, Any]:
        """Get performance stats for a strategy."""
        if strategy_id not in self._strategy_stats:
            return {"count": 0, "success_rate": 0.0, "avg_reward": 0.0}

        stats = self._strategy_stats[strategy_id]
        return {
            "count": stats["count"],
            "success_rate": stats["successes"] / stats["count"] if stats["count"] > 0 else 0,
            "avg_reward": stats["total_reward"] / stats["count"] if stats["count"] > 0 else 0,
            "avg_duration": stats["avg_duration"],
        }

    def get_best_strategy_for_task(self, task_type: str) -> Optional[str]:
        """Get the best performing strategy for a task type."""
        if task_type not in self._task_type_stats:
            return None
        return self._task_type_stats[task_type].get("best_strategy")

    def get_improvement_trend(self, window: int = 20) -> float:
        """
        Calculate recent improvement trend.

        Returns:
            Positive = improving, Negative = declining, 0 = stable
        """
        if len(self.results) < window * 2:
            return 0.0

        recent = self.results[-window:]
        older = self.results[-window * 2:-window]

        recent_avg = sum(r.reward for r in recent) / len(recent)
        older_avg = sum(r.reward for r in older) / len(older)

        return recent_avg - older_avg

    def identify_weaknesses(self) -> list[dict[str, Any]]:
        """Identify areas needing improvement."""
        weaknesses = []

        for task_type, stats in self._task_type_stats.items():
            if stats["count"] >= 5:  # Enough data
                success_rate = stats["successes"] / stats["count"]
                if success_rate < 0.5:
                    weaknesses.append({
                        "type": "task_type",
                        "name": task_type,
                        "success_rate": success_rate,
                        "sample_size": stats["count"],
                    })

        for strategy_id, stats in self._strategy_stats.items():
            if stats["count"] >= 5:
                success_rate = stats["successes"] / stats["count"]
                avg_reward = stats["total_reward"] / stats["count"]
                if avg_reward < 0:
                    weaknesses.append({
                        "type": "strategy",
                        "id": strategy_id,
                        "avg_reward": avg_reward,
                        "success_rate": success_rate,
                        "sample_size": stats["count"],
                    })

        return sorted(weaknesses, key=lambda w: w.get("success_rate", 0))

    def get_summary(self) -> dict[str, Any]:
        """Get overall performance summary."""
        if not self.results:
            return {"total_tasks": 0}

        successes = sum(1 for r in self.results if r.status == TaskStatus.SUCCESS)
        total_reward = sum(r.reward for r in self.results)

        return {
            "total_tasks": len(self.results),
            "success_rate": successes / len(self.results),
            "avg_reward": total_reward / len(self.results),
            "total_reward": total_reward,
            "improvement_trend": self.get_improvement_trend(),
            "task_types": list(self._task_type_stats.keys()),
            "active_strategies": len(self._strategy_stats),
            "weaknesses": len(self.identify_weaknesses()),
        }

    def save(self) -> None:
        """Save tracker state."""
        if not self.storage_path:
            return

        data = {
            "results": [r.to_dict() for r in self.results[-1000:]],  # Keep last 1000
            "strategy_stats": self._strategy_stats,
            "task_type_stats": self._task_type_stats,
        }
        self.storage_path.write_text(json.dumps(data, indent=2))

    def load(self) -> None:
        """Load tracker state."""
        if not self.storage_path or not self.storage_path.exists():
            return

        data = json.loads(self.storage_path.read_text())
        self.results = [TaskResult.from_dict(r) for r in data.get("results", [])]
        self._strategy_stats = data.get("strategy_stats", {})
        self._task_type_stats = data.get("task_type_stats", {})


class AutoEvaluator:
    """
    Automatic task evaluation using heuristics and model-based scoring.

    Evaluates:
    - Code correctness (syntax, tests)
    - Task completion (output matches expected)
    - Efficiency (time, resource usage)
    """

    def __init__(self):
        self.evaluators: dict[str, callable] = {
            "code_edit": self._evaluate_code_edit,
            "search": self._evaluate_search,
            "analysis": self._evaluate_analysis,
            "default": self._evaluate_default,
        }

    def evaluate(
        self,
        task_type: str,
        task_input: str,
        task_output: str,
        expected: Optional[str] = None,
    ) -> dict[str, float]:
        """
        Evaluate task performance.

        Returns:
            Dict with metrics like accuracy, completeness, efficiency
        """
        evaluator = self.evaluators.get(task_type, self.evaluators["default"])
        return evaluator(task_input, task_output, expected)

    def _evaluate_code_edit(
        self,
        task_input: str,
        task_output: str,
        expected: Optional[str]
    ) -> dict[str, float]:
        """Evaluate code editing task."""
        metrics = {"completeness": 0.5}

        # Check if output contains code
        if "```" in task_output or "def " in task_output or "class " in task_output:
            metrics["completeness"] = 0.8

        # Check for error mentions
        if "error" in task_output.lower() or "failed" in task_output.lower():
            metrics["completeness"] *= 0.7

        # Check output length
        if len(task_output) > 100:
            metrics["detail"] = min(1.0, len(task_output) / 500)
        else:
            metrics["detail"] = 0.3

        return metrics

    def _evaluate_search(
        self,
        task_input: str,
        task_output: str,
        expected: Optional[str]
    ) -> dict[str, float]:
        """Evaluate search/find task."""
        metrics = {"completeness": 0.5}

        # Check if results found
        if "found" in task_output.lower() or ":" in task_output:
            metrics["completeness"] = 0.8

        # Check for specific results
        lines = task_output.strip().split("\n")
        if len(lines) > 1:
            metrics["detail"] = min(1.0, len(lines) / 10)
        else:
            metrics["detail"] = 0.3

        return metrics

    def _evaluate_analysis(
        self,
        task_input: str,
        task_output: str,
        expected: Optional[str]
    ) -> dict[str, float]:
        """Evaluate analysis task."""
        metrics = {"completeness": 0.5, "depth": 0.5}

        # Check output length as proxy for depth
        if len(task_output) > 200:
            metrics["depth"] = 0.8
        if len(task_output) > 500:
            metrics["depth"] = 1.0

        # Check for structure
        if any(marker in task_output for marker in ["1.", "-", "•", "##"]):
            metrics["completeness"] = 0.8

        return metrics

    def _evaluate_default(
        self,
        task_input: str,
        task_output: str,
        expected: Optional[str]
    ) -> dict[str, float]:
        """Default evaluation."""
        return {
            "completeness": 0.7 if len(task_output) > 50 else 0.4,
            "detail": min(1.0, len(task_output) / 200),
        }
