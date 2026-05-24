/**
 * Pure helpers for TimelinePanel density calculations.
 * TASK-023: extracted so they can be unit-tested independently of Svelte.
 */

import type { TimelinePanel } from './types';

/**
 * Returns a 0–3 density level for a chapter's match count.
 *   0 = no matches  (gray baseline)
 *   1 = sparse       (≤ 25 % of max)
 *   2 = moderate     (26–60 % of max)
 *   3 = dense        (> 60 % of max)
 */
export function densityLevel(matches: number, max: number): 0 | 1 | 2 | 3 {
  if (matches === 0) return 0;
  const ratio = matches / Math.max(1, max);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.6) return 2;
  return 3;
}

/**
 * Fill height as a CSS percentage string for a match bar.
 * Enforces an 8 % visual floor when matches > 0 so sparse hits stay visible.
 */
export function fillPercent(matches: number, max: number): string {
  if (matches === 0 || max <= 0) return '0%';
  const pct = Math.round((matches / max) * 100);
  return `${Math.max(8, pct)}%`;
}

/**
 * Maximum match count across all chapters in the panel.
 * Returns at least 1 to avoid division-by-zero in density calculations.
 */
export function maxMatchCount(panel: TimelinePanel | null): number {
  if (!panel || panel.books.length === 0) return 1;
  const counts = panel.books.flatMap((b) => b.chapters.map((c) => c.matches));
  return Math.max(1, ...counts);
}
