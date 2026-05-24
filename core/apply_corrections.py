"""core/apply_corrections.py — apply corrections from YAML files to the DB.

Dispatches by correction type:
  merge       — rewrite FK references from source_ids → into_id, delete source rows
  rename      — update canonical_name / name field on target entity
  factual_fix — verify old_value matches DB, then update field (exit non-zero on mismatch)

Idempotent: safe to run multiple times against the same DB.

YAML format: each *.yaml file may contain either a single correction (mapping)
or a list of corrections. Subdirectories are scanned recursively so that
corrections/seed/*.yaml are included when corrections_dir is corrections/.
"""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import yaml
from pydantic import TypeAdapter, ValidationError

from core.models.corrections import (
    Correction,
    FactualFixCorrection,
    MergeCorrection,
    RenameCorrection,
)

# ---------------------------------------------------------------------------
# Table / column mappings
# ---------------------------------------------------------------------------

_ENTITY_TABLE: dict[str, str] = {
    "character": "characters",
    "canonical_location": "canonical_locations",
}

_ENTITY_NAME_COL: dict[str, str] = {
    "character": "canonical_name",
    "canonical_location": "name",
}

_ENTITY_FK: dict[str, tuple[str, str]] = {
    # entity_type → (fk_table, fk_column)
    "character": ("scene_characters", "character_id"),
    "canonical_location": ("location_mapping", "canonical_location_id"),
}

_CLAIM_TABLE: dict[str, str] = {
    "factual_claim": "factual_claims",
    "notable_detail": "notable_details",
    "scene": "scenes",
    "embedded_narrative": "embedded_narratives",
    "death_event": "death_events",
}

# ---------------------------------------------------------------------------
# Correction-type handlers
# ---------------------------------------------------------------------------


def _apply_merge(conn: sqlite3.Connection, c: MergeCorrection) -> None:
    """Rewrite FK references from source_ids → into_id, then delete source rows."""
    table = _ENTITY_TABLE[c.target_type]
    fk_table, fk_col = _ENTITY_FK[c.target_type]
    placeholders = ",".join("?" * len(c.source_ids))

    conn.execute(
        f"UPDATE {fk_table} SET {fk_col} = ? WHERE {fk_col} IN ({placeholders})",
        [c.into_id, *c.source_ids],
    )
    conn.execute(
        f"DELETE FROM {table} WHERE id IN ({placeholders})",
        c.source_ids,
    )
    conn.commit()


def _apply_rename(conn: sqlite3.Connection, c: RenameCorrection) -> None:
    """Update the canonical name field on the target entity."""
    table = _ENTITY_TABLE[c.target_type]
    name_col = _ENTITY_NAME_COL[c.target_type]

    conn.execute(
        f"UPDATE {table} SET {name_col} = ? WHERE id = ?",
        (c.new_name, c.target_id),
    )
    conn.commit()


def _coerce(value: str, reference: object) -> object:
    """Coerce a YAML string value to the native type of a DB column value.

    SQLite returns Python int/float for numeric columns. old_value and
    new_value are always strings in YAML. This lets seeds write
    `old_value: "1"` for an INTEGER column without a false mismatch.
    """
    if isinstance(reference, int):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if isinstance(reference, float):
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    return value


def _apply_factual_fix(
    conn: sqlite3.Connection, c: FactualFixCorrection, filename: str
) -> None:
    """Verify old_value matches DB, then update. Skips if already applied."""
    table = _CLAIM_TABLE[c.target_type]
    row = conn.execute(
        f"SELECT {c.field} FROM {table} WHERE id = ?", (c.target_id,)
    ).fetchone()

    current = row[0] if row else None
    old_coerced = _coerce(c.old_value, current)
    new_coerced = _coerce(c.new_value, current)

    if current == new_coerced:
        # Already applied — idempotent skip.
        return

    if current != old_coerced:
        msg = (
            f"{filename}: factual_fix mismatch on {table}.{c.field} id={c.target_id}\n"
            f"  expected: {c.old_value!r}\n"
            f"  found:    {current!r}"
        )
        print(msg, file=sys.stderr)
        sys.exit(1)

    conn.execute(
        f"UPDATE {table} SET {c.field} = ? WHERE id = ?",
        (new_coerced, c.target_id),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

_adapter: TypeAdapter[Correction] = TypeAdapter(Correction)


def _dispatch(
    conn: sqlite3.Connection, correction: Correction, filename: str
) -> None:
    """Dispatch a single validated correction to the appropriate handler."""
    if isinstance(correction, MergeCorrection):
        _apply_merge(conn, correction)
    elif isinstance(correction, RenameCorrection):
        _apply_rename(conn, correction)
    elif isinstance(correction, FactualFixCorrection):
        _apply_factual_fix(conn, correction, filename)


_DB_PATH = Path("data/botns.db")
_CORRECTIONS_DIR = Path("corrections")


def apply_corrections(conn: sqlite3.Connection, corrections_dir: Path) -> None:
    """Apply all *.yaml corrections under corrections_dir (recursive) to conn.

    Each file may contain a single correction mapping or a list of corrections.
    Seed files live in corrections/seed/ and are discovered automatically.

    Idempotent: running twice produces identical DB state.
    Exits non-zero on factual_fix mismatches or parse/validation errors.
    """
    for path in sorted(corrections_dir.glob("**/*.yaml")):
        try:
            raw = yaml.safe_load(path.read_text())
        except yaml.YAMLError as exc:
            raise ValueError(f"{path.name}: YAML parse error — {exc}") from exc

        items = raw if isinstance(raw, list) else [raw]
        for item in items:
            try:
                correction = _adapter.validate_python(item)
            except ValidationError as exc:
                raise ValueError(f"{path.name}: validation error — {exc}") from exc

            _dispatch(conn, correction, path.name)


def main() -> None:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        apply_corrections(conn, _CORRECTIONS_DIR)
    finally:
        conn.close()
    print(f"  Applied corrections from {_CORRECTIONS_DIR}/")


if __name__ == "__main__":
    main()
