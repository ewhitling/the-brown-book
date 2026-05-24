/**
 * localStorage wrappers for reading position and spoiler reveals.
 * TASK-018: Schema-versioned keys bb:v1:position and bb:v1:revealed.
 */

import type { ReadingPosition } from './types';

// ─── Keys ────────────────────────────────────────────────────────────────────

const POSITION_KEY = 'bb:v1:position';
const REVEALED_KEY = 'bb:v1:revealed';

// ─── Reveal entry shape ───────────────────────────────────────────────────────

interface RevealEntry {
  type: string;
  id: number;
}

// ─── Reading position ─────────────────────────────────────────────────────────

/** Persists the user's reading position to localStorage. Overwrites any previous value. */
export function saveReadingPosition(position: ReadingPosition): void {
  localStorage.setItem(POSITION_KEY, JSON.stringify(position));
}

/** Returns the stored reading position, or null if nothing has been saved. */
export function loadReadingPosition(): ReadingPosition | null {
  const raw = localStorage.getItem(POSITION_KEY);
  if (raw === null) return null;
  return JSON.parse(raw) as ReadingPosition;
}

// ─── Spoiler reveals ──────────────────────────────────────────────────────────

/** Returns the current reveals array from localStorage, or [] if absent. */
export function loadReveals(): RevealEntry[] {
  const raw = localStorage.getItem(REVEALED_KEY);
  if (raw === null) return [];
  return JSON.parse(raw) as RevealEntry[];
}

/**
 * Records that the user has revealed an item. Idempotent — duplicate
 * (type, id) pairs are not stored twice.
 */
export function recordReveal(type: string, id: number): void {
  const reveals = loadReveals();
  const alreadyPresent = reveals.some((r) => r.type === type && r.id === id);
  if (alreadyPresent) return;
  reveals.push({ type, id });
  localStorage.setItem(REVEALED_KEY, JSON.stringify(reveals));
}

/** Returns true if the given (type, id) pair has been recorded. */
export function isRevealed(type: string, id: number): boolean {
  return loadReveals().some((r) => r.type === type && r.id === id);
}
