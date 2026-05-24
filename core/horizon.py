"""Spoiler-horizon helpers.

default_revealed_at  — look up a chapter's BookChapter position from the DB.
is_past_horizon      — check whether content is beyond a user's reading position.
"""
from __future__ import annotations

import sqlite3

from core.models.base import BookChapter
from core.models.query import ReadingPosition


def default_revealed_at(conn: sqlite3.Connection, chapter_id: int) -> BookChapter:
    """Return the BookChapter for a given chapter row.

    Reads book_id + chapter_number from the chapters table.

    Raises:
        KeyError: if chapter_id does not exist.
    """
    row = conn.execute(
        "SELECT book_id, chapter_number FROM chapters WHERE chapter_id = ?",
        (chapter_id,),
    ).fetchone()
    if row is None:
        raise KeyError(f"chapter_id {chapter_id} not found")
    return BookChapter(book_id=row[0], chapter_number=row[1])


def is_past_horizon(revealed_at: BookChapter, position: ReadingPosition) -> bool:
    """Return True if revealed_at is strictly after the user's reading position.

    The boundary is inclusive: content revealed at the exact chapter the user
    is on is NOT past the horizon.
    """
    pos_bc = position.as_bookchapter()
    return bool(pos_bc < revealed_at)
