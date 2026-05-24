"""Validate that all YAML blocks in CONTRIBUTING.md parse as valid Corrections.

Acceptance criterion for TASK-030: "All example YAML in CONTRIBUTING validates
against the Correction union."
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import TypeAdapter, ValidationError

from core.models.corrections import Correction

CONTRIBUTING_PATH = Path(__file__).parent.parent / "CONTRIBUTING.md"
YAML_BLOCK_RE = re.compile(r"```yaml\n(.*?)```", re.DOTALL)


def _load_correction_blocks() -> list[dict[str, Any]]:
    """Extract and parse all ```yaml blocks from CONTRIBUTING.md."""
    if not CONTRIBUTING_PATH.exists():
        return []
    text = CONTRIBUTING_PATH.read_text()
    raw_blocks = YAML_BLOCK_RE.findall(text)
    parsed: list[dict[str, Any]] = []
    for block in raw_blocks:
        obj = yaml.safe_load(block)
        if obj is None:
            continue
        if isinstance(obj, list):
            parsed.extend(obj)
        else:
            parsed.append(obj)
    return parsed


_BLOCKS = _load_correction_blocks()
_BLOCK_IDS = [b.get("type", f"block_{i}") for i, b in enumerate(_BLOCKS)]


def test_contributing_has_yaml_examples() -> None:
    """CONTRIBUTING.md must contain at least one example per correction type."""
    types_present = {b.get("type") for b in _BLOCKS}
    expected = {"factual_fix", "merge", "rename"}
    missing = expected - types_present
    assert not missing, (
        f"CONTRIBUTING.md is missing YAML examples for types: {missing}. "
        f"Found types: {types_present}"
    )


@pytest.mark.parametrize("block", _BLOCKS, ids=_BLOCK_IDS)
def test_yaml_block_validates_as_correction(block: dict[str, Any]) -> None:
    """Each YAML block in CONTRIBUTING.md must validate against the Correction union."""
    adapter: TypeAdapter[Correction] = TypeAdapter(Correction)
    try:
        adapter.validate_python(block)
    except ValidationError as exc:
        pytest.fail(
            f"YAML block failed Correction validation.\n"
            f"  block: {block}\n"
            f"  error: {exc}"
        )
