-- All chapters with FTS5 match counts for :theory.
-- Every chapter is included even when matches = 0 (LEFT JOIN ensures this).
-- Used by fetchTimeline() to build TimelinePanel grouped by book.
--
-- Parameter: :theory (FTS5 expression)

WITH matches AS (
  SELECT book_id, chapter_number, COUNT(*) AS match_count
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory
  GROUP BY book_id, chapter_number
)
SELECT
  c.chapter_id,
  c.book_id,
  c.chapter_number,
  c.title         AS chapter_title,
  b.title         AS book_title,
  COALESCE(m.match_count, 0) AS matches
FROM chapters c
JOIN books b ON b.book_id = c.book_id
LEFT JOIN matches m
  ON m.book_id = c.book_id AND m.chapter_number = c.chapter_number
ORDER BY c.book_id, c.chapter_number
