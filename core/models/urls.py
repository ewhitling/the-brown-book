from __future__ import annotations
from urllib.parse import urlencode, parse_qs
from pydantic import BaseModel
from .base import BookChapter
from .query import Theory, ReadingPosition


class WorkshopURL(BaseModel):
    theory: Theory
    position: ReadingPosition

    def encode(self) -> str:
        return "?" + urlencode({
            "q": self.theory.text,
            "pos": self.position.as_bookchapter().compact(),
        })

    @classmethod
    def decode(cls, qs: str) -> "WorkshopURL | None":
        params = parse_qs(qs.lstrip("?"))
        q = params.get("q", [None])[0]
        pos = params.get("pos", [None])[0]
        if not q or not pos:
            return None
        bc = BookChapter.from_compact(pos)
        return cls(
            theory=Theory(text=q),
            position=ReadingPosition(book_id=bc.book_id, chapter_number=bc.chapter_number),
        )
