"""
Persistent memory bank for experience storage and retrieval.

Stores:
1. Task experiences (what worked, what didn't)
2. Learned patterns (reusable solutions)
3. Contextual knowledge (domain-specific learnings)
"""

from __future__ import annotations

import json
import time
import hashlib
from dataclasses import dataclass, field
from typing import Any, Optional
from pathlib import Path


@dataclass
class Experience:
    """
    A stored experience from task execution.

    Attributes:
        id: Unique identifier
        task_type: Category of task
        input_summary: Summary of the input/request
        approach: How the task was approached
        outcome: What happened (success/failure details)
        strategy_id: Strategy that was used
        reward: Performance reward received
        learnings: Key insights extracted
        timestamp: When this occurred
    """
    task_type: str
    input_summary: str
    approach: str
    outcome: str
    strategy_id: str
    reward: float
    learnings: list[str] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)
    tags: list[str] = field(default_factory=list)

    _id: Optional[str] = field(default=None, repr=False)

    @property
    def id(self) -> str:
        if self._id is None:
            content = f"{self.task_type}:{self.input_summary}:{self.timestamp}"
            self._id = hashlib.sha256(content.encode()).hexdigest()[:12]
        return self._id

    @property
    def is_positive(self) -> bool:
        return self.reward > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "task_type": self.task_type,
            "input_summary": self.input_summary,
            "approach": self.approach,
            "outcome": self.outcome,
            "strategy_id": self.strategy_id,
            "reward": self.reward,
            "learnings": self.learnings,
            "timestamp": self.timestamp,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Experience:
        exp = cls(
            task_type=data["task_type"],
            input_summary=data["input_summary"],
            approach=data["approach"],
            outcome=data["outcome"],
            strategy_id=data["strategy_id"],
            reward=data["reward"],
            learnings=data.get("learnings", []),
            timestamp=data.get("timestamp", time.time()),
            tags=data.get("tags", []),
        )
        exp._id = data.get("id")
        return exp


@dataclass
class Pattern:
    """
    A learned pattern that can be reused.

    Patterns are extracted from successful experiences
    and represent generalizable solutions.
    """
    name: str
    description: str
    task_types: list[str]
    trigger_keywords: list[str]
    solution_template: str
    confidence: float = 0.5
    uses: int = 0
    successes: int = 0

    _id: Optional[str] = field(default=None, repr=False)

    @property
    def id(self) -> str:
        if self._id is None:
            content = f"{self.name}:{self.description}"
            self._id = hashlib.sha256(content.encode()).hexdigest()[:12]
        return self._id

    def matches(self, task_type: str, input_text: str) -> float:
        """Check how well this pattern matches a task."""
        score = 0.0

        # Task type match
        if task_type in self.task_types:
            score += 0.5

        # Keyword matching
        input_lower = input_text.lower()
        matched_keywords = sum(
            1 for kw in self.trigger_keywords
            if kw.lower() in input_lower
        )
        if self.trigger_keywords:
            score += 0.5 * (matched_keywords / len(self.trigger_keywords))

        return score * self.confidence

    def update(self, success: bool) -> None:
        """Update pattern confidence based on outcome."""
        self.uses += 1
        if success:
            self.successes += 1

        # Bayesian update
        alpha = 0.1
        outcome = 1.0 if success else 0.0
        self.confidence = self.confidence * (1 - alpha) + outcome * alpha

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "task_types": self.task_types,
            "trigger_keywords": self.trigger_keywords,
            "solution_template": self.solution_template,
            "confidence": self.confidence,
            "uses": self.uses,
            "successes": self.successes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Pattern:
        pattern = cls(
            name=data["name"],
            description=data["description"],
            task_types=data["task_types"],
            trigger_keywords=data["trigger_keywords"],
            solution_template=data["solution_template"],
            confidence=data.get("confidence", 0.5),
        )
        pattern.uses = data.get("uses", 0)
        pattern.successes = data.get("successes", 0)
        pattern._id = data.get("id")
        return pattern


