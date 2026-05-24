/**
 * Tests for web/src/lib/corrections.ts
 * TASK-027: composeCorrection, serializeYAML, buildGitHubPRURL, ValidationError
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  composeCorrection,
  serializeYAML,
  buildGitHubPRURL,
  ValidationError,
} from '../corrections';
import type {
  MergeFormState,
  RenameFormState,
  FactualFixFormState,
} from '../corrections';

// ─── Fixture form states ──────────────────────────────────────────────────────

const MERGE_VALID: MergeFormState = {
  type: 'merge',
  target_type: 'character',
  source_ids: '1, 2',
  into_id: '3',
  rationale: 'Same person across narrative distance.',
  submitted_by: '',
};

const RENAME_VALID: RenameFormState = {
  type: 'rename',
  target_type: 'character',
  target_id: '5',
  new_name: 'Severian of the Guild',
  rationale: 'Canonical form preferred for the index.',
  submitted_by: 'user@example.com',
};

const FACTUAL_FIX_VALID: FactualFixFormState = {
  type: 'factual_fix',
  target_type: 'notable_detail',
  target_id: '228',
  field: 'revealed_at_book',
  old_value: '1',
  new_value: '4',
  rationale: 'Confirmed in B4C34.',
  submitted_by: '',
};

// ─── ValidationError ──────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('is an instance of Error', () => {
    const e = new ValidationError({ field: 'Field is required' });
    expect(e).toBeInstanceOf(Error);
  });

  it('has name "ValidationError"', () => {
    const e = new ValidationError({ field: 'Field is required' });
    expect(e.name).toBe('ValidationError');
  });

  it('exposes the fields property', () => {
    const fields = { rationale: 'Required', new_name: 'Required' };
    const e = new ValidationError(fields);
    expect(e.fields).toEqual(fields);
  });

  it('formats message from field values', () => {
    const e = new ValidationError({ rationale: 'Rationale is required' });
    expect(e.message).toBe('Rationale is required');
  });
});

// ─── composeCorrection — merge ────────────────────────────────────────────────

describe('composeCorrection (merge)', () => {
  it('returns a MergeCorrection from valid form state', () => {
    const c = composeCorrection(MERGE_VALID);
    expect(c.type).toBe('merge');
    expect(c.target_type).toBe('character');
    if (c.type === 'merge') {
      expect(c.source_ids).toEqual([1, 2]);
      expect(c.into_id).toBe(3);
    }
    expect(c.rationale).toBe('Same person across narrative distance.');
    expect(c.submitted_by).toBeNull();
  });

  it('parses source_ids with varied whitespace around commas', () => {
    const c = composeCorrection({ ...MERGE_VALID, source_ids: ' 7 ,  8 , 9 ' });
    if (c.type === 'merge') {
      expect(c.source_ids).toEqual([7, 8, 9]);
    }
  });

  it('sets submitted_by when provided', () => {
    const c = composeCorrection({ ...MERGE_VALID, submitted_by: 'ewhitling' });
    expect(c.submitted_by).toBe('ewhitling');
  });

  it('throws ValidationError when target_type is empty', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, target_type: '' }),
    ).toThrow(ValidationError);
  });

  it('includes target_type in error fields when missing', () => {
    try {
      composeCorrection({ ...MERGE_VALID, target_type: '' });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fields['target_type']).toBeTruthy();
    }
  });

  it('throws ValidationError when source_ids has fewer than 2 entries', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, source_ids: '1' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when source_ids is empty', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, source_ids: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when source_ids contains non-numeric values', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, source_ids: '1, abc' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when into_id is empty', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, into_id: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when into_id is not a number', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, into_id: 'abc' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when rationale is whitespace only', () => {
    expect(() =>
      composeCorrection({ ...MERGE_VALID, rationale: '   ' }),
    ).toThrow(ValidationError);
  });

  it('trims whitespace from rationale', () => {
    const c = composeCorrection({ ...MERGE_VALID, rationale: '  Same person.  ' });
    expect(c.rationale).toBe('Same person.');
  });
});

// ─── composeCorrection — rename ───────────────────────────────────────────────

describe('composeCorrection (rename)', () => {
  it('returns a RenameCorrection from valid form state', () => {
    const c = composeCorrection(RENAME_VALID);
    expect(c.type).toBe('rename');
    expect(c.target_type).toBe('character');
    if (c.type === 'rename') {
      expect(c.target_id).toBe(5);
      expect(c.new_name).toBe('Severian of the Guild');
    }
    expect(c.rationale).toBe('Canonical form preferred for the index.');
    expect(c.submitted_by).toBe('user@example.com');
  });

  it('trims whitespace from new_name', () => {
    const c = composeCorrection({ ...RENAME_VALID, new_name: '  Trimmed Name  ' });
    if (c.type === 'rename') {
      expect(c.new_name).toBe('Trimmed Name');
    }
  });

  it('throws ValidationError when target_type is empty', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, target_type: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when target_id is empty', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, target_id: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when target_id is not a number', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, target_id: 'xyz' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when new_name is empty', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, new_name: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when new_name is whitespace only', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, new_name: '   ' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when rationale is empty', () => {
    expect(() =>
      composeCorrection({ ...RENAME_VALID, rationale: '' }),
    ).toThrow(ValidationError);
  });

  it('sets submitted_by to null when blank', () => {
    const c = composeCorrection({ ...RENAME_VALID, submitted_by: '' });
    expect(c.submitted_by).toBeNull();
  });
});

// ─── composeCorrection — factual_fix ─────────────────────────────────────────

describe('composeCorrection (factual_fix)', () => {
  it('returns a FactualFixCorrection from valid form state', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(c.type).toBe('factual_fix');
    expect(c.target_type).toBe('notable_detail');
    if (c.type === 'factual_fix') {
      expect(c.target_id).toBe(228);
      expect(c.field).toBe('revealed_at_book');
      expect(c.old_value).toBe('1');
      expect(c.new_value).toBe('4');
    }
    expect(c.rationale).toBe('Confirmed in B4C34.');
    expect(c.submitted_by).toBeNull();
  });

  it('throws ValidationError when target_type is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, target_type: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when target_id is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, target_id: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when field is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, field: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when old_value is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, old_value: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when new_value is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, new_value: '' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when rationale is empty', () => {
    expect(() =>
      composeCorrection({ ...FACTUAL_FIX_VALID, rationale: '' }),
    ).toThrow(ValidationError);
  });

  it('accumulates multiple field errors in a single throw', () => {
    try {
      composeCorrection({
        ...FACTUAL_FIX_VALID,
        field: '',
        new_value: '',
        rationale: '',
      });
      expect.fail('Expected ValidationError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(Object.keys((e as ValidationError).fields).length).toBeGreaterThan(1);
    }
  });

  it('accepts ClaimTargetType values for target_type', () => {
    const types = [
      'factual_claim',
      'notable_detail',
      'scene',
      'embedded_narrative',
      'death_event',
    ] as const;
    for (const tt of types) {
      const c = composeCorrection({ ...FACTUAL_FIX_VALID, target_type: tt });
      expect(c.target_type).toBe(tt);
    }
  });
});

// ─── serializeYAML ────────────────────────────────────────────────────────────

describe('serializeYAML', () => {
  it('serializes a MergeCorrection', () => {
    const c = composeCorrection(MERGE_VALID);
    const yaml = serializeYAML(c);
    expect(yaml).toContain('type: merge');
    expect(yaml).toContain('target_type: character');
    expect(yaml).toContain('source_ids: [1, 2]');
    expect(yaml).toContain('into_id: 3');
    expect(yaml).toContain('rationale: >');
  });

  it('serializes a RenameCorrection', () => {
    const c = composeCorrection(RENAME_VALID);
    const yaml = serializeYAML(c);
    expect(yaml).toContain('type: rename');
    expect(yaml).toContain('target_type: character');
    expect(yaml).toContain('target_id: 5');
    expect(yaml).toContain('new_name: Severian of the Guild');
    expect(yaml).toContain('rationale: >');
  });

  it('serializes a FactualFixCorrection', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const yaml = serializeYAML(c);
    expect(yaml).toContain('type: factual_fix');
    expect(yaml).toContain('target_type: notable_detail');
    expect(yaml).toContain('target_id: 228');
    expect(yaml).toContain('field: revealed_at_book');
  });

  it('double-quotes old_value and new_value that look like numbers', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const yaml = serializeYAML(c);
    expect(yaml).toContain('old_value: "1"');
    expect(yaml).toContain('new_value: "4"');
  });

  it('double-quotes chapter-number string values', () => {
    const c = composeCorrection({
      ...FACTUAL_FIX_VALID,
      field: 'revealed_at_chapter',
      old_value: '23',
      new_value: '37',
    });
    const yaml = serializeYAML(c);
    expect(yaml).toContain('old_value: "23"');
    expect(yaml).toContain('new_value: "37"');
  });

  it('does not quote old_value / new_value that are plain strings', () => {
    const c = composeCorrection({
      ...FACTUAL_FIX_VALID,
      old_value: 'Severian',
      new_value: 'Severian of the Guild',
    });
    const yaml = serializeYAML(c);
    expect(yaml).toContain('old_value: Severian\n');
    expect(yaml).toContain('new_value: Severian of the Guild\n');
  });

  it('omits submitted_by when null', () => {
    const c = composeCorrection(MERGE_VALID); // submitted_by: ''
    expect(serializeYAML(c)).not.toContain('submitted_by');
  });

  it('includes submitted_by when non-null', () => {
    const c = composeCorrection(RENAME_VALID); // submitted_by: 'user@example.com'
    const yaml = serializeYAML(c);
    expect(yaml).toContain('submitted_by:');
    expect(yaml).toContain('user@example.com');
  });

  it('uses > folded block scalar for rationale', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(serializeYAML(c)).toMatch(/rationale: >\n {2}/);
  });

  it('indents rationale body by 2 spaces', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const yaml = serializeYAML(c);
    const rationaleLineIdx = yaml.split('\n').findIndex((l) => l.startsWith('rationale:'));
    const bodyLine = yaml.split('\n')[rationaleLineIdx + 1];
    expect(bodyLine).toMatch(/^ {2}\S/);
  });

  it('ends with a trailing newline', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(serializeYAML(c)).toMatch(/\n$/);
  });

  it('does not include into_id, source_ids on rename', () => {
    const yaml = serializeYAML(composeCorrection(RENAME_VALID));
    expect(yaml).not.toContain('source_ids');
    expect(yaml).not.toContain('into_id');
  });

  it('does not include new_name on factual_fix', () => {
    const yaml = serializeYAML(composeCorrection(FACTUAL_FIX_VALID));
    expect(yaml).not.toContain('new_name');
  });
});

// ─── buildGitHubPRURL ─────────────────────────────────────────────────────────

describe('buildGitHubPRURL', () => {
  const FIXED_DATE = new Date('2024-01-15T14:30:22.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a valid URL (parseable by URL constructor)', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(() => new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'))).not.toThrow();
  });

  it('returns a github.com URL', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book')).toMatch(
      /^https:\/\/github\.com\//,
    );
  });

  it('includes owner and repo in the path', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    expect(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book')).toContain(
      '/ewhitling/the-brown-book/new/main',
    );
  });

  it('includes filename param with timestamp, type, and slug', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'));
    const filename = parsed.searchParams.get('filename');
    expect(filename).toMatch(/^corrections\/20240115T143022-factual_fix-.+\.yaml$/);
  });

  it('puts the YAML content in the value param', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'));
    const value = parsed.searchParams.get('value');
    expect(value).toContain('type: factual_fix');
    expect(value).toContain('target_type: notable_detail');
    expect(value).toContain('old_value: "1"');
  });

  it('includes a non-empty message param', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'));
    const message = parsed.searchParams.get('message');
    expect(message).toBeTruthy();
    expect(message).toContain('factual_fix');
  });

  it('includes correction type in the filename for merge', () => {
    const c = composeCorrection(MERGE_VALID);
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'));
    expect(parsed.searchParams.get('filename')).toContain('merge');
  });

  it('includes correction type in the filename for rename', () => {
    const c = composeCorrection(RENAME_VALID);
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book'));
    expect(parsed.searchParams.get('filename')).toContain('rename');
  });

  it('accepts a custom _now date for testable timestamps', () => {
    const c = composeCorrection(FACTUAL_FIX_VALID);
    const customDate = new Date('2099-12-31T23:59:59.000Z');
    const parsed = new URL(buildGitHubPRURL(c, 'ewhitling', 'the-brown-book', customDate));
    expect(parsed.searchParams.get('filename')).toContain('20991231T235959');
  });
});
