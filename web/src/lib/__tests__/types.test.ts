/**
 * Tests for web/src/lib/types.ts
 * TASK-016: TypeScript mirrors of core/models/ + assertSchema()
 *
 * All tests fail before types.ts is implemented — the value import of
 * assertSchema throws MODULE_NOT_FOUND at load time, taking every test
 * in this file with it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertSchema } from '../types';
import type {
  BookChapter,
  ReadingPosition,
  Theory,
  PassageChapter,
  PassageItem,
  PassagesPanel,
  TimelineScene,
  TimelineChapter,
  TimelineBook,
  TimelinePanel,
  CharacterNode,
  CharacterEdge,
  CharactersPanel,
  QueryResult,
  MergeCorrection,
  RenameCorrection,
  FactualFixCorrection,
  Correction,
  PassageType,
  SceneMode,
} from '../types';

// ─── Mock DB helper ──────────────────────────────────────────────────────────

/**
 * Returns a minimal object implementing the exec() surface that assertSchema
 * uses. Responds to `PRAGMA table_info(<table>)` with the given column list.
 */
function createMockDb(
  tables: Record<string, string[]>,
): Parameters<typeof assertSchema>[0] {
  return {
    exec(sql: string) {
      const m = sql.match(/PRAGMA\s+table_info\s*\(\s*(\w+)\s*\)/i);
      if (!m) return [];
      const cols = tables[m[1]];
      if (cols === undefined) return [];
      return [
        {
          columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
          values: cols.map((name, i) => [i, name, 'TEXT', 0, null, 0]),
        },
      ];
    },
  } as unknown as Parameters<typeof assertSchema>[0];
}

