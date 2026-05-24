/**
 * Tests for web/src/lib/position.ts
 * TASK-018: BookChapter helpers and URL encoding
 *
 * All tests fail before position.ts is implemented — the named imports
 * throw MODULE_NOT_FOUND at load time, taking every test with it.
 */

import { describe, it, expect } from 'vitest';
import {
  compact,
  fromCompact,
  compare,
  encodeWorkshopURL,
  decodeWorkshopURL,
} from '../position';
import type { BookChapter, ReadingPosition, Theory } from '../types';

// ─── compact ─────────────────────────────────────────────────────────────────

describe('compact', () => {
  it('produces B{book_id}C{chapter_number} form', () => {
    const bc: BookChapter = { book_id: 2, chapter_number: 5 };
    expect(compact(bc)).toBe('B2C5');
  });

  it('works for book 1 chapter 1', () => {
    expect(compact({ book_id: 1, chapter_number: 1 })).toBe('B1C1');
  });

  it('works for multi-digit chapter numbers', () => {
    expect(compact({ book_id: 4, chapter_number: 38 })).toBe('B4C38');
  });
});

// ─── fromCompact ─────────────────────────────────────────────────────────────

describe('fromCompact', () => {
  it('parses B2C5 to { book_id: 2, chapter_number: 5 }', () => {
    expect(fromCompact('B2C5')).toEqual({ book_id: 2, chapter_number: 5 });
  });

  it('parses B1C1', () => {
    expect(fromCompact('B1C1')).toEqual({ book_id: 1, chapter_number: 1 });
  });

  it('parses multi-digit chapter numbers', () => {
    expect(fromCompact('B4C38')).toEqual({ book_id: 4, chapter_number: 38 });
  });

  it('throws on an invalid compact string', () => {
    expect(() => fromCompact('invalid')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => fromCompact('')).toThrow();
  });

  it('throws on lowercase prefix', () => {
    expect(() => fromCompact('b2c5')).toThrow();
  });
});

// ─── compact ↔ fromCompact roundtrip ─────────────────────────────────────────

describe('compact / fromCompact roundtrip', () => {
  it('roundtrips B2C5', () => {
    const bc: BookChapter = { book_id: 2, chapter_number: 5 };
    expect(fromCompact(compact(bc))).toEqual(bc);
  });

  it('roundtrips B1C1', () => {
    const bc: BookChapter = { book_id: 1, chapter_number: 1 };
    expect(fromCompact(compact(bc))).toEqual(bc);
  });

  it('roundtrips B3C17', () => {
    const bc: BookChapter = { book_id: 3, chapter_number: 17 };
    expect(fromCompact(compact(bc))).toEqual(bc);
  });
});

// ─── compare ─────────────────────────────────────────────────────────────────

describe('compare', () => {
  it('returns negative when chapter_number is lower (same book)', () => {
    expect(
      compare({ book_id: 1, chapter_number: 1 }, { book_id: 1, chapter_number: 2 }),
    ).toBeLessThan(0);
  });

  it('returns zero for equal positions', () => {
    expect(
      compare({ book_id: 2, chapter_number: 5 }, { book_id: 2, chapter_number: 5 }),
    ).toBe(0);
  });

  it('returns positive when chapter_number is higher (same book)', () => {
    expect(
      compare({ book_id: 1, chapter_number: 3 }, { book_id: 1, chapter_number: 1 }),
    ).toBeGreaterThan(0);
  });

  it('returns negative when book_id is lower (chapter_number irrelevant)', () => {
    expect(
      compare({ book_id: 1, chapter_number: 99 }, { book_id: 2, chapter_number: 1 }),
    ).toBeLessThan(0);
  });

  it('returns positive when book_id is higher (chapter_number irrelevant)', () => {
    expect(
      compare({ book_id: 3, chapter_number: 1 }, { book_id: 2, chapter_number: 99 }),
    ).toBeGreaterThan(0);
  });

  it('is consistent with Array.sort — ascending order', () => {
    const positions: BookChapter[] = [
      { book_id: 2, chapter_number: 1 },
      { book_id: 1, chapter_number: 5 },
      { book_id: 1, chapter_number: 1 },
    ];
    const sorted = [...positions].sort(compare);
    expect(sorted[0]).toEqual({ book_id: 1, chapter_number: 1 });
    expect(sorted[1]).toEqual({ book_id: 1, chapter_number: 5 });
    expect(sorted[2]).toEqual({ book_id: 2, chapter_number: 1 });
  });
});

// ─── encodeWorkshopURL ────────────────────────────────────────────────────────

describe('encodeWorkshopURL', () => {
  it('returns a string starting with ?', () => {
    const result = encodeWorkshopURL({ text: 'Is Dorcas' }, { book_id: 2, chapter_number: 5 });
    expect(result.startsWith('?')).toBe(true);
  });

  it('includes the q param', () => {
    const result = encodeWorkshopURL({ text: 'Is Dorcas' }, { book_id: 2, chapter_number: 5 });
    expect(result).toContain('q=');
  });

  it('includes pos=B2C5 for book_id=2, chapter_number=5', () => {
    const result = encodeWorkshopURL({ text: 'Is Dorcas' }, { book_id: 2, chapter_number: 5 });
    expect(result).toContain('pos=B2C5');
  });

  it('roundtrips with decodeWorkshopURL', () => {
    const theory: Theory = { text: 'Is Dorcas' };
    const position: ReadingPosition = { book_id: 2, chapter_number: 5 };
    const qs = encodeWorkshopURL(theory, position);
    const decoded = decodeWorkshopURL(qs);
    expect(decoded?.theory.text).toBe('Is Dorcas');
    expect(decoded?.position).toEqual({ book_id: 2, chapter_number: 5 });
  });
});

// ─── decodeWorkshopURL ────────────────────────────────────────────────────────

describe('decodeWorkshopURL', () => {
  it('decodes ?q=Is+Dorcas&pos=B2C5 to the expected WorkshopURL', () => {
    const result = decodeWorkshopURL('?q=Is+Dorcas&pos=B2C5');
    expect(result).not.toBeNull();
    expect(result?.theory.text).toBe('Is Dorcas');
    expect(result?.position.book_id).toBe(2);
    expect(result?.position.chapter_number).toBe(5);
  });

  it('returns null when q param is absent', () => {
    expect(decodeWorkshopURL('?pos=B2C5')).toBeNull();
  });

  it('returns null when pos param is absent', () => {
    expect(decodeWorkshopURL('?q=Is+Dorcas')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decodeWorkshopURL('')).toBeNull();
  });

  it('decodes percent-encoded spaces in q', () => {
    const result = decodeWorkshopURL('?q=Severian%20is%20the%20New%20Sun&pos=B1C1');
    expect(result?.theory.text).toBe('Severian is the New Sun');
  });

  it('preserves position values exactly for B3C17', () => {
    const result = decodeWorkshopURL('?q=test&pos=B3C17');
    expect(result?.position.book_id).toBe(3);
    expect(result?.position.chapter_number).toBe(17);
  });
});
