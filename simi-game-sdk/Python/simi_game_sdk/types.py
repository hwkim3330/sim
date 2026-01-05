"""
Type definitions for Simi Game SDK.
"""

from enum import Enum
from typing import Any, Callable, Coroutine, Optional
from dataclasses import dataclass


class Priority(Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Capability(Enum):
    ACTIONS = "actions"
    CONTEXT = "context"
    VISION = "vision"
    QUERY = "query"


@dataclass
class ActionRequest:
    """Incoming action request from Simi."""
    id: str
    name: str
    params: dict[str, Any]


@dataclass
class QueryRequest:
    """Incoming query from Simi."""
    id: str
    question: str


@dataclass
class SpeakEvent:
    """Simi wants to speak."""
    message: str
    emotion: Optional[str] = None


# Callback types
ActionHandler = Callable[[ActionRequest], Coroutine[Any, Any, None]]
QueryHandler = Callable[[QueryRequest], Coroutine[Any, Any, str]]
SpeakHandler = Callable[[SpeakEvent], Coroutine[Any, Any, None]]
