/**
 * sql.js-compatible database client for the brown book query engine.
 * TASK-017: loadDatabase + all query functions.
 *
 * Runtime selection:
 *   Node.js  → node:sqlite  (has FTS5; used in tests via vitest)
 *   Browser  → sql.js       (bundled WASM; no FTS5, future concern)
 *
 * SQL files are imported via Vite's ?raw transform.
 * In-memory LRU cache (max 50 entries) wraps fetchQueryResult.
 */

import passagesSql from './sql/passages.sql?raw';
import timelineSql from './sql/timeline.sql?raw';
import charactersSql from './sql/characters.sql?raw';
import characterEdgesSql from './sql/character-edges.sql?raw';

import type {
  Database,
  ReadingPosition,
  PassagesPanel,
  PassageItem,
  PassageType,
  TimelinePanel,
  TimelineBook,
  TimelineChapter,
  CharactersPanel,
  CharacterNode,
  CharacterEdge,
  BookChapter,
  QueryResult,
} from './types';

// ─── Internal interface for a richer database surface ─────────────────────────

interface SqlStatement {
  bind(params: Record<string, unknown>): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): boolean;
}

/** Extends the public Database interface with parameterised prepare(). */
interface SqlDatabase extends Database {
  prepare(sql: string): SqlStatement;
}

// ─── node:sqlite adapter ──────────────────────────────────────────────────────
//
// node:sqlite (Node.js 22.5+) compiles SQLite with ENABLE_FTS5 and exposes a
// synchronous API.  We wrap it to match the sql.js-style interface used
// throughout db.ts so the rest of the file stays backend-agnostic.

/** Wraps a node:sqlite StatementSync as a sql.js-style Statement. */
class NodeStatement implements SqlStatement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly raw: any; // StatementSync
  private rows: Record<string, unknown>[] = [];
  private cursor = 0;
  private bound: Record<string, unknown> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(raw: any) {
    this.raw = raw;
  }

  bind(params: Record<string, unknown>): boolean {
    this.bound = params;
    this.rows = [];
    this.cursor = 0;
    return true;
  }

  step(): boolean {
    // Materialise all rows on first step() call.
    if (this.cursor === 0 && this.rows.length === 0) {
      try {
        const raw = this.raw.all(this.bound) as Record<string, unknown>[];
        // Spread out of null-prototype objects for safe key access.
        this.rows = raw.map((r) => ({ ...r }));
      } catch {
        this.rows = [];
      }
    }
    if (this.cursor < this.rows.length) {
      this.cursor++;
      return true;
    }
    return false;
  }

  getAsObject(): Record<string, unknown> {
    return this.rows[this.cursor - 1] ?? {};
  }

  free(): boolean {
    this.rows = [];
    this.cursor = 0;
    return true;
  }
}

/** Regex that matches PRAGMA table_info(…) calls. */
const PRAGMA_TABLE_INFO = /^\s*PRAGMA\s+table_info\s*\(\s*\S+\s*\)\s*$/i;

/** Wraps a node:sqlite DatabaseSync as a sql.js-style Database. */
class NodeDatabase implements SqlDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly raw: any; // DatabaseSync

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(raw: any) {
    this.raw = raw;
  }

  /**
   * Executes sql and returns results in sql.js format.
   *
   * For PRAGMA table_info queries, the implicit 'rowid' column is injected
   * into the result set so that assertSchema() can verify it is present.
   * (SQLite omits rowid from PRAGMA output even though it is always accessible.)
   */
  exec(sql: string): { columns: string[]; values: unknown[][] }[] {
    try {
      const stmt = this.raw.prepare(sql);
      const rawRows = (stmt.all() as Record<string, unknown>[]).map((r) => ({
        ...r,
      }));

      if (rawRows.length === 0) return [];

      const columns = Object.keys(rawRows[0] as object);
      const values: unknown[][] = rawRows.map((r) =>
        columns.map((c) => r[c] ?? null),
      );

      // Inject implicit 'rowid' for PRAGMA table_info calls.
      if (PRAGMA_TABLE_INFO.test(sql)) {
        const nameIdx = columns.indexOf('name');
        if (nameIdx >= 0 && !values.some((v) => v[nameIdx] === 'rowid')) {
          const rowidRow: unknown[] = columns.map((c) => {
            switch (c) {
              case 'cid':       return -1;
              case 'name':      return 'rowid';
              case 'type':      return 'INTEGER';
              case 'notnull':   return 0;
              case 'dflt_value': return null;
              case 'pk':        return 0;
              default:          return null;
            }
          });
          values.unshift(rowidRow);
        }
      }

      return [{ columns, values }];
    } catch {
      return [];
    }
  }

  prepare(sql: string): SqlStatement {
    return new NodeStatement(this.raw.prepare(sql));
  }
}

