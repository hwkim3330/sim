"""
Theme configuration for Simi TUI.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Theme:
    """Color theme for TUI."""

    # Primary colors
    primary: str = "#7C3AED"      # Purple
    secondary: str = "#10B981"    # Green
    accent: str = "#F59E0B"       # Amber

    # Text colors
    text: str = "#E5E7EB"
    text_muted: str = "#9CA3AF"
    text_dim: str = "#6B7280"

    # Background
    bg: str = "#111827"
    bg_secondary: str = "#1F2937"
    bg_highlight: str = "#374151"

    # Status
    success: str = "#10B981"
    error: str = "#EF4444"
    warning: str = "#F59E0B"
    info: str = "#3B82F6"

    # Agent modes
    build_color: str = "#10B981"   # Green for build
    plan_color: str = "#3B82F6"    # Blue for plan

    # Borders
    border: str = "#374151"
    border_focus: str = "#7C3AED"


DEFAULT_THEME = Theme()

DARK_THEME = Theme(
    primary="#8B5CF6",
    secondary="#34D399",
    bg="#0F172A",
    bg_secondary="#1E293B",
)

LIGHT_THEME = Theme(
    primary="#7C3AED",
    secondary="#059669",
    text="#1F2937",
    text_muted="#4B5563",
    bg="#FFFFFF",
    bg_secondary="#F3F4F6",
    bg_highlight="#E5E7EB",
    border="#D1D5DB",
)
