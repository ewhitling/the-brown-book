/**
 * BookChapter helpers and WorkshopURL encoding.
 * TASK-018: compact/fromCompact, compare, encodeWorkshopURL/decodeWorkshopURL.
 *
 * URL format mirrors SPEC.md urls.py: ?q=<theory>&pos=B{book_id}C{chapter_number}
 */

import type { BookChapter, ReadingPosition, Theory } from './types';

// ─── Compact encoding ─────────────────────────────────────────────────────────

/** Encodes a BookChapter as a compact string, e.g. B2C5. */
export function compact(bc: BookChapter): string {
  return `B${bc.book_id}C${bc.chapter_number}`;
}

/** Parses a compact string (e.g. "B2C5") back to a BookChapter. Throws on invalid input. */
export function fromCompact(s: string): BookChapter {
  const match = /^B(\d+)C(\d+)$/.exec(s);
  if (!match) throw new Error(`Invalid compact BookChapter string: "${s}"`);
  return {
    book_id: parseInt(match[1], 10),
    chapter_number: parseInt(match[2], 10),
  };
}

// ─── Comparator ───────────────────────────────────────────────────────────────

/**
 * Comparator for BookChapter — sorts by book_id first, then chapter_number.
 * Compatible with Array.sort().
 */
export function compare(a: BookChapter, b: BookChapter): number {
  if (a.book_id !== b.book_id) return a.book_id - b.book_id;
  return a.chapter_number - b.chapter_number;
}

// ─── WorkshopURL encoding ─────────────────────────────────────────────────────

/**
 * Encodes a theory + reading position as a query string.
 * Mirrors SPEC.md urls.py WorkshopURL.encode().
 * Example: ?q=Is+Dorcas&pos=B2C5
 */
export function encodeWorkshopURL(theory: Theory, position: ReadingPosition): string {
  const params = new URLSearchParams({ q: theory.text, pos: compact(position) });
  return `?${params.toString()}`;
}

/**
 * Decodes a query string into a theory + reading position.
 * Returns null if q or pos params are missing or pos is malformed.
 * Mirrors SPEC.md urls.py WorkshopURL.decode().
 */
export function decodeWorkshopURL(
  qs: string,
): { theory: Theory; position: ReadingPosition } | null {
  if (!qs) return null;
  const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  const q = params.get('q');
  const pos = params.get('pos');
  if (!q || !pos) return null;
  try {
    const position = fromCompact(pos);
    return { theory: { text: q }, position };
  } catch {
    return null;
  }
}
