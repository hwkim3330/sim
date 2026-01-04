"""
Recursive Self-Improving AI System.

This module implements a self-improving agent that:
1. Evaluates its own performance on tasks
2. Evolves strategies based on feedback
3. Stores successful patterns in memory
4. Recursively improves through meta-learning

Architecture:
    SelfImprovingAgent
        ├── StrategyEvolver (evolutionary optimization)
        ├── PerformanceTracker (evaluation & metrics)
        ├── MemoryBank (persistent experience storage)
        └── MetaLearner (learns how to learn)
"""

from simi.recursive.agent import SelfImprovingAgent, RecursiveConfig
from simi.recursive.strategy import Strategy, StrategyEvolver
from simi.recursive.evaluator import PerformanceTracker, TaskResult
from simi.recursive.memory import MemoryBank, Experience

__all__ = [
    "SelfImprovingAgent",
    "RecursiveConfig",
    "Strategy",
    "StrategyEvolver",
    "PerformanceTracker",
    "TaskResult",
    "MemoryBank",
    "Experience",
]
