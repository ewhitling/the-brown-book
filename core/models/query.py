from __future__ import annotations
from pydantic import BaseModel, Field
from .base import BookChapter
from .entities import PassageType, SceneMode


class ReadingPosition(BaseModel):
    """User's reading position. Inclusive ('I have finished reading
    through this chapter')."""
    book_id: int = Field(..., ge=1, le=5)
    chapter_number: int = Field(..., ge=1)

    def as_bookchapter(self) -> BookChapter:
        return BookChapter(book_id=self.book_id, chapter_number=self.chapter_number)


class Theory(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


# ── Passages panel ──────────────────────────────────────────────────────
class PassageChapter(BaseModel):
    book_id: int
    number: int
    title: str


class PassageItem(BaseModel):
    id: str                                       # e.g. "claim:412"
    type: PassageType
    text: str
    score: float                                  # FTS5 bm25
    chapter: PassageChapter
    scene_number: int | None = None
    past_horizon: bool
    revealed_at: BookChapter


class PassagesPanel(BaseModel):
    items: list[PassageItem]
    total_matching: int
    showing: int                                  # top-N (N=50 v1)


# ── Timeline panel ──────────────────────────────────────────────────────
class TimelineScene(BaseModel):
    scene_id: int
    number: int
    mode: SceneMode
    location_canonical: str | None = None
    location_raw: str
    summary: str
    past_horizon: bool
    matches_query: bool


class TimelineChapter(BaseModel):
    chapter_id: int
    number: int
    title: str
    past_horizon: bool
    matches: int                                  # count of matching items
    scenes: list[TimelineScene]                   # v1 deferred; populated lazily


class TimelineBook(BaseModel):
    book_id: int
    title: str
    chapters: list[TimelineChapter]


class TimelinePanel(BaseModel):
    books: list[TimelineBook]


# ── Characters panel ────────────────────────────────────────────────────
class CharacterNode(BaseModel):
    character_id: int
    canonical_name: str
    first_appearance: BookChapter
    past_horizon: bool
    scene_count_matching: int


class CharacterEdge(BaseModel):
    """Co-occurrence in matching scenes. Populated in v1 but unrendered
    (panel is list-only). Ready for v2 graph rendering."""
    source: int                                   # character_id
    target: int                                   # character_id
    weight: int
    past_horizon: bool


class CharactersPanel(BaseModel):
    nodes: list[CharacterNode]
    edges: list[CharacterEdge]


# ── Top-level query result ──────────────────────────────────────────────
class QueryResult(BaseModel):
    theory: Theory
    position: ReadingPosition
    passages_panel: PassagesPanel
    timeline_panel: TimelinePanel
    characters_panel: CharactersPanel
    had_matches_past_horizon: bool                # drives no-results CTA
