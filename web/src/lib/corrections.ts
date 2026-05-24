/**
 * TASK-027: Correction form state types, validation, YAML serialisation,
 * and GitHub PR URL builder.
 *
 * Public API:
 *   composeCorrection(formState) -> Correction
 *   serializeYAML(correction)   -> string
 *   buildGitHubPRURL(correction, repoOwner, repoName) -> string
 */

import type {
  Correction,
  MergeCorrection,
  RenameCorrection,
  FactualFixCorrection,
  EntityTargetType,
  ClaimTargetType,
} from './types';

// ─── Form state types ────────────────────────────────────────────────────────

/** Raw form values for a merge correction (all fields are strings from inputs). */
export interface MergeFormState {
  type: 'merge';
  target_type: EntityTargetType | '';
  /** Comma-separated numeric IDs, e.g. "1, 2, 3" */
  source_ids: string;
  into_id: string;
  rationale: string;
  submitted_by: string;
}

/** Raw form values for a rename correction. */
export interface RenameFormState {
  type: 'rename';
  target_type: EntityTargetType | '';
  target_id: string;
  new_name: string;
  rationale: string;
  submitted_by: string;
}

/** Raw form values for a factual-fix correction. */
export interface FactualFixFormState {
  type: 'factual_fix';
  target_type: ClaimTargetType | '';
  target_id: string;
  field: string;
  /**
   * The current DB value of the field being corrected.
   * Must be entered manually — PassageItem does not carry individual field
   * values, so auto-prefill is not possible. Used by apply_corrections as a
   * safety guard: the correction is rejected if the DB field no longer matches.
   */
  old_value: string;
  new_value: string;
  rationale: string;
  submitted_by: string;
}

/** Discriminated union of all three form states. */
export type FormState = MergeFormState | RenameFormState | FactualFixFormState;

// ─── ValidationError ─────────────────────────────────────────────────────────

/**
 * Thrown by composeCorrection when one or more required fields are missing or
 * invalid. `fields` maps form field names to human-readable error messages.
 */
export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields).join('; '));
    this.name = 'ValidationError';
  }
}

// ─── composeCorrection ───────────────────────────────────────────────────────

/**
 * Validates `formState` and composes a typed Correction object.
 * Accumulates all field errors before throwing so the form can display them
 * all at once rather than one at a time.
 *
 * @throws {ValidationError} when any required field is missing or invalid.
 */
export function composeCorrection(formState: FormState): Correction {
  const errors: Record<string, string> = {};

  // ── merge ──────────────────────────────────────────────────────────────────
  if (formState.type === 'merge') {
    if (!formState.target_type) {
      errors['target_type'] = 'Target type is required';
    }

    const rawIds = formState.source_ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const source_ids = rawIds.map((s) => parseInt(s, 10));

    if (rawIds.length < 2) {
      errors['source_ids'] = 'At least two source IDs are required';
    } else if (source_ids.some((n) => isNaN(n))) {
      errors['source_ids'] = 'All source IDs must be numbers';
    }

    const into_id = parseInt(formState.into_id, 10);
    if (!formState.into_id.trim() || isNaN(into_id)) {
      errors['into_id'] = 'Target ID is required';
    }

    if (!formState.rationale.trim()) {
      errors['rationale'] = 'Rationale is required';
    }

    if (Object.keys(errors).length > 0) throw new ValidationError(errors);

    const c: MergeCorrection = {
      type: 'merge',
      target_type: formState.target_type as EntityTargetType,
      source_ids,
      into_id,
      rationale: formState.rationale.trim(),
      submitted_by: formState.submitted_by.trim() || null,
    };
    return c;
  }

  // ── rename ─────────────────────────────────────────────────────────────────
  if (formState.type === 'rename') {
    if (!formState.target_type) {
      errors['target_type'] = 'Target type is required';
    }

    const target_id = parseInt(formState.target_id, 10);
    if (!formState.target_id.trim() || isNaN(target_id)) {
      errors['target_id'] = 'Target ID is required';
    }

    if (!formState.new_name.trim()) {
      errors['new_name'] = 'New name is required';
    }

    if (!formState.rationale.trim()) {
      errors['rationale'] = 'Rationale is required';
    }

    if (Object.keys(errors).length > 0) throw new ValidationError(errors);

    const c: RenameCorrection = {
      type: 'rename',
      target_type: formState.target_type as EntityTargetType,
      target_id,
      new_name: formState.new_name.trim(),
      rationale: formState.rationale.trim(),
      submitted_by: formState.submitted_by.trim() || null,
    };
    return c;
  }

  // ── factual_fix ────────────────────────────────────────────────────────────
  if (formState.type === 'factual_fix') {
    if (!formState.target_type) {
      errors['target_type'] = 'Target type is required';
    }

    const target_id = parseInt(formState.target_id, 10);
    if (!formState.target_id.trim() || isNaN(target_id)) {
      errors['target_id'] = 'Target ID is required';
    }

    if (!formState.field.trim()) {
      errors['field'] = 'Field is required';
    }

    if (!formState.old_value) {
      errors['old_value'] = 'Current value is required';
    }

    if (!formState.new_value.trim()) {
      errors['new_value'] = 'New value is required';
    }

    if (!formState.rationale.trim()) {
      errors['rationale'] = 'Rationale is required';
    }

    if (Object.keys(errors).length > 0) throw new ValidationError(errors);

    const c: FactualFixCorrection = {
      type: 'factual_fix',
      target_type: formState.target_type as ClaimTargetType,
      target_id,
      field: formState.field.trim(),
      old_value: formState.old_value,
      new_value: formState.new_value.trim(),
      rationale: formState.rationale.trim(),
      submitted_by: formState.submitted_by.trim() || null,
    };
    return c;
  }

  // TypeScript exhaustive guard — unreachable at runtime if types are correct
  throw new ValidationError({ type: 'Unknown correction type' });
}

