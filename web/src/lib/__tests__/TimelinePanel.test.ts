/**
 * Tests for web/src/lib/timeline.ts
 * TASK-023: density helpers used by TimelinePanel.svelte.
 */

import { describe, it, expect } from 'vitest';
import { densityLevel, fillPercent, maxMatchCount } from '../timeline';
import type { TimelinePanel } from '../types';

// ─── Shared fixture helpers ───────────────────────────────────────────────────

function makeChapter(id: number, matches: number, pastHorizon = false) {
  return {
    chapter_id: id,
    number: id,
    title: `Chapter ${id}`,
    past_horizon: pastHorizon,
    matches,
    scenes: [],
  };
}

function makeBook(bookId: number, chapters: ReturnType<typeof makeChapter>[]) {
  return { book_id: bookId, title: `Book ${bookId}`, chapters };
}

// ─── densityLevel() ──────────────────────────────────────────────────────────

describe('densityLevel()', () => {
  it('returns 0 for zero matches (gray baseline)', () => {
    expect(densityLevel(0, 100)).toBe(0);
    expect(densityLevel(0, 0)).toBe(0);
  });

  it('returns 1 for sparse matches (≤ 25 % of max)', () => {
    expect(densityLevel(1, 100)).toBe(1);
    expect(densityLevel(25, 100)).toBe(1);
  });

  it('returns 2 for moderate matches (26–60 % of max)', () => {
    expect(densityLevel(26, 100)).toBe(2);
    expect(densityLevel(60, 100)).toBe(2);
  });

  it('returns 3 for dense matches (> 60 % of max)', () => {
    expect(densityLevel(61, 100)).toBe(3);
    expect(densityLevel(100, 100)).toBe(3);
  });

  it('returns 3 when matches equals max (full bar)', () => {
    expect(densityLevel(5, 5)).toBe(3);
  });

  it('uses max = 1 when max arg is 0, preventing division by zero', () => {
    // matches=1, max forced to 1 → ratio 1.0 → level 3
    expect(densityLevel(1, 0)).toBe(3);
  });

  it('produces all four distinct levels given representative values', () => {
    const levels = new Set([
      densityLevel(0, 100),   // 0
      densityLevel(10, 100),  // 1
      densityLevel(40, 100),  // 2
      densityLevel(80, 100),  // 3
    ]);
    expect(levels.size).toBe(4);
  });
});

// ─── fillPercent() ───────────────────────────────────────────────────────────

describe('fillPercent()', () => {
  it('returns "0%" for zero matches', () => {
    expect(fillPercent(0, 100)).toBe('0%');
  });

  it('returns "0%" when max is 0 (no-query state)', () => {
    expect(fillPercent(0, 0)).toBe('0%');
  });

  it('returns "100%" when matches equals max', () => {
    expect(fillPercent(100, 100)).toBe('100%');
  });

  it('enforces an 8 % visual floor for very sparse matches', () => {
    // 1 match out of 1000 = 0.1 % → clamped to 8 %
    expect(fillPercent(1, 1000)).toBe('8%');
  });

  it('returns a rounded percentage string without floats', () => {
    expect(fillPercent(50, 100)).toBe('50%');
    expect(fillPercent(33, 100)).toBe('33%');
    expect(fillPercent(1, 3)).toBe('33%');  // Math.round(33.3) = 33
  });
});

// ─── maxMatchCount() ─────────────────────────────────────────────────────────

describe('maxMatchCount()', () => {
  it('returns 1 for null panel', () => {
    expect(maxMatchCount(null)).toBe(1);
  });

  it('returns 1 for a panel with empty books array', () => {
    const panel: TimelinePanel = { books: [] };
    expect(maxMatchCount(panel)).toBe(1);
  });

  it('returns the maximum match count across all chapters', () => {
    const panel: TimelinePanel = {
      books: [
        makeBook(1, [makeChapter(1, 3), makeChapter(2, 10)]),
        makeBook(2, [makeChapter(3, 7)]),
      ],
    };
    expect(maxMatchCount(panel)).toBe(10);
  });

  it('returns 1 (not 0) when every chapter has 0 matches', () => {
    const panel: TimelinePanel = {
      books: [makeBook(1, [makeChapter(1, 0), makeChapter(2, 0)])],
    };
    expect(maxMatchCount(panel)).toBe(1);
  });

  it('handles all 5 books with varied match counts', () => {
    const panel: TimelinePanel = {
      books: [1, 2, 3, 4, 5].map((id) =>
        makeBook(id, [makeChapter(id * 10, id * 5)]),
      ),
    };
    // book 5 has 5*5=25 matches, the max
    expect(maxMatchCount(panel)).toBe(25);
  });
});

// ─── Integration: density levels across a realistic panel ────────────────────

describe('density levels across a realistic panel', () => {
  it('all-zero-match panel produces only level 0', () => {
    const panel: TimelinePanel = {
      books: [makeBook(1, [makeChapter(1, 0), makeChapter(2, 0)])],
    };
    const max = maxMatchCount(panel); // 1
    const levels = panel.books[0]!.chapters.map((c) =>
      densityLevel(c.matches, max),
    );
    expect(levels.every((l) => l === 0)).toBe(true);
  });

  it('single-match panel: the one match gets level 3 (it is 100 % of max)', () => {
    const panel: TimelinePanel = {
      books: [makeBook(1, [makeChapter(1, 0), makeChapter(2, 1)])],
    };
    const max = maxMatchCount(panel); // 1
    expect(densityLevel(1, max)).toBe(3);
    expect(densityLevel(0, max)).toBe(0);
  });
});
