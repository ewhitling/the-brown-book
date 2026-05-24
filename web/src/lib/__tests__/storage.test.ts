/**
 * Tests for web/src/lib/storage.ts
 * TASK-018: localStorage wrappers for reading position and reveals
 *
 * All tests fail before storage.ts is implemented — the named imports
 * throw MODULE_NOT_FOUND at load time, taking every test with it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveReadingPosition,
  loadReadingPosition,
  recordReveal,
  loadReveals,
  isRevealed,
} from '../storage';

// ─── localStorage mock ────────────────────────────────────────────────────────

function makeLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// ─── Schema-versioned key constants ──────────────────────────────────────────

const POSITION_KEY = 'bb:v1:position';
const REVEALED_KEY = 'bb:v1:revealed';

// ─── saveReadingPosition / loadReadingPosition ────────────────────────────────

describe('saveReadingPosition / loadReadingPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('roundtrip: loadReadingPosition returns the saved position', () => {
    const pos = { book_id: 2, chapter_number: 5 };
    saveReadingPosition(pos);
    expect(loadReadingPosition()).toEqual(pos);
  });

  it('uses the schema-versioned key bb:v1:position', () => {
    saveReadingPosition({ book_id: 1, chapter_number: 1 });
    expect(localStorage.getItem(POSITION_KEY)).not.toBeNull();
  });

  it('loadReadingPosition returns null when nothing is stored', () => {
    expect(loadReadingPosition()).toBeNull();
  });

  it('roundtrip preserves book_id and chapter_number exactly', () => {
    saveReadingPosition({ book_id: 3, chapter_number: 22 });
    const loaded = loadReadingPosition();
    expect(loaded?.book_id).toBe(3);
    expect(loaded?.chapter_number).toBe(22);
  });

  it('overwrites previous position on second save', () => {
    saveReadingPosition({ book_id: 1, chapter_number: 1 });
    saveReadingPosition({ book_id: 4, chapter_number: 10 });
    expect(loadReadingPosition()).toEqual({ book_id: 4, chapter_number: 10 });
  });
});

// ─── recordReveal / loadReveals / isRevealed ─────────────────────────────────

describe('recordReveal / loadReveals / isRevealed', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recordReveal writes to the schema-versioned key bb:v1:revealed', () => {
    recordReveal('character', 7);
    expect(localStorage.getItem(REVEALED_KEY)).not.toBeNull();
  });

  it('loadReveals returns an empty array when nothing has been recorded', () => {
    expect(loadReveals()).toEqual([]);
  });

  it('roundtrip: loadReveals returns the recorded entry', () => {
    recordReveal('character', 7);
    const reveals = loadReveals();
    expect(reveals).toHaveLength(1);
    expect(reveals[0]).toEqual({ type: 'character', id: 7 });
  });

  it('recordReveal is idempotent — duplicate calls produce no duplicates', () => {
    recordReveal('character', 7);
    recordReveal('character', 7);
    recordReveal('character', 7);
    expect(loadReveals()).toHaveLength(1);
  });

  it('recordReveal distinguishes entries by both type and id', () => {
    recordReveal('character', 7);
    recordReveal('scene', 7);
    recordReveal('character', 8);
    expect(loadReveals()).toHaveLength(3);
  });

  it('isRevealed returns true for a recorded item', () => {
    recordReveal('character', 7);
    expect(isRevealed('character', 7)).toBe(true);
  });

  it('isRevealed returns false for an item that has not been recorded', () => {
    expect(isRevealed('character', 999)).toBe(false);
  });

  it('isRevealed distinguishes by type — same id, different type is not revealed', () => {
    recordReveal('character', 7);
    expect(isRevealed('scene', 7)).toBe(false);
  });

  it('isRevealed distinguishes by id — same type, different id is not revealed', () => {
    recordReveal('character', 7);
    expect(isRevealed('character', 8)).toBe(false);
  });

  it('multiple distinct reveals are all queryable via isRevealed', () => {
    recordReveal('character', 1);
    recordReveal('scene', 2);
    expect(isRevealed('character', 1)).toBe(true);
    expect(isRevealed('scene', 2)).toBe(true);
    expect(isRevealed('character', 2)).toBe(false);
  });
});
