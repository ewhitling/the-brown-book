/**
 * Tests for web/src/lib/db.ts
 * TASK-017: sql.js init + all query functions
 *
 * All tests fail before db.ts is implemented — the named import throws
 * MODULE_NOT_FOUND at load time, taking every test in this file with it.
 *
 * Chapter count: 35+31+39+39+52 = 196 total across 5 books.
 * Task description says 183 — that is a stale estimate; the live DB has 196.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  loadDatabase,
  fetchPassages,
  fetchTimeline,
  fetchCharacters,
  fetchQueryResult,
  countMatchesPastHorizon,
  lookupItem,
} from '../db';
import { assertSchema } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DB_PATH = resolve(__dirname, '../../../../data/botns.db');

/** Stubs globalThis.fetch to return the on-disk botns.db buffer. */
function stubFetchWithDb(): void {
  const bytes = readFileSync(DB_PATH);
  // slice() copies so the ArrayBuffer is not backed by a SharedArrayBuffer
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buf),
    }),
  );
}

// ─── Reading positions ────────────────────────────────────────────────────────

/** Very beginning — almost everything is past-horizon. */
const POS_B1C1 = { book_id: 1, chapter_number: 1 };
/** Mid-book 2 — dorcas (book 1) is safe, later books are spoilers. */
const POS_B2C5 = { book_id: 2, chapter_number: 5 };
/** Near end of corpus — almost nothing is past-horizon. */
const POS_LATE = { book_id: 5, chapter_number: 50 };

// ─── One-time DB load ─────────────────────────────────────────────────────────
//
// loadDatabase() is expected to be a singleton: the first call fetches and
// initialises the DB; subsequent calls return the cached instance.
// The stub must be installed before the first call.

beforeAll(async () => {
  stubFetchWithDb();
  await loadDatabase();
});

// ─── loadDatabase() ───────────────────────────────────────────────────────────

describe('loadDatabase()', () => {
  it('resolves to an object that has an exec() method', async () => {
    const db = await loadDatabase();
    expect(typeof db.exec).toBe('function');
  });

  it('called fetch with a URL containing "botns.db"', () => {
    // The module-level beforeAll already triggered the real fetch call.
    const mock = vi.mocked(globalThis.fetch as ReturnType<typeof vi.fn>);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('botns.db'));
  });

  it('returned DB passes assertSchema (all required tables and columns present)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = await loadDatabase();
    const ok = assertSchema(db);
    spy.mockRestore();
    expect(ok).toBe(true);
  });
});

// ─── fetchPassages() ─────────────────────────────────────────────────────────

