"""
Agent operating modes.
"""

from __future__ import annotations

from enum import Enum


class AgentMode(str, Enum):
    """
    Agent operating mode.

    BUILD: Full access to all tools (read, write, execute)
    PLAN: Read-only mode for research and planning
    """
    BUILD = "build"
    PLAN = "plan"

    @property
    def allowed_tools(self) -> list[str]:
        """Get list of allowed tool types for this mode."""
        if self == AgentMode.BUILD:
            return ["*"]  # All tools
        else:
            # Plan mode: read-only tools
            return [
                "read_file", "glob", "grep",
                "web_fetch", "web_search",
                "screenshot",
            ]

    @property
    def is_read_only(self) -> bool:
        """Check if this mode restricts write operations."""
        return self == AgentMode.PLAN

    @property
    def description(self) -> str:
        """Human-readable mode description."""
        if self == AgentMode.BUILD:
            return "Full access - can read, write, and execute"
        else:
            return "Read-only - research and planning mode"

    @property
    def system_prompt_addon(self) -> str:
        """Additional system prompt for this mode."""
        if self == AgentMode.PLAN:
            return """
You are in PLAN MODE. This means:
- You can ONLY read files, search code, and gather information
- You CANNOT write files, edit code, or execute commands
- Your goal is to understand the codebase and create a plan
- Summarize your findings and propose implementation steps
- The user will switch to BUILD mode to execute the plan
"""
        else:
            return """
You are in BUILD MODE. This means:
- You have full access to read, write, and execute
- You can edit files, run commands, and make changes
- Execute the plan carefully and verify each step
- Test your changes when appropriate
"""
