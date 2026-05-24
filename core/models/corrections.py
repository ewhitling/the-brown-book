from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Annotated, Literal, Union


EntityTargetType = Literal["character", "canonical_location"]
ClaimTargetType = Literal[
    "factual_claim", "notable_detail", "scene", "embedded_narrative", "death_event",
]


class MergeCorrection(BaseModel):
    """Merge multiple entities into one. Applied during apply-corrections;
    rewrites all FK references."""
    type: Literal["merge"] = "merge"
    target_type: EntityTargetType
    source_ids: list[int] = Field(..., min_length=2)
    into_id: int
    rationale: str
    submitted_by: str | None = None


class RenameCorrection(BaseModel):
    """Rename an entity's canonical name. Pure metadata change."""
    type: Literal["rename"] = "rename"
    target_type: EntityTargetType
    target_id: int
    new_name: str
    rationale: str
    submitted_by: str | None = None


class FactualFixCorrection(BaseModel):
    """Edit a specific field on a claim/detail/scene/etc.
    Most valuable user-flagged correction."""
    type: Literal["factual_fix"] = "factual_fix"
    target_type: ClaimTargetType
    target_id: int
    field: str
    old_value: str                                # safety check; reject on mismatch
    new_value: str
    rationale: str
    submitted_by: str | None = None


# Discriminated union — one of these per YAML file
Correction = Annotated[
    Union[MergeCorrection, RenameCorrection, FactualFixCorrection],
    Field(discriminator="type"),
]