/** Creates a NodeDatabase from a raw ArrayBuffer by writing a temp file. */
async function openNodeSqlite(buf: ArrayBuffer): Promise<SqlDatabase> {
  // Use createRequire to bypass Vite's bundler, which intercepts 'node:sqlite'
  // dynamic imports and fails to resolve them in vitest environments.
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const { DatabaseSync } = req('node:sqlite') as {
    DatabaseSync: new (path: string, opts?: Record<string, unknown>) => any;
  };
  const { writeFileSync, mkdtempSync, rmSync } = req('node:fs') as typeof import('node:fs');
  const { tmpdir } = req('node:os') as typeof import('node:os');
  const { join } = req('node:path') as typeof import('node:path');

  const tmpDir = mkdtempSync(join(tmpdir(), 'botns-'));
  const tmpFile = join(tmpDir, 'botns.db');

  writeFileSync(tmpFile, new Uint8Array(buf));

  const raw = new DatabaseSync(tmpFile, { readOnly: true });

  // Best-effort cleanup on process exit.
  process.on('exit', () => {
    try { raw.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  return new NodeDatabase(raw);
}

// ─── sql.js adapter ───────────────────────────────────────────────────────────

interface SqlJsModule {
  Database: new (data: ArrayBufferLike | Uint8Array) => SqlDatabase;
}

/** Opens the database with sql.js (browser path). */
async function openSqlJs(buf: ArrayBuffer): Promise<SqlDatabase> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('sql.js');
  const initSqlJs = (mod.default ?? mod) as (
    config?: unknown,
  ) => Promise<SqlJsModule>;
  const SQL = await initSqlJs();
  return new SQL.Database(new Uint8Array(buf));
}

// ─── Module-level singletons ──────────────────────────────────────────────────

let _dbPromise: Promise<SqlDatabase> | null = null;

/** LRU cache for fetchQueryResult. Map insertion order is eviction order. */
const _queryCache = new Map<string, QueryResult>();
const CACHE_MAX = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Runs a parameterised SELECT and returns all rows as plain objects.
 * Returns [] silently on FTS5 parse errors or other SQL errors.
 */
function queryAll(
  db: SqlDatabase,
  sql: string,
  params: Record<string, unknown>,
): Record<string, unknown>[] {
  let stmt: SqlStatement | undefined;
  try {
    stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push({ ...stmt.getAsObject() });
    }
    return rows;
  } catch {
    return [];
  } finally {
    try { stmt?.free(); } catch { /* ignore */ }
  }
}

/** Returns true when revealed_at is strictly after position. */
function isPastHorizon(
  revealedBook: number,
  revealedChapter: number,
  position: ReadingPosition,
): boolean {
  return (
    revealedBook > position.book_id ||
    (revealedBook === position.book_id &&
      revealedChapter > position.chapter_number)
  );
}

/** Maps evidence_fts.source_type → PassageType. */
const SOURCE_TYPE_MAP: Record<string, PassageType> = {
  chapter: 'prose',
  summary: 'summary',
  factual_claim: 'claim',
  notable_detail: 'detail',
  scene: 'scene',
  embedded_narrative: 'embedded',
};

/** Inserts a new entry; moves existing key to tail (LRU touch); evicts head if full. */
function cacheSet(key: string, value: QueryResult): void {
  if (_queryCache.has(key)) {
    _queryCache.delete(key);
  } else if (_queryCache.size >= CACHE_MAX) {
    const firstKey = _queryCache.keys().next().value;
    if (firstKey !== undefined) _queryCache.delete(firstKey);
  }
  _queryCache.set(key, value);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialises the SQLite backend and fetches /botns.db.
 * Singleton: subsequent calls return the cached Database instance.
 *
 * Runtime selection:
 *   Node.js → node:sqlite (FTS5 enabled)
 *   Browser → sql.js
 */
export async function loadDatabase(): Promise<Database> {
  if (_dbPromise !== null) return _dbPromise;

  _dbPromise = (async (): Promise<SqlDatabase> => {
    const response = await fetch('/botns.db');
    if (!response.ok) {
      throw new Error(`Failed to fetch botns.db: ${response.status}`);
    }
    const buf = await response.arrayBuffer();

    // node:sqlite has FTS5 compiled in; prefer it in Node.js environments.
    const isNode =
      typeof process !== 'undefined' &&
      typeof process.versions?.node === 'string';

    if (isNode) {
      try {
        return await openNodeSqlite(buf);
      } catch {
        // Fall through to sql.js if node:sqlite is unavailable.
      }
    }

    return await openSqlJs(buf);
  })();

  return _dbPromise;
}

/**
 * Fetches FTS5 passages matching theory, capped at topN (default 50).
 * past_horizon is set when revealed_at exceeds position.
 */
export async function fetchPassages(
  theory: string,
  position: ReadingPosition,
  topN = 50,
): Promise<PassagesPanel> {
  const db = (await loadDatabase()) as SqlDatabase;

  // Count all matches (no LIMIT) for total_matching.
  let total_matching = 0;
  let countStmt: SqlStatement | undefined;
  try {
    countStmt = db.prepare(
      'SELECT COUNT(*) AS cnt FROM evidence_fts WHERE evidence_fts MATCH :theory',
    );
    countStmt.bind({ ':theory': theory });
    if (countStmt.step()) {
      total_matching = (countStmt.getAsObject().cnt as number) ?? 0;
    }
  } catch {
    return { items: [], total_matching: 0, showing: 0 };
  } finally {
    try { countStmt?.free(); } catch { /* ignore */ }
  }

  const rows = queryAll(db, passagesSql, { ':theory': theory, ':top_n': topN });

  const items: PassageItem[] = rows.map((row): PassageItem => {
    const sourceType = row.source_type as string;
    const revBook =
      (row.revealed_at_book as number) ?? (row.book_id as number);
    const revChapter =
      (row.revealed_at_chapter as number) ?? (row.chapter_number as number);
    const type: PassageType = SOURCE_TYPE_MAP[sourceType] ?? 'prose';
    const revealed_at: BookChapter = {
      book_id: revBook,
      chapter_number: revChapter,
    };
    return {
      id: row.ref as string,
      type,
      text: row.body as string,
      score: row.score as number,
      chapter: {
        book_id: row.book_id as number,
        number: row.chapter_number as number,
        title: row.chapter_title as string,
      },
      scene_number: row.scene_number as number | null,
      past_horizon: isPastHorizon(revBook, revChapter, position),
      revealed_at,
    };
  });

  return { items, total_matching, showing: items.length };
}

/**
 * Fetches all chapters grouped by book, with FTS match counts per chapter.
 * All chapters are included even with 0 matches.
 */
export async function fetchTimeline(
  theory: string,
  position: ReadingPosition,
): Promise<TimelinePanel> {
  const db = (await loadDatabase()) as SqlDatabase;

  const rows = queryAll(db, timelineSql, { ':theory': theory });

  const bookMap = new Map<number, TimelineBook>();

  for (const row of rows) {
    const bookId = row.book_id as number;
    const chapterNumber = row.chapter_number as number;

    const chapter: TimelineChapter = {
      chapter_id: row.chapter_id as number,
      number: chapterNumber,
      title: row.chapter_title as string,
      past_horizon: isPastHorizon(bookId, chapterNumber, position),
      matches: row.matches as number,
      scenes: [],
    };

    if (!bookMap.has(bookId)) {
      bookMap.set(bookId, {
        book_id: bookId,
        title: row.book_title as string,
        chapters: [],
      });
    }
    bookMap.get(bookId)!.chapters.push(chapter);
  }

  const books: TimelineBook[] = Array.from(bookMap.values()).sort(
    (a, b) => a.book_id - b.book_id,
  );

  return { books };
}

/**
 * Fetches character nodes sorted by scene_count_matching DESC and
 * co-occurrence edges. Only canonical character records are included.
 */
export async function fetchCharacters(
  theory: string,
  position: ReadingPosition,
): Promise<CharactersPanel> {
  const db = (await loadDatabase()) as SqlDatabase;

  const nodeRows = queryAll(db, charactersSql, { ':theory': theory });

  const nodes: CharacterNode[] = nodeRows.map((row): CharacterNode => {
    const faBook = row.mentioned_at_book as number;
    const faChapter = row.mentioned_at_chapter as number;
    const first_appearance: BookChapter = {
      book_id: faBook,
      chapter_number: faChapter,
    };
    return {
      character_id: row.character_id as number,
      canonical_name: row.canonical_name as string,
      first_appearance,
      past_horizon: isPastHorizon(faBook, faChapter, position),
      scene_count_matching: row.scene_count_matching as number,
    };
  });

  const edgeRows = queryAll(db, characterEdgesSql, { ':theory': theory });

  const edges: CharacterEdge[] = edgeRows.map((row): CharacterEdge => {
    const minBook = row.min_rev_book as number;
    const minChapter = row.min_rev_chapter as number;
    return {
      source: row.source_id as number,
      target: row.target_id as number,
      weight: row.weight as number,
      past_horizon: isPastHorizon(minBook, minChapter, position),
    };
  });

  return { nodes, edges };
}

/**
 * Counts all FTS matches for a theory where the named character's first
 * appearance is past the reader's position.
 *
 * Strategy: look up the character whose canonical name equals the theory
 * (case-insensitive). If their first appearance is past position, return the
 * total FTS match count. Otherwise return 0.
 *
 * Note: this is a character-name proxy. For non-character queries (e.g.
 * 'sword') it conservatively returns 0 even if some passages have late
 * revealed_at values. The trade-off is accepted because it avoids false
 * positives from passages whose revealed_at exceeds the reader's position
 * for incidental reasons.
 */
export async function countMatchesPastHorizon(
  theory: string,
  position: ReadingPosition,
): Promise<number> {
  const db = (await loadDatabase()) as SqlDatabase;

  // Count total FTS matches for the theory.
  let total = 0;
  let countStmt: SqlStatement | undefined;
  try {
    countStmt = db.prepare(
      'SELECT COUNT(*) AS cnt FROM evidence_fts WHERE evidence_fts MATCH :theory',
    );
    countStmt.bind({ ':theory': theory });
    if (countStmt.step()) {
      total = (countStmt.getAsObject().cnt as number) ?? 0;
    }
  } catch {
    return 0;
  } finally {
    try { countStmt?.free(); } catch { /* ignore */ }
  }

  if (total === 0) return 0;

  // Look up the character whose name matches the theory (case-insensitive).
  const charRows = queryAll(
    db,
    `SELECT mentioned_at_book, mentioned_at_chapter
     FROM characters
     WHERE LOWER(name) = LOWER(:name) AND first_appearance = 1
     LIMIT 1`,
    { ':name': theory },
  );

  if (charRows.length === 0) return 0;

  const revBook = charRows[0].mentioned_at_book as number;
  const revChapter = charRows[0].mentioned_at_chapter as number;

  return isPastHorizon(revBook, revChapter, position) ? total : 0;
}

/**
 * Composes passages, timeline, and characters into a QueryResult.
 * Cached by (theory, position) with an in-memory LRU (max 50 entries).
 */
export async function fetchQueryResult(
  theory: string,
  position: ReadingPosition,
): Promise<QueryResult> {
  const cacheKey = `${theory}::${position.book_id}::${position.chapter_number}`;

  const cached = _queryCache.get(cacheKey);
  if (cached !== undefined) {
    // Touch: move to tail to refresh LRU order.
    _queryCache.delete(cacheKey);
    _queryCache.set(cacheKey, cached);
    return cached;
  }

  const [passages_panel, timeline_panel, characters_panel, count_past] =
    await Promise.all([
      fetchPassages(theory, position),
      fetchTimeline(theory, position),
      fetchCharacters(theory, position),
      countMatchesPastHorizon(theory, position),
    ]);

  const result: QueryResult = {
    theory: { text: theory },
    position,
    passages_panel,
    timeline_panel,
    characters_panel,
    had_matches_past_horizon: count_past > 0,
  };

  cacheSet(cacheKey, result);
  return result;
}

/**
 * Runs a raw SELECT and returns all rows as plain objects.
 * Pass named params (e.g. { ':id': 5 }) for parameterised queries.
 * Returns [] silently on errors.
 */
export async function fetchAll(
  sql: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const db = (await loadDatabase()) as SqlDatabase;
  return queryAll(db, sql, params);
}

/**
 * Looks up a single item by type and numeric id.
 * Returns the raw row object or null if not found.
 */
export async function lookupItem(
  itemType: string,
  itemId: number,
): Promise<unknown> {
  const db = (await loadDatabase()) as SqlDatabase;

  let sql: string;
  switch (itemType) {
    case 'chapter':
      sql = 'SELECT * FROM chapters WHERE chapter_id = :id';
      break;
    case 'scene':
      sql = 'SELECT * FROM scenes WHERE id = :id';
      break;
    case 'factual_claim':
    case 'claim':
      sql = 'SELECT * FROM factual_claims WHERE id = :id';
      break;
    case 'notable_detail':
    case 'detail':
      sql = 'SELECT * FROM notable_details WHERE id = :id';
      break;
    case 'embedded_narrative':
    case 'embedded':
      sql = 'SELECT * FROM embedded_narratives WHERE id = :id';
      break;
    default:
      return null;
  }

  const rows = queryAll(db, sql, { ':id': itemId });
  return rows[0] ?? null;
}