describe('fetchPassages()', () => {
  it('returns an object with items, total_matching, and showing', async () => {
    const panel = await fetchPassages('dorcas', POS_B2C5);
    expect(panel).toHaveProperty('items');
    expect(panel).toHaveProperty('total_matching');
    expect(panel).toHaveProperty('showing');
  });

  it('returns at least one item for the "dorcas" query', async () => {
    const panel = await fetchPassages('dorcas', POS_B2C5);
    expect(panel.items.length).toBeGreaterThan(0);
  });

  it('each item has the full PassageItem shape', async () => {
    const panel = await fetchPassages('dorcas', POS_B2C5);
    const item = panel.items[0]!;
    expect(typeof item.id).toBe('string');         // e.g. "chapter:23"
    expect(typeof item.type).toBe('string');
    expect(typeof item.text).toBe('string');
    expect(typeof item.score).toBe('number');
    expect(typeof item.past_horizon).toBe('boolean');
    expect(typeof (item.scene_number === null ? null : item.scene_number)).not.toBe(
      'undefined',
    ); // scene_number is int | null, not missing
    expect(item.chapter).toHaveProperty('book_id');
    expect(item.chapter).toHaveProperty('number');
    expect(item.chapter).toHaveProperty('title');
    expect(item.revealed_at).toHaveProperty('book_id');
    expect(item.revealed_at).toHaveProperty('chapter_number');
  });

  it('past_horizon is false for items revealed at or before position B2C5', async () => {
    const panel = await fetchPassages('dorcas', POS_B2C5);
    // Dorcas passages are in book 1, all before B2C5 — none should be spoilers.
    const safeItems = panel.items.filter(
      (i) =>
        i.revealed_at.book_id < 2 ||
        (i.revealed_at.book_id === 2 && i.revealed_at.chapter_number <= 5),
    );
    safeItems.forEach((i) => expect(i.past_horizon).toBe(false));
  });

  it('past_horizon is true for items revealed after position B1C1', async () => {
    // At B1C1, dorcas first appears at B1C23 — those items are spoilers.
    const panel = await fetchPassages('dorcas', POS_B1C1);
    const beyondHorizon = panel.items.filter(
      (i) =>
        i.revealed_at.book_id > 1 ||
        (i.revealed_at.book_id === 1 && i.revealed_at.chapter_number > 1),
    );
    expect(beyondHorizon.length).toBeGreaterThan(0); // guard: spoilers must exist
    beyondHorizon.forEach((i) => expect(i.past_horizon).toBe(true));
  });

  it('showing equals items.length', async () => {
    const panel = await fetchPassages('dorcas', POS_B2C5);
    expect(panel.showing).toBe(panel.items.length);
  });

  it('default topN caps items at 50', async () => {
    const panel = await fetchPassages('Severian', POS_LATE);
    expect(panel.items.length).toBeLessThanOrEqual(50);
  });

  it('explicit topN=10 caps items at 10', async () => {
    const panel = await fetchPassages('Severian', POS_LATE, 10);
    expect(panel.items.length).toBeLessThanOrEqual(10);
  });

  it('total_matching >= showing (may exceed topN for popular terms)', async () => {
    // Severian has ~2675 FTS hits — total_matching must reflect the full count.
    const panel = await fetchPassages('Severian', POS_LATE, 50);
    expect(panel.total_matching).toBeGreaterThanOrEqual(panel.showing);
  });

  it('items are returned in score order (consistent sort, not random)', async () => {
    const a = await fetchPassages('dorcas', POS_B2C5);
    const b = await fetchPassages('dorcas', POS_B2C5);
    // Scores must be identical on repeat calls — no random ordering.
    expect(a.items.map((i) => i.score)).toEqual(b.items.map((i) => i.score));
  });
});

// ─── fetchTimeline() ─────────────────────────────────────────────────────────

describe('fetchTimeline()', () => {
  it('returns a TimelinePanel with a books array', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    expect(Array.isArray(panel.books)).toBe(true);
  });

  it('returns exactly 5 books', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    expect(panel.books).toHaveLength(5);
  });

  it('includes all 196 chapters from the DB, including 0-match chapters', async () => {
    // The DB contains 35+31+39+39+52 = 196 chapters.
    // Task description said 183 — that was a stale estimate.
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    const total = panel.books.reduce((n, b) => n + b.chapters.length, 0);
    expect(total).toBe(196);
  });

  it('books are ordered by book_id ascending', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    for (let i = 1; i < panel.books.length; i++) {
      expect(panel.books[i]!.book_id).toBeGreaterThan(
        panel.books[i - 1]!.book_id,
      );
    }
  });

  it('chapters within each book are ordered by chapter number ascending', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    for (const book of panel.books) {
      for (let i = 1; i < book.chapters.length; i++) {
        expect(book.chapters[i]!.number).toBeGreaterThan(
          book.chapters[i - 1]!.number,
        );
      }
    }
  });

  it('each chapter has the full TimelineChapter shape', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    const ch = panel.books[0]!.chapters[0]!;
    expect(typeof ch.chapter_id).toBe('number');
    expect(typeof ch.number).toBe('number');
    expect(typeof ch.title).toBe('string');
    expect(typeof ch.past_horizon).toBe('boolean');
    expect(typeof ch.matches).toBe('number');
    expect(Array.isArray(ch.scenes)).toBe(true);
  });

  it('all book-1 chapters have past_horizon = false at position B2C5', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    const book1 = panel.books.find((b) => b.book_id === 1)!;
    expect(book1).toBeDefined();
    book1.chapters.forEach((ch) => expect(ch.past_horizon).toBe(false));
  });

  it('all book-3 chapters have past_horizon = true at position B2C5', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    const book3 = panel.books.find((b) => b.book_id === 3)!;
    expect(book3).toBeDefined();
    book3.chapters.forEach((ch) => expect(ch.past_horizon).toBe(true));
  });

  it('chapters with no query hits have matches = 0 (not omitted)', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    const zeroMatch = panel.books
      .flatMap((b) => b.chapters)
      .filter((ch) => ch.matches === 0);
    // Dorcas does not appear in every chapter — some must be 0.
    expect(zeroMatch.length).toBeGreaterThan(0);
  });

  it('matches is a non-negative integer for every chapter', async () => {
    const panel = await fetchTimeline('dorcas', POS_B2C5);
    panel.books
      .flatMap((b) => b.chapters)
      .forEach((ch) => {
        expect(ch.matches).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(ch.matches)).toBe(true);
      });
  });
});

