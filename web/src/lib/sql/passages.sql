-- Fetch top-N FTS5 passages matching :theory.
-- Returns source_type, ref, body, score, chapter metadata, and revealed_at
-- coordinates for spoiler-horizon post-processing in JavaScript.
--
-- Parameters: :theory (FTS5 expression), :top_n (integer LIMIT)

WITH top_matches AS (
  SELECT
    source_type,
    ref,
    book_id,
    chapter_number,
    body,
    bm25(evidence_fts) AS score
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory
  ORDER BY bm25(evidence_fts)
  LIMIT :top_n
)
SELECT
  m.source_type,
  m.ref,
  m.book_id,
  m.chapter_number,
  m.body,
  m.score,
  c.chapter_id,
  c.title         AS chapter_title,
  CASE
    WHEN m.source_type IN ('chapter', 'summary') THEN m.book_id
    WHEN m.source_type = 'factual_claim'         THEN fc.revealed_at_book
    WHEN m.source_type = 'notable_detail'        THEN nd.revealed_at_book
    WHEN m.source_type = 'scene'                 THEN s.revealed_at_book
    WHEN m.source_type = 'embedded_narrative'    THEN en.revealed_at_book
    ELSE m.book_id
  END             AS revealed_at_book,
  CASE
    WHEN m.source_type IN ('chapter', 'summary') THEN m.chapter_number
    WHEN m.source_type = 'factual_claim'         THEN fc.revealed_at_chapter
    WHEN m.source_type = 'notable_detail'        THEN nd.revealed_at_chapter
    WHEN m.source_type = 'scene'                 THEN s.revealed_at_chapter
    WHEN m.source_type = 'embedded_narrative'    THEN en.revealed_at_chapter
    ELSE m.chapter_number
  END             AS revealed_at_chapter,
  s.scene_number
FROM top_matches m
JOIN chapters c
  ON c.book_id = m.book_id AND c.chapter_number = m.chapter_number
LEFT JOIN factual_claims fc
  ON m.source_type = 'factual_claim'
  AND fc.id = CAST(substr(m.ref, instr(m.ref, ':') + 1) AS INTEGER)
LEFT JOIN notable_details nd
  ON m.source_type = 'notable_detail'
  AND nd.id = CAST(substr(m.ref, instr(m.ref, ':') + 1) AS INTEGER)
LEFT JOIN scenes s
  ON m.source_type = 'scene'
  AND s.id = CAST(substr(m.ref, instr(m.ref, ':') + 1) AS INTEGER)
LEFT JOIN embedded_narratives en
  ON m.source_type = 'embedded_narrative'
  AND en.id = CAST(substr(m.ref, instr(m.ref, ':') + 1) AS INTEGER)