class MemoryBank:
    """
    Persistent storage for experiences and patterns.

    Features:
    - Experience storage with retrieval by similarity
    - Pattern extraction from successful experiences
    - Forgetting mechanism for old/irrelevant data
    """

    def __init__(
        self,
        storage_path: Optional[Path] = None,
        max_experiences: int = 1000,
        max_patterns: int = 100,
    ):
        self.storage_path = storage_path
        self.max_experiences = max_experiences
        self.max_patterns = max_patterns

        self.experiences: list[Experience] = []
        self.patterns: list[Pattern] = []

        # Index for fast retrieval
        self._experience_by_type: dict[str, list[Experience]] = {}
        self._experience_by_strategy: dict[str, list[Experience]] = {}

        if storage_path and storage_path.exists():
            self.load()

    def add_experience(self, experience: Experience) -> None:
        """Add a new experience to memory."""
        self.experiences.append(experience)

        # Update indices
        if experience.task_type not in self._experience_by_type:
            self._experience_by_type[experience.task_type] = []
        self._experience_by_type[experience.task_type].append(experience)

        if experience.strategy_id not in self._experience_by_strategy:
            self._experience_by_strategy[experience.strategy_id] = []
        self._experience_by_strategy[experience.strategy_id].append(experience)

        # Prune if over limit
        if len(self.experiences) > self.max_experiences:
            self._prune_experiences()

        # Try to extract patterns from positive experiences
        if experience.is_positive:
            self._try_extract_pattern(experience)

    def _prune_experiences(self) -> None:
        """Remove old, low-value experiences."""
        # Sort by value (reward * recency)
        now = time.time()
        scored = [
            (exp, exp.reward * (1.0 / (1 + (now - exp.timestamp) / 86400)))
            for exp in self.experiences
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        # Keep top experiences
        self.experiences = [exp for exp, _ in scored[:self.max_experiences]]

        # Rebuild indices
        self._rebuild_indices()

    def _rebuild_indices(self) -> None:
        """Rebuild lookup indices."""
        self._experience_by_type.clear()
        self._experience_by_strategy.clear()

        for exp in self.experiences:
            if exp.task_type not in self._experience_by_type:
                self._experience_by_type[exp.task_type] = []
            self._experience_by_type[exp.task_type].append(exp)

            if exp.strategy_id not in self._experience_by_strategy:
                self._experience_by_strategy[exp.strategy_id] = []
            self._experience_by_strategy[exp.strategy_id].append(exp)

    def _try_extract_pattern(self, experience: Experience) -> None:
        """Try to extract a reusable pattern from experience."""
        # Only extract from high-reward experiences
        if experience.reward < 0.5:
            return

        # Check if similar pattern exists
        for pattern in self.patterns:
            if pattern.task_types == [experience.task_type]:
                # Similar pattern exists, update it
                pattern.update(True)
                return

        # Extract keywords from input
        words = experience.input_summary.lower().split()
        keywords = [w for w in words if len(w) > 3][:5]

        if not keywords:
            return

        # Create new pattern
        pattern = Pattern(
            name=f"pattern_{len(self.patterns)}",
            description=f"Learned from: {experience.input_summary[:50]}",
            task_types=[experience.task_type],
            trigger_keywords=keywords,
            solution_template=experience.approach,
            confidence=0.6,
        )

        self.patterns.append(pattern)

        # Prune patterns if needed
        if len(self.patterns) > self.max_patterns:
            self.patterns.sort(key=lambda p: p.confidence * p.uses, reverse=True)
            self.patterns = self.patterns[:self.max_patterns]

    def find_similar_experiences(
        self,
        task_type: str,
        input_text: str,
        top_k: int = 5,
    ) -> list[Experience]:
        """Find similar past experiences."""
        candidates = self._experience_by_type.get(task_type, [])

        if not candidates:
            # Fall back to all experiences
            candidates = self.experiences

        # Simple keyword matching for similarity
        input_words = set(input_text.lower().split())

        scored = []
        for exp in candidates:
            exp_words = set(exp.input_summary.lower().split())
            overlap = len(input_words & exp_words)
            if overlap > 0:
                score = overlap / max(len(input_words), len(exp_words))
                scored.append((exp, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [exp for exp, _ in scored[:top_k]]

    def find_applicable_patterns(
        self,
        task_type: str,
        input_text: str,
        threshold: float = 0.3,
    ) -> list[tuple[Pattern, float]]:
        """Find patterns that might apply to this task."""
        matches = []

        for pattern in self.patterns:
            score = pattern.matches(task_type, input_text)
            if score >= threshold:
                matches.append((pattern, score))

        matches.sort(key=lambda x: x[1], reverse=True)
        return matches

    def get_strategy_history(self, strategy_id: str) -> list[Experience]:
        """Get all experiences for a strategy."""
        return self._experience_by_strategy.get(strategy_id, [])

    def get_learnings(self, task_type: Optional[str] = None) -> list[str]:
        """Get all learnings, optionally filtered by task type."""
        learnings = []

        if task_type:
            experiences = self._experience_by_type.get(task_type, [])
        else:
            experiences = self.experiences

        for exp in experiences:
            learnings.extend(exp.learnings)

        return list(set(learnings))  # Deduplicate

    def save(self) -> None:
        """Save memory to disk."""
        if not self.storage_path:
            return

        data = {
            "experiences": [e.to_dict() for e in self.experiences],
            "patterns": [p.to_dict() for p in self.patterns],
        }

        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.storage_path.write_text(json.dumps(data, indent=2))

    def load(self) -> None:
        """Load memory from disk."""
        if not self.storage_path or not self.storage_path.exists():
            return

        data = json.loads(self.storage_path.read_text())
        self.experiences = [
            Experience.from_dict(e) for e in data.get("experiences", [])
        ]
        self.patterns = [
            Pattern.from_dict(p) for p in data.get("patterns", [])
        ]
        self._rebuild_indices()

    def get_stats(self) -> dict[str, Any]:
        """Get memory statistics."""
        positive = sum(1 for e in self.experiences if e.is_positive)

        return {
            "total_experiences": len(self.experiences),
            "positive_experiences": positive,
            "negative_experiences": len(self.experiences) - positive,
            "total_patterns": len(self.patterns),
            "task_types": list(self._experience_by_type.keys()),
            "strategies_used": len(self._experience_by_strategy),
        }

    def clear(self) -> None:
        """Clear all memory."""
        self.experiences.clear()
        self.patterns.clear()
        self._experience_by_type.clear()
        self._experience_by_strategy.clear()