// ─── fetchCharacters() ───────────────────────────────────────────────────────

describe('fetchCharacters()', () => {
  it('returns a CharactersPanel with nodes and edges arrays', async () => {
    const panel = await fetchCharacters('Severian', POS_LATE);
    expect(Array.isArray(panel.nodes)).toBe(true);
    expect(Array.isArray(panel.edges)).toBe(true);
  });

  it('returns non-empty nodes for a broad query', async () => {
    const panel = await fetchCharacters('Severian', POS_LATE);
    expect(panel.nodes.length).toBeGreaterThan(0);
  });

  it('nodes are sorted by scene_count_matching descending', async () => {
    const panel = await fetchCharacters('Severian', POS_LATE);
    const counts = panel.nodes.map((n) => n.scene_count_matching);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);
    }
  });

  it('each node has the full CharacterNode shape', async () => {
    const panel = await fetchCharacters('Severian', POS_LATE);
    const node = panel.nodes[0]!;
    expect(typeof node.character_id).toBe('number');
    expect(typeof node.canonical_name).toBe('string');
    expect(node.first_appearance).toHaveProperty('book_id');
    expect(node.first_appearance).toHaveProperty('chapter_number');
    expect(typeof node.past_horizon).toBe('boolean');
    expect(typeof node.scene_count_matching).toBe('number');
  });

  it('past_horizon is true for nodes with first_appearance after position', async () => {
    // At B1C1, nearly every character first appears after chapter 1.
    const panel = await fetchCharacters('Severian', POS_B1C1);
    const beyond = panel.nodes.filter(
      (n) =>
        n.first_appearance.book_id > 1 ||
        (n.first_appearance.book_id === 1 &&
          n.first_appearance.chapter_number > 1),
    );
    expect(beyond.length).toBeGreaterThan(0); // guard
    beyond.forEach((n) => expect(n.past_horizon).toBe(true));
  });

  it('past_horizon is false for nodes with first_appearance at or before position', async () => {
    const panel = await fetchCharacters('Severian', POS_B1C1);
    const safe = panel.nodes.filter(
      (n) =>
        n.first_appearance.book_id < 1 ||
        (n.first_appearance.book_id === 1 &&
          n.first_appearance.chapter_number <= 1),
    );
    safe.forEach((n) => expect(n.past_horizon).toBe(false));
  });

  it('each edge has the full CharacterEdge shape', async () => {
    const panel = await fetchCharacters('Severian', POS_LATE);
    if (panel.edges.length > 0) {
      const edge = panel.edges[0]!;
      expect(typeof edge.source).toBe('number');
      expect(typeof edge.target).toBe('number');
      expect(typeof edge.weight).toBe('number');
      expect(typeof edge.past_horizon).toBe('boolean');
    }
  });

  it('returns empty nodes and edges for a query with no FTS matches', async () => {
    const panel = await fetchCharacters('xyzzy_no_match_99999', POS_B2C5);
    expect(panel.nodes).toHaveLength(0);
    expect(panel.edges).toHaveLength(0);
  });
});

// ─── fetchQueryResult() ──────────────────────────────────────────────────────

