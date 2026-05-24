-- Characters appearing in scenes that match :theory.
-- Joins to the canonical character record (MIN id where first_appearance = 1)
-- to ensure one node per character name with valid first-appearance coordinates.
-- Sorted by scene_count_matching DESC.
--
-- Parameter: :theory (FTS5 expression)

WITH matching_scene_ids AS (
  SELECT CAST(substr(ref, instr(ref, ':') + 1) AS INTEGER) AS scene_id
  FROM evidence_fts
  WHERE evidence_fts MATCH :theory AND source_type = 'scene'
),
char_counts AS (
  SELECT sc.name, COUNT(DISTINCT sc.scene_id) AS scene_count
  FROM scene_characters sc
  WHERE sc.scene_id IN (SELECT scene_id FROM matching_scene_ids)
  GROUP BY sc.name
)
SELECT
  c.id              AS character_id,
  c.name            AS canonical_name,
  c.mentioned_at_book,
  c.mentioned_at_chapter,
  cc.scene_count    AS scene_count_matching
FROM char_counts cc
JOIN characters c ON c.id = (
  SELECT MIN(id) FROM characters
  WHERE name = cc.name AND first_appearance = 1
)
ORDER BY cc.scene_count DESC
