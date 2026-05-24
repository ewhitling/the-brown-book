/**
 * TypeScript mirrors of core/models/ Pydantic models.
 * TASK-016: Hand-mirrors BookChapter, ReadingPosition, Theory, PassageItem,
 * PassagesPanel, Timeline*, CharacterNode, CharacterEdge, CharactersPanel,
 * QueryResult, and Correction discriminated union.
 *
 * Also exports assertSchema() — boot-time DB schema validator.
 */

// ─── Literal unions ───────────────────────────────────────────────────────────

/** Mirrors entities.py::PassageType */
export type PassageType =
  | 'prose'
  | 'summary'
  | 'claim'
  | 'scene'
  | 'detail'
  | 'embedded';

/** Mirrors entities.py::SceneMode */
export type SceneMode =
  | 'action'
  | 'dialogue'
  | 'reflection'
  | 'embedded_story'
  | 'dream'
  | 'description';

/** Mirrors corrections.py::EntityTargetType */
export type EntityTargetType = 'character' | 'canonical_location';

/** Mirrors corrections.py::ClaimTargetType */
export type ClaimTargetType =
  | 'factual_claim'
  | 'notable_detail'
  | 'scene'
  | 'embedded_narrative'
  | 'death_event';

// ─── Base ────────────────────────────────────────────────────────────────────

/** Position in the corpus. Mirrors core/models/base.py::BookChapter. */
export interface BookChapter {
  book_id: number;
  chapter_number: number;
}

// ─── Query inputs ─────────────────────────────────────────────────────────────

/** User's reading progress. Mirrors core/models/query.py::ReadingPosition. */
export interface ReadingPosition {
  book_id: number;
  chapter_number: number;
}

/** Free-text theory. Mirrors core/models/query.py::Theory. */
export interface Theory {
  text: string;
}

// ─── Passages panel ───────────────────────────────────────────────────────────

/** Chapter metadata on a passage result. Mirrors query.py::PassageChapter. */
export interface PassageChapter {
  book_id: number;
  number: number;
  title: string;
}

/** A single FTS result. Mirrors core/models/query.py::PassageItem. */
export interface PassageItem {
  id: string;
  type: PassageType;
  text: string;
  score: number;
  chapter: PassageChapter;
  scene_number: number | null;
  past_horizon: boolean;
  revealed_at: BookChapter;
}

/** Mirrors core/models/query.py::PassagesPanel. */
export interface PassagesPanel {
  items: PassageItem[];
  total_matching: number;
  showing: number;
}

// ─── Timeline panel ───────────────────────────────────────────────────────────

/** Mirrors core/models/query.py::TimelineScene. */
export interface TimelineScene {
  scene_id: number;
  number: number;
  mode: SceneMode;
  location_canonical: string | null;
  location_raw: string;
  summary: string;
  past_horizon: boolean;
  matches_query: boolean;
}

/** Mirrors core/models/query.py::TimelineChapter. */
export interface TimelineChapter {
  chapter_id: number;
  number: number;
  title: string;
  past_horizon: boolean;
  matches: number;
  scenes: TimelineScene[];
}

/** Mirrors core/models/query.py::TimelineBook. */
export interface TimelineBook {
  book_id: number;
  title: string;
  chapters: TimelineChapter[];
}

/** Mirrors core/models/query.py::TimelinePanel. */
export interface TimelinePanel {
  books: TimelineBook[];
}

// ─── Characters panel ─────────────────────────────────────────────────────────

/** Mirrors core/models/query.py::CharacterNode. */
export interface CharacterNode {
  character_id: number;
  canonical_name: string;
  first_appearance: BookChapter;
  past_horizon: boolean;
  scene_count_matching: number;
}

/** Co-occurrence edge. Mirrors core/models/query.py::CharacterEdge. */
export interface CharacterEdge {
  source: number;
  target: number;
  weight: number;
  past_horizon: boolean;
}

/** Mirrors core/models/query.py::CharactersPanel. */
export interface CharactersPanel {
  nodes: CharacterNode[];
  edges: CharacterEdge[];
}

// ─── Top-level query result ───────────────────────────────────────────────────

/** Mirrors core/models/query.py::QueryResult. */
export interface QueryResult {
  theory: Theory;
  position: ReadingPosition;
  passages_panel: PassagesPanel;
  timeline_panel: TimelinePanel;
  characters_panel: CharactersPanel;
  had_matches_past_horizon: boolean;
}

// ─── Corrections discriminated union ─────────────────────────────────────────

/** Mirrors core/models/corrections.py::MergeCorrection. */
export interface MergeCorrection {
  type: 'merge';
  target_type: EntityTargetType;
  source_ids: number[];
  into_id: number;
  rationale: string;
  submitted_by: string | null;
}

/** Mirrors core/models/corrections.py::RenameCorrection. */
export interface RenameCorrection {
  type: 'rename';
  target_type: EntityTargetType;
  target_id: number;
  new_name: string;
  rationale: string;
  submitted_by: string | null;
}

/** Mirrors core/models/corrections.py::FactualFixCorrection. */
export interface FactualFixCorrection {
  type: 'factual_fix';
  target_type: ClaimTargetType;
  target_id: number;
  field: string;
  old_value: string;
  new_value: string;
  rationale: string;
  submitted_by: string | null;
}

/** Discriminated union of all correction kinds. Mirrors corrections.py::Correction. */
export type Correction = MergeCorrection | RenameCorrection | FactualFixCorrection;

// ─── assertSchema() ───────────────────────────────────────────────────────────

/** Minimal sql.js Database surface required by assertSchema(). */
export interface Database {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
}

/**
 * Required tables and columns checked at boot.
 * Matches the live botns.db structure; update here when schema migrates.
 */
const REQUIRED_SCHEMA: Record<string, string[]> = {
  chapters: [
    'chapter_id',
    'book_id',
    'chapter_number',
    'title',
    'text',
    'summary',
    'word_count',
    'source_file',
  ],
  scenes: [
    'id',
    'chapter_id',
    'scene_number',
    'summary',
    'location',
    'time_context',
    'travel_direction',
    'narrative_mode',
    'revealed_at_book',
    'revealed_at_chapter',
  ],
  characters: [
    'id',
    'chapter_id',
    'name',
    'description',
    'first_appearance',
    'mentioned_at_book',
    'mentioned_at_chapter',
  ],
  factual_claims: [
    'id',
    'chapter_id',
    'claim',
    'revealed_at_book',
    'revealed_at_chapter',
  ],
  evidence_fts: [
    'rowid',
    'source_type',
    'ref',
    'book_id',
    'chapter_number',
    'locator',
    'body',
  ],
};

/**
 * Validates that db has the expected schema for the brown book query engine.
 * Runs at boot; logs console.error on drift but never throws.
 * The tool continues to load but degrades gracefully on mismatch.
 *
 * @returns true if all required tables and columns are present; false on drift.
 */
export function assertSchema(db: Database): boolean {
  let ok = true;

  for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
    const result = db.exec(`PRAGMA table_info(${table})`);

    if (result.length === 0) {
      console.error(`[assertSchema] Missing required table: ${table}`);
      ok = false;
      continue;
    }

    const nameIdx = result[0].columns.indexOf('name');
    const present = new Set(result[0].values.map((row) => row[nameIdx] as string));

    for (const col of requiredCols) {
      if (!present.has(col)) {
        console.error(`[assertSchema] Missing required column: ${table}.${col}`);
        ok = false;
      }
    }
  }

  return ok;
}