describe('fetchQueryResult()', () => {
  it('returns a QueryResult with all six required fields', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    expect(result).toHaveProperty('theory');
    expect(result).toHaveProperty('position');
    expect(result).toHaveProperty('passages_panel');
    expect(result).toHaveProperty('timeline_panel');
    expect(result).toHaveProperty('characters_panel');
    expect(result).toHaveProperty('had_matches_past_horizon');
  });

  it('theory.text echoes the input string', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    expect(result.theory.text).toBe('dorcas');
  });

  it('position echoes the input ReadingPosition', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    expect(result.position.book_id).toBe(2);
    expect(result.position.chapter_number).toBe(5);
  });

  it('had_matches_past_horizon matches whether any passage item is past_horizon', async () => {
    // At B1C1, dorcas passages from B1C23+ are spoilers.
    const result = await fetchQueryResult('dorcas', POS_B1C1);
    const anyPast = result.passages_panel.items.some((i) => i.past_horizon);
    expect(result.had_matches_past_horizon).toBe(anyPast);
  });

  it('had_matches_past_horizon is false when all dorcas passages are safe at B2C5', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    expect(result.had_matches_past_horizon).toBe(false);
  });

  it('passages_panel is consistent with standalone fetchPassages', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    const direct = await fetchPassages('dorcas', POS_B2C5);
    expect(result.passages_panel.total_matching).toBe(direct.total_matching);
    expect(result.passages_panel.items.length).toBe(direct.items.length);
  });

  it('timeline_panel.books has 5 entries (same as standalone fetchTimeline)', async () => {
    const result = await fetchQueryResult('dorcas', POS_B2C5);
    expect(result.timeline_panel.books).toHaveLength(5);
  });
});

// ─── LRU cache (fetchQueryResult) ────────────────────────────────────────────

describe('LRU cache (fetchQueryResult)', () => {
  it('returns the same object reference on repeat call with identical args', async () => {
    const first = await fetchQueryResult('lru-test-theory', POS_B2C5);
    const second = await fetchQueryResult('lru-test-theory', POS_B2C5);
    expect(second).toBe(first); // strict reference equality
  });

  it('returns a different object for a different theory string', async () => {
    const a = await fetchQueryResult('lru-alpha', POS_B2C5);
    const b = await fetchQueryResult('lru-beta', POS_B2C5);
    expect(b).not.toBe(a);
  });

  it('returns a different object for a different position', async () => {
    const a = await fetchQueryResult('lru-pos-test', POS_B2C5);
    const b = await fetchQueryResult('lru-pos-test', POS_LATE);
    expect(b).not.toBe(a);
  });
});

// ─── countMatchesPastHorizon() ───────────────────────────────────────────────

describe('countMatchesPastHorizon()', () => {
  it('returns a non-negative integer', async () => {
    const n = await countMatchesPastHorizon('dorcas', POS_B2C5);
    expect(typeof n).toBe('number');
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when all dorcas hits are before B2C5', async () => {
    // Dorcas is entirely in book 1 — all passages are before B2C5.
    const n = await countMatchesPastHorizon('dorcas', POS_B2C5);
    expect(n).toBe(0);
  });

  it('returns > 0 when query has hits past the horizon', async () => {
    // At B1C1, dorcas passages from B1C23 onward are beyond the horizon.
    const n = await countMatchesPastHorizon('dorcas', POS_B1C1);
    expect(n).toBeGreaterThan(0);
  });

  it('returns 0 for a query with no FTS matches', async () => {
    const n = await countMatchesPastHorizon('xyzzy_no_match_99999', POS_B2C5);
    expect(n).toBe(0);
  });
});

// ─── lookupItem() ────────────────────────────────────────────────────────────

describe('lookupItem()', () => {
  it('returns a non-null value for itemType "chapter" with a valid id', async () => {
    const item = await lookupItem('chapter', 1);
    expect(item).not.toBeNull();
    expect(item).toBeDefined();
  });

  it('chapter result contains chapter_id and title fields', async () => {
    const item = (await lookupItem('chapter', 1)) as Record<string, unknown>;
    expect(item).toHaveProperty('chapter_id');
    expect(item).toHaveProperty('title');
  });

  it('returns a non-null value for itemType "scene" with a valid id', async () => {
    const item = await lookupItem('scene', 1);
    expect(item).not.toBeNull();
    expect(item).toBeDefined();
  });

  it('scene result contains id and summary fields', async () => {
    const item = (await lookupItem('scene', 1)) as Record<string, unknown>;
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('summary');
  });

  it('returns null or undefined for an id that does not exist', async () => {
    const item = await lookupItem('chapter', 999999);
    // null or undefined are both acceptable — the item simply does not exist.
    expect(item == null).toBe(true);
  });
});