/** Full schema matching the live botns.db structure. */
const COMPLETE_SCHEMA: Record<string, string[]> = {
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

// ─── BookChapter ─────────────────────────────────────────────────────────────

describe('BookChapter', () => {
  it('has book_id: number and chapter_number: number', () => {
    const bc = { book_id: 2, chapter_number: 5 } satisfies BookChapter;
    expect(bc.book_id).toBe(2);
    expect(bc.chapter_number).toBe(5);
  });
});

// ─── ReadingPosition ─────────────────────────────────────────────────────────

describe('ReadingPosition', () => {
  it('has book_id: number and chapter_number: number', () => {
    const rp = { book_id: 1, chapter_number: 10 } satisfies ReadingPosition;
    expect(rp.book_id).toBe(1);
    expect(rp.chapter_number).toBe(10);
  });
});

// ─── Theory ──────────────────────────────────────────────────────────────────

describe('Theory', () => {
  it('has text: string', () => {
    const t = { text: 'Severian is the New Sun' } satisfies Theory;
    expect(t.text).toBe('Severian is the New Sun');
  });
});

// ─── PassageChapter ───────────────────────────────────────────────────────────

describe('PassageChapter', () => {
  it('has book_id, number, and title', () => {
    const pc = {
      book_id: 3,
      number: 7,
      title: 'The Citadel',
    } satisfies PassageChapter;
    expect(pc.book_id).toBe(3);
    expect(pc.number).toBe(7);
    expect(pc.title).toBe('The Citadel');
  });
});

// ─── Literal unions ───────────────────────────────────────────────────────────

describe('PassageType', () => {
  it('is a union of exactly six passage kinds', () => {
    const kinds: PassageType[] = [
      'prose',
      'summary',
      'claim',
      'scene',
      'detail',
      'embedded',
    ];
    expect(kinds).toHaveLength(6);
  });
});

describe('SceneMode', () => {
  it('is a union of exactly six scene modes', () => {
    const modes: SceneMode[] = [
      'action',
      'dialogue',
      'reflection',
      'embedded_story',
      'dream',
      'description',
    ];
    expect(modes).toHaveLength(6);
  });
});

// ─── PassageItem ──────────────────────────────────────────────────────────────

describe('PassageItem', () => {
  it('has id, type, text, score, chapter, scene_number, past_horizon, revealed_at', () => {
    const item = {
      id: 'claim:412',
      type: 'claim' as const,
      text: 'Severian drinks the water of Lethe',
      score: 0.87,
      chapter: { book_id: 2, number: 3, title: 'Chapter 3' },
      scene_number: null,
      past_horizon: false,
      revealed_at: { book_id: 2, chapter_number: 3 },
    } satisfies PassageItem;
    expect(item.id).toBe('claim:412');
    expect(item.type).toBe('claim');
    expect(item.score).toBe(0.87);
    expect(item.scene_number).toBeNull();
    expect(item.revealed_at.book_id).toBe(2);
  });

  it('allows scene_number to be a number or null', () => {
    const withScene = {
      id: 'scene:7',
      type: 'scene' as const,
      text: 'A fight',
      score: 1.0,
      chapter: { book_id: 1, number: 1, title: 'Ch 1' },
      scene_number: 4,
      past_horizon: false,
      revealed_at: { book_id: 1, chapter_number: 1 },
    } satisfies PassageItem;
    expect(withScene.scene_number).toBe(4);
  });
});

// ─── PassagesPanel ────────────────────────────────────────────────────────────

describe('PassagesPanel', () => {
  it('has items[], total_matching, and showing', () => {
    const panel = {
      items: [],
      total_matching: 42,
      showing: 50,
    } satisfies PassagesPanel;
    expect(panel.total_matching).toBe(42);
    expect(panel.showing).toBe(50);
    expect(Array.isArray(panel.items)).toBe(true);
  });
});

// ─── TimelineScene ────────────────────────────────────────────────────────────

describe('TimelineScene', () => {
  it('has scene_id, number, mode, location fields, summary, and horizon flags', () => {
    const scene = {
      scene_id: 100,
      number: 1,
      mode: 'action' as const,
      location_canonical: 'The Citadel',
      location_raw: 'citadel',
      summary: 'Severian wanders the Atrium of Time',
      past_horizon: false,
      matches_query: true,
    } satisfies TimelineScene;
    expect(scene.scene_id).toBe(100);
    expect(scene.mode).toBe('action');
    expect(scene.location_canonical).toBe('The Citadel');
    expect(scene.matches_query).toBe(true);
  });

  it('allows location_canonical to be null', () => {
    const scene = {
      scene_id: 101,
      number: 2,
      mode: 'dialogue' as const,
      location_canonical: null,
      location_raw: 'somewhere',
      summary: 'A conversation',
      past_horizon: false,
      matches_query: false,
    } satisfies TimelineScene;
    expect(scene.location_canonical).toBeNull();
  });
});

// ─── TimelineChapter ──────────────────────────────────────────────────────────

describe('TimelineChapter', () => {
  it('has chapter_id, number, title, past_horizon, matches, and scenes[]', () => {
    const chapter = {
      chapter_id: 10,
      number: 3,
      title: 'The Witches Tor',
      past_horizon: false,
      matches: 2,
      scenes: [],
    } satisfies TimelineChapter;
    expect(chapter.chapter_id).toBe(10);
    expect(chapter.matches).toBe(2);
    expect(Array.isArray(chapter.scenes)).toBe(true);
  });
});

// ─── TimelineBook ─────────────────────────────────────────────────────────────

describe('TimelineBook', () => {
  it('has book_id, title, and chapters[]', () => {
    const book = {
      book_id: 1,
      title: 'Shadow of the Torturer',
      chapters: [],
    } satisfies TimelineBook;
    expect(book.book_id).toBe(1);
    expect(book.title).toBe('Shadow of the Torturer');
    expect(Array.isArray(book.chapters)).toBe(true);
  });
});

// ─── TimelinePanel ────────────────────────────────────────────────────────────

describe('TimelinePanel', () => {
  it('has books[]', () => {
    const panel = { books: [] } satisfies TimelinePanel;
    expect(Array.isArray(panel.books)).toBe(true);
  });
});

// ─── CharacterNode ────────────────────────────────────────────────────────────

describe('CharacterNode', () => {
  it('has character_id, canonical_name, first_appearance, past_horizon, scene_count_matching', () => {
    const node = {
      character_id: 7,
      canonical_name: 'Severian',
      first_appearance: { book_id: 1, chapter_number: 1 },
      past_horizon: false,
      scene_count_matching: 12,
    } satisfies CharacterNode;
    expect(node.character_id).toBe(7);
    expect(node.canonical_name).toBe('Severian');
    expect(node.first_appearance.book_id).toBe(1);
    expect(node.scene_count_matching).toBe(12);
  });
});

// ─── CharacterEdge ────────────────────────────────────────────────────────────

describe('CharacterEdge', () => {
  it('has source, target, weight, and past_horizon', () => {
    const edge = {
      source: 1,
      target: 2,
      weight: 5,
      past_horizon: false,
    } satisfies CharacterEdge;
    expect(edge.source).toBe(1);
    expect(edge.target).toBe(2);
    expect(edge.weight).toBe(5);
    expect(edge.past_horizon).toBe(false);
  });
});

// ─── CharactersPanel ──────────────────────────────────────────────────────────

describe('CharactersPanel', () => {
  it('has nodes[] and edges[]', () => {
    const panel = { nodes: [], edges: [] } satisfies CharactersPanel;
    expect(Array.isArray(panel.nodes)).toBe(true);
    expect(Array.isArray(panel.edges)).toBe(true);
  });
});

// ─── QueryResult ──────────────────────────────────────────────────────────────

describe('QueryResult', () => {
  it('has theory, position, passages_panel, timeline_panel, characters_panel, had_matches_past_horizon', () => {
    const qr: QueryResult = {
      theory: { text: 'test theory' },
      position: { book_id: 1, chapter_number: 1 },
      passages_panel: { items: [], total_matching: 0, showing: 0 },
      timeline_panel: { books: [] },
      characters_panel: { nodes: [], edges: [] },
      had_matches_past_horizon: false,
    };
    expect(qr.theory.text).toBe('test theory');
    expect(qr.position.book_id).toBe(1);
    expect(qr.passages_panel.total_matching).toBe(0);
    expect(qr.had_matches_past_horizon).toBe(false);
  });
});

// ─── Correction discriminated union ──────────────────────────────────────────

describe('MergeCorrection', () => {
  it('has type "merge", target_type, source_ids[], into_id, rationale, submitted_by', () => {
    const c = {
      type: 'merge' as const,
      target_type: 'character' as const,
      source_ids: [1, 2, 3],
      into_id: 4,
      rationale: 'Same person',
      submitted_by: null,
    } satisfies MergeCorrection;
    expect(c.type).toBe('merge');
    expect(c.source_ids).toHaveLength(3);
    expect(c.into_id).toBe(4);
    expect(c.submitted_by).toBeNull();
  });
});

describe('RenameCorrection', () => {
  it('has type "rename", target_type, target_id, new_name, rationale, submitted_by', () => {
    const c = {
      type: 'rename' as const,
      target_type: 'canonical_location' as const,
      target_id: 10,
      new_name: 'The Atrium of Time',
      rationale: 'Official name',
      submitted_by: 'user@example.com',
    } satisfies RenameCorrection;
    expect(c.type).toBe('rename');
    expect(c.target_id).toBe(10);
    expect(c.new_name).toBe('The Atrium of Time');
  });
});

describe('FactualFixCorrection', () => {
  it('has type "factual_fix", target_type, target_id, field, old_value, new_value, rationale', () => {
    const c = {
      type: 'factual_fix' as const,
      target_type: 'notable_detail' as const,
      target_id: 228,
      field: 'revealed_at_book',
      old_value: '1',
      new_value: '4',
      rationale: 'Revealed in book 4',
      submitted_by: null,
    } satisfies FactualFixCorrection;
    expect(c.type).toBe('factual_fix');
    expect(c.field).toBe('revealed_at_book');
    expect(c.old_value).toBe('1');
    expect(c.new_value).toBe('4');
  });
});

describe('Correction discriminated union', () => {
  it('narrows to MergeCorrection on type === "merge"', () => {
    const c: Correction = {
      type: 'merge',
      target_type: 'character',
      source_ids: [1, 2],
      into_id: 3,
      rationale: 'Same',
      submitted_by: null,
    };
    if (c.type === 'merge') {
      expect(c.source_ids).toBeDefined();
      expect(c.into_id).toBe(3);
    } else {
      throw new Error('Expected merge branch');
    }
  });

  it('narrows to RenameCorrection on type === "rename"', () => {
    const c: Correction = {
      type: 'rename',
      target_type: 'character',
      target_id: 5,
      new_name: 'New Name',
      rationale: 'Correction',
      submitted_by: null,
    };
    if (c.type === 'rename') {
      expect(c.target_id).toBe(5);
      expect(c.new_name).toBe('New Name');
    } else {
      throw new Error('Expected rename branch');
    }
  });

  it('narrows to FactualFixCorrection on type === "factual_fix"', () => {
    const c: Correction = {
      type: 'factual_fix',
      target_type: 'factual_claim',
      target_id: 1,
      field: 'claim',
      old_value: 'old',
      new_value: 'new',
      rationale: 'Fix',
      submitted_by: null,
    };
    if (c.type === 'factual_fix') {
      expect(c.field).toBe('claim');
      expect(c.old_value).toBe('old');
    } else {
      throw new Error('Expected factual_fix branch');
    }
  });
});

// ─── assertSchema() ───────────────────────────────────────────────────────────

describe('assertSchema()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when all required tables and columns are present', () => {
    const db = createMockDb(COMPLETE_SCHEMA);
    expect(assertSchema(db)).toBe(true);
  });

  it('returns false when chapters table is missing', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['chapters'];
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when scenes table is missing', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['scenes'];
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when characters table is missing', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['characters'];
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when factual_claims table is missing', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['factual_claims'];
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when evidence_fts table is missing', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['evidence_fts'];
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when scenes.revealed_at_book is missing', () => {
    const schema = {
      ...COMPLETE_SCHEMA,
      scenes: COMPLETE_SCHEMA['scenes']!.filter((c) => c !== 'revealed_at_book'),
    };
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when scenes.revealed_at_chapter is missing', () => {
    const schema = {
      ...COMPLETE_SCHEMA,
      scenes: COMPLETE_SCHEMA['scenes']!.filter((c) => c !== 'revealed_at_chapter'),
    };
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when factual_claims.revealed_at_book is missing', () => {
    const schema = {
      ...COMPLETE_SCHEMA,
      factual_claims: COMPLETE_SCHEMA['factual_claims']!.filter(
        (c) => c !== 'revealed_at_book',
      ),
    };
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('returns false when factual_claims.revealed_at_chapter is missing', () => {
    const schema = {
      ...COMPLETE_SCHEMA,
      factual_claims: COMPLETE_SCHEMA['factual_claims']!.filter(
        (c) => c !== 'revealed_at_chapter',
      ),
    };
    expect(assertSchema(createMockDb(schema))).toBe(false);
  });

  it('logs console.error naming the missing table on drift', () => {
    const schema = { ...COMPLETE_SCHEMA };
    delete schema['chapters'];
    assertSchema(createMockDb(schema));
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      expect.stringContaining('chapters'),
    );
  });

  it('logs console.error naming the missing column on drift', () => {
    const schema = {
      ...COMPLETE_SCHEMA,
      scenes: COMPLETE_SCHEMA['scenes']!.filter((c) => c !== 'revealed_at_book'),
    };
    assertSchema(createMockDb(schema));
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      expect.stringContaining('revealed_at_book'),
    );
  });

  it('does not throw on schema drift — degrades gracefully', () => {
    expect(() => assertSchema(createMockDb({}))).not.toThrow();
  });

  it('returns false (not undefined/null) when schema is empty', () => {
    expect(assertSchema(createMockDb({}))).toBe(false);
  });

  it('does not call console.error when schema is complete', () => {
    assertSchema(createMockDb(COMPLETE_SCHEMA));
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });
});