// ─── serializeYAML ───────────────────────────────────────────────────────────

/**
 * Wraps `v` in double quotes if a YAML parser might misread it as a non-string
 * scalar. Mirrors the quoting style in corrections/seed/*.yaml.
 */
function yamlString(v: string): string {
  if (
    v === '' ||
    /^-?[\d]+(\.\d+)?$/.test(v) ||
    /^(true|false|null|yes|no|on|off)$/i.test(v) ||
    /^[:{}\[\],#&*?|<>=!%@`]/.test(v)
  ) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}

/**
 * Serialises `correction` to YAML that validates against
 * core/models/corrections.py when loaded by PyYAML + Pydantic.
 *
 * Uses manual serialisation to avoid adding a js-yaml dependency.
 * Integer fields (target_id, into_id, source_ids) are unquoted.
 * String fields that look numeric (old_value, new_value, new_name) are
 * double-quoted. Rationale uses the folded block scalar (>).
 */
export function serializeYAML(correction: Correction): string {
  const lines: string[] = [];

  lines.push(`type: ${correction.type}`);
  lines.push(`target_type: ${correction.target_type}`);

  if (correction.type === 'merge') {
    lines.push(`source_ids: [${correction.source_ids.join(', ')}]`);
    lines.push(`into_id: ${correction.into_id}`);
  } else if (correction.type === 'rename') {
    lines.push(`target_id: ${correction.target_id}`);
    lines.push(`new_name: ${yamlString(correction.new_name)}`);
  } else {
    // factual_fix
    lines.push(`target_id: ${correction.target_id}`);
    lines.push(`field: ${correction.field}`);
    lines.push(`old_value: ${yamlString(correction.old_value)}`);
    lines.push(`new_value: ${yamlString(correction.new_value)}`);
  }

  // Rationale: folded block scalar with 2-space indent
  const rationaleBody = correction.rationale
    .split('\n')
    .map((l) => `  ${l}`)
    .join('\n');
  lines.push(`rationale: >\n${rationaleBody}`);

  if (correction.submitted_by !== null) {
    lines.push(`submitted_by: ${yamlString(correction.submitted_by)}`);
  }

  return lines.join('\n') + '\n';
}

// ─── buildGitHubPRURL ────────────────────────────────────────────────────────

/** Compact ISO timestamp for filenames: "20240115T143022" */
function compactTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15);
}

/** Filename-safe slug derived from the correction's key identifiers. */
function correctionSlug(correction: Correction): string {
  if (correction.type === 'merge') {
    return `${correction.target_type}-${correction.source_ids.join('-')}-into-${correction.into_id}`;
  }
  if (correction.type === 'rename') {
    const nameSlug = correction.new_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    return `${correction.target_type}-${correction.target_id}-${nameSlug}`;
  }
  // factual_fix
  return `${correction.target_type}-${correction.target_id}-${correction.field}`;
}

/**
 * Builds a GitHub "new file" URL pre-filled with the correction YAML.
 *
 * Format:
 *   https://github.com/<owner>/<repo>/new/main
 *     ?filename=corrections/<timestamp>-<type>-<slug>.yaml
 *     &value=<URL-encoded YAML>
 *     &message=<commit subject>
 *
 * On submit: window.open(url, '_blank').
 *
 * @param _now - Injectable Date for testing; defaults to new Date().
 */
export function buildGitHubPRURL(
  correction: Correction,
  repoOwner: string,
  repoName: string,
  _now: Date = new Date(),
): string {
  const yaml = serializeYAML(correction);
  const ts = compactTimestamp(_now);
  const slug = correctionSlug(correction);
  const filename = `corrections/${ts}-${correction.type}-${slug}.yaml`;
  const message = `correction(${correction.type}): ${correction.target_type} — ${slug}`;

  const params = new URLSearchParams({ filename, value: yaml, message });
  return `https://github.com/${repoOwner}/${repoName}/new/main?${params.toString()}`;
}
