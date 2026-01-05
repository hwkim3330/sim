"""
Action definitions for Simi Game SDK.
"""

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ActionSchema:
    """
    JSON Schema for action parameters.

    Example:
        >>> schema = ActionSchema(
        ...     type="object",
        ...     properties={
        ...         "target": {"type": "string", "enum": ["player", "enemy"]},
        ...         "amount": {"type": "integer", "minimum": 1}
        ...     },
        ...     required=["target"]
        ... )
    """
    type: str = "object"
    properties: dict[str, Any] = field(default_factory=dict)
    required: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        schema = {"type": self.type}
        if self.properties:
            schema["properties"] = self.properties
        if self.required:
            schema["required"] = self.required
        return schema


@dataclass
class Action:
    """
    An action that Simi can execute.

    Args:
        name: Unique action identifier
        description: Human-readable description (shown to Simi)
        schema: Optional JSON schema for parameters

    Example:
        >>> action = Action(
        ...     name="play_card",
        ...     description="Play a card from your hand",
        ...     schema=ActionSchema(
        ...         properties={"card_index": {"type": "integer"}},
        ...         required=["card_index"]
        ...     )
        ... )
    """
    name: str
    description: str
    schema: Optional[ActionSchema] = None

    def to_dict(self) -> dict[str, Any]:
        data = {
            "name": self.name,
            "description": self.description,
        }
        if self.schema:
            data["schema"] = self.schema.to_dict()
        return data

    @classmethod
    def simple(cls, name: str, description: str) -> "Action":
        """Create a simple action without parameters."""
        return cls(name=name, description=description)

    @classmethod
    def with_params(
        cls,
        name: str,
        description: str,
        params: dict[str, dict[str, Any]],
        required: Optional[list[str]] = None,
    ) -> "Action":
        """Create an action with parameter schema."""
        schema = ActionSchema(
            properties=params,
            required=required or [],
        )
        return cls(name=name, description=description, schema=schema)
