from __future__ import annotations
import re
from pydantic import BaseModel, Field


class BookChapter(BaseModel):
    """A position in the corpus — (book_id, chapter_number). Used for
    spoiler-horizon comparisons. Comparable, has compact URL form."""
    book_id: int = Field(..., ge=1, le=5)
    chapter_number: int = Field(..., ge=1)

    def __lt__(self, other: "BookChapter") -> bool:
        return (self.book_id, self.chapter_number) < (other.book_id, other.chapter_number)

    def __le__(self, other: "BookChapter") -> bool:
        return (self.book_id, self.chapter_number) <= (other.book_id, other.chapter_number)

    def compact(self) -> str:
        """e.g. 'B2C5'."""
        return f"B{self.book_id}C{self.chapter_number}"

    @classmethod
    def from_compact(cls, s: str) -> "BookChapter":
        m = re.match(r"^B(\d+)C(\d+)$", s)
        if not m:
            raise ValueError(f"invalid compact position: {s}")
        return cls(book_id=int(m.group(1)), chapter_number=int(m.group(2)))
