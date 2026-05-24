-- Co-occurrence edges between characters in scenes matching :theory.
-- Only includes pairs where both characters have canonical records
-- (first_appearance = 1). Edge past_horizon is determined by the minimum
-- revealed_at across all co-occurring scenes (computed in JavaScript).
--
-- Parameter: :theory (FTS5 expression)

WITH matching_scene_ids AS (
  SELECT CAST(substr(ref, instr(ref, ':') + 1) AS INTEGER) AS scene_id
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory AND source_type = 'scene'
),
char_pairs AS (
  SELECT
    a.name        AS name_a,
    b.name        AS name_b,
    COUNT(*)      AS weight,
    MIN(s.revealed_at_book)    AS min_rev_book,
    MIN(s.revealed_at_chapter) AS min_rev_chapter
  FROM scene_characters a
  JOIN scene_characters b
    ON a.scene_id = b.scene_id AND a.name < b.name
  JOIN scenes s ON s.id = a.scene_id
  WHERE a.scene_id IN (SELECT scene_id FROM matching_scene_ids)
  GROUP BY a.name, b.name
)
SELECT
  ca.id  AS source_id,
  cb.id  AS target_id,
  cp.weight,
  cp.min_rev_book,
  cp.min_rev_chapter
FROM char_pairs cp
JOIN characters ca ON ca.id = (
  SELECT MIN(id) FROM characters
  WHERE name = cp.name_a AND first_appearance = 1
)
JOIN characters cb ON cb.id = (
  SELECT MIN(id) FROM characters
  WHERE name = cp.name_b AND first_appearance = 1
)
