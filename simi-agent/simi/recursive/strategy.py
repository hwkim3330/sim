"""
Strategy management and evolution for self-improving AI.

Strategies are reusable patterns that can be:
1. Mutated to explore new approaches
2. Combined (crossover) for hybrid solutions
3. Selected based on fitness scores
"""

from __future__ import annotations

import json
import random
import hashlib
from dataclasses import dataclass, field
from typing import Any, Optional
from pathlib import Path


@dataclass
class Strategy:
    """
    A strategy represents a specific approach to solving tasks.

    Attributes:
        id: Unique identifier
        name: Human-readable name
        description: What this strategy does
        parameters: Configurable parameters
        fitness: Performance score (0.0 to 1.0)
        uses: Number of times used
        successes: Number of successful uses
        lineage: Parent strategy IDs (for evolution tracking)
    """
    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)
    fitness: float = 0.5
    uses: int = 0
    successes: int = 0
    lineage: list[str] = field(default_factory=list)

    _id: Optional[str] = field(default=None, repr=False)

    @property
    def id(self) -> str:
        if self._id is None:
            # Generate ID from content hash
            content = f"{self.name}:{self.description}:{json.dumps(self.parameters, sort_keys=True)}"
            self._id = hashlib.sha256(content.encode()).hexdigest()[:12]
        return self._id

    @property
    def success_rate(self) -> float:
        if self.uses == 0:
            return 0.5  # Prior
        return self.successes / self.uses

    def update_fitness(self, success: bool, reward: float = 1.0) -> None:
        """Update fitness based on task outcome."""
        self.uses += 1
        if success:
            self.successes += 1

        # Exponential moving average with decay
        alpha = 0.2  # Learning rate
        outcome = reward if success else -reward * 0.5
        self.fitness = self.fitness * (1 - alpha) + (0.5 + outcome * 0.5) * alpha
        self.fitness = max(0.0, min(1.0, self.fitness))

    def mutate(self, mutation_rate: float = 0.1) -> Strategy:
        """Create a mutated copy of this strategy."""
        new_params = self.parameters.copy()

        for key, value in new_params.items():
            if random.random() < mutation_rate:
                if isinstance(value, float):
                    # Gaussian mutation for floats
                    new_params[key] = value + random.gauss(0, 0.2)
                elif isinstance(value, int):
                    # Integer mutation
                    new_params[key] = value + random.randint(-2, 2)
                elif isinstance(value, bool):
                    # Flip boolean
                    new_params[key] = not value
                elif isinstance(value, str):
                    # Keep strings unchanged (domain-specific)
                    pass

        return Strategy(
            name=f"{self.name}_mutant",
            description=f"Mutated from: {self.description}",
            parameters=new_params,
            fitness=self.fitness * 0.9,  # Slight penalty for new variant
            lineage=self.lineage + [self.id],
        )

    @staticmethod
    def crossover(parent1: Strategy, parent2: Strategy) -> Strategy:
        """Create a new strategy by combining two parents."""
        # Merge parameters
        new_params = {}
        all_keys = set(parent1.parameters.keys()) | set(parent2.parameters.keys())

        for key in all_keys:
            if key in parent1.parameters and key in parent2.parameters:
                # Randomly choose from parents
                new_params[key] = random.choice([
                    parent1.parameters[key],
                    parent2.parameters[key]
                ])
            elif key in parent1.parameters:
                new_params[key] = parent1.parameters[key]
            else:
                new_params[key] = parent2.parameters[key]

        # Combine descriptions
        avg_fitness = (parent1.fitness + parent2.fitness) / 2

        return Strategy(
            name=f"{parent1.name}x{parent2.name}",
            description=f"Crossover of {parent1.name} and {parent2.name}",
            parameters=new_params,
            fitness=avg_fitness * 0.95,
            lineage=[parent1.id, parent2.id],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "fitness": self.fitness,
            "uses": self.uses,
            "successes": self.successes,
            "lineage": self.lineage,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Strategy:
        strategy = cls(
            name=data["name"],
            description=data["description"],
            parameters=data.get("parameters", {}),
            fitness=data.get("fitness", 0.5),
            lineage=data.get("lineage", []),
        )
        strategy.uses = data.get("uses", 0)
        strategy.successes = data.get("successes", 0)
        strategy._id = data.get("id")
        return strategy


class StrategyEvolver:
    """
    Evolutionary strategy optimizer.

    Uses genetic algorithm concepts:
    - Selection: Choose best performers
    - Crossover: Combine successful strategies
    - Mutation: Introduce random variations
    - Elitism: Keep top performers unchanged
    """

    def __init__(
        self,
        population_size: int = 20,
        elite_size: int = 3,
        mutation_rate: float = 0.15,
        crossover_rate: float = 0.3,
    ):
        self.population_size = population_size
        self.elite_size = elite_size
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate

        self.population: list[Strategy] = []
        self.generation = 0
        self.best_fitness_history: list[float] = []

        # Initialize with default strategies
        self._init_default_strategies()

    def _init_default_strategies(self) -> None:
        """Initialize population with diverse default strategies."""
        defaults = [
            Strategy(
                name="step_by_step",
                description="Break down tasks into small steps",
                parameters={
                    "max_steps": 10,
                    "verify_each_step": True,
                    "rollback_on_error": True,
                },
                fitness=0.6,
            ),
            Strategy(
                name="aggressive",
                description="Try to solve in one shot",
                parameters={
                    "max_retries": 3,
                    "fast_fail": True,
                    "skip_verification": False,
                },
                fitness=0.5,
            ),
            Strategy(
                name="conservative",
                description="Extra careful with verification",
                parameters={
                    "double_check": True,
                    "create_backup": True,
                    "ask_confirmation": True,
                },
                fitness=0.55,
            ),
            Strategy(
                name="exploratory",
                description="Explore options before committing",
                parameters={
                    "explore_alternatives": 3,
                    "dry_run_first": True,
                    "explain_reasoning": True,
                },
                fitness=0.5,
            ),
            Strategy(
                name="pattern_match",
                description="Look for similar past solutions",
                parameters={
                    "use_memory": True,
                    "similarity_threshold": 0.7,
                    "adapt_from_similar": True,
                },
                fitness=0.55,
            ),
        ]

        self.population = defaults

        # Fill remaining population with mutations
        while len(self.population) < self.population_size:
            parent = random.choice(defaults)
            self.population.append(parent.mutate(self.mutation_rate))

    def select(self, num: int = 5) -> list[Strategy]:
        """Tournament selection: choose best from random subsets."""
        selected = []

        for _ in range(num):
            # Random tournament
            tournament = random.sample(
                self.population,
                min(3, len(self.population))
            )
            winner = max(tournament, key=lambda s: s.fitness)
            selected.append(winner)

        return selected

    def evolve(self) -> None:
        """Perform one generation of evolution."""
        self.generation += 1

        # Sort by fitness
        self.population.sort(key=lambda s: s.fitness, reverse=True)

        # Track best
        self.best_fitness_history.append(self.population[0].fitness)

        # Elitism: keep top performers
        new_population = self.population[:self.elite_size]

        # Generate offspring
        while len(new_population) < self.population_size:
            if random.random() < self.crossover_rate and len(self.population) >= 2:
                # Crossover
                parents = self.select(2)
                child = Strategy.crossover(parents[0], parents[1])
            else:
                # Selection + Mutation
                parent = self.select(1)[0]
                child = parent.mutate(self.mutation_rate)

            new_population.append(child)

        self.population = new_population[:self.population_size]

    def get_best(self, n: int = 1) -> list[Strategy]:
        """Get top n strategies by fitness."""
        sorted_pop = sorted(self.population, key=lambda s: s.fitness, reverse=True)
        return sorted_pop[:n]

    def get_strategy_for_task(self, task_type: str) -> Strategy:
        """Select a strategy based on task type and fitness."""
        # Weight by fitness for selection probability
        total_fitness = sum(s.fitness for s in self.population)
        if total_fitness == 0:
            return random.choice(self.population)

        # Roulette wheel selection
        r = random.uniform(0, total_fitness)
        cumulative = 0
        for strategy in self.population:
            cumulative += strategy.fitness
            if cumulative >= r:
                return strategy

        return self.population[-1]

    def report_outcome(self, strategy_id: str, success: bool, reward: float = 1.0) -> None:
        """Report task outcome for a strategy."""
        for strategy in self.population:
            if strategy.id == strategy_id:
                strategy.update_fitness(success, reward)
                break

    def save(self, path: Path) -> None:
        """Save evolver state to file."""
        data = {
            "generation": self.generation,
            "population": [s.to_dict() for s in self.population],
            "best_fitness_history": self.best_fitness_history,
            "config": {
                "population_size": self.population_size,
                "elite_size": self.elite_size,
                "mutation_rate": self.mutation_rate,
                "crossover_rate": self.crossover_rate,
            }
        }
        path.write_text(json.dumps(data, indent=2))

    def load(self, path: Path) -> None:
        """Load evolver state from file."""
        if not path.exists():
            return

        data = json.loads(path.read_text())
        self.generation = data.get("generation", 0)
        self.best_fitness_history = data.get("best_fitness_history", [])
        self.population = [
            Strategy.from_dict(s) for s in data.get("population", [])
        ]

        config = data.get("config", {})
        self.population_size = config.get("population_size", self.population_size)
        self.elite_size = config.get("elite_size", self.elite_size)
        self.mutation_rate = config.get("mutation_rate", self.mutation_rate)
        self.crossover_rate = config.get("crossover_rate", self.crossover_rate)

    def get_stats(self) -> dict[str, Any]:
        """Get evolution statistics."""
        return {
            "generation": self.generation,
            "population_size": len(self.population),
            "best_fitness": self.population[0].fitness if self.population else 0,
            "avg_fitness": sum(s.fitness for s in self.population) / len(self.population) if self.population else 0,
            "total_uses": sum(s.uses for s in self.population),
            "best_strategy": self.population[0].name if self.population else None,
        }
