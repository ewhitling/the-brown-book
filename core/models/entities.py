from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal
from .base import BookChapter


SceneMode = Literal["action", "dialogue", "reflection", "embedded_story", "dream", "description"]
LocationType = Literal[
    "nation", "city", "building", "district",
    "body_of_water", "landscape", "world", "other",
]
DeathOutcome = Literal["final", "prevented", "reversed", "figurative", "ambiguous"]
EpistemicTier = Literal["observed", "reported", "hinted", "claimed"]
PassageType = Literal["prose", "summary", "claim", "scene", "detail", "embedded"]


class Book(BaseModel):
    id: int
    number: int = Field(..., ge=1, le=5)
    title: str
    chapter_count: int


class Chapter(BaseModel):
    id: int
    book_id: int                                  # FK -> Book.id
    number: int = Field(..., ge=1)
    title: str
    scene_count: int = 0


class Scene(BaseModel):
    id: int
    chapter_id: int                               # FK -> Chapter.id
    number: int = Field(..., ge=1)
    summary: str
    mode: SceneMode
    location_raw: str
    canonical_location_id: int | None = None      # FK -> CanonicalLocation.id
    time_context: str | None = None
    travel_direction: str | None = None
    character_ids: list[int] = Field(default_factory=list)
    revealed_at: BookChapter                      # default = source chapter


class CanonicalLocation(BaseModel):
    id: int
    name: str
    type: LocationType
    parent_id: int | None = None                  # self-FK for hierarchy
    temporal_note: str | None = None


class Character(BaseModel):
    id: int
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    mentioned_at: BookChapter                     # auto: first-appearance chapter


class FactualClaim(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    text: str
    attribution: str | None = None
    revealed_at: BookChapter                      # default = source chapter


class NotableDetail(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    text: str
    revealed_at: BookChapter


class EmbeddedNarrative(BaseModel):
    id: int
    chapter_id: int
    summary: str
    narrator: str | None = None
    character_ids: list[int] = Field(default_factory=list)
    revealed_at: BookChapter


class DeathEvent(BaseModel):
    id: int
    chapter_id: int
    scene_id: int | None = None
    subject: str
    outcome: DeathOutcome
    mechanism: str
    epistemic_tier: EpistemicTier
    revealed_at: BookChapter
