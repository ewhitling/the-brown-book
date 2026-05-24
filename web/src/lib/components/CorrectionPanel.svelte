<!--
  CorrectionPanel.svelte — TASK-027 (Scene 6).
  Slide-in panel shown when the reader clicks the Flag affordance.

  Three correction types:
    factual_fix — edit a specific field on a claim, detail, scene, etc.
    rename      — update the canonical name of a character or location
    merge       — consolidate duplicate entity rows into one

  On submit: composes a Correction, serialises to YAML, and opens the
  GitHub new-file editor pre-filled with the content.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PassageItem } from '../types';
  import type { ClaimTargetType } from '../types';
  import type {
    MergeFormState,
    RenameFormState,
    FactualFixFormState,
    FormState,
  } from '../corrections';
  import { composeCorrection, buildGitHubPRURL, ValidationError } from '../corrections';

  export let item: PassageItem;

  const dispatch = createEventDispatcher<{ close: void }>();

  const REPO_OWNER = 'ewhitling';
  const REPO_NAME = 'the-brown-book';

  // ─── Item context helpers ──────────────────────────────────────────────────

  function onClose(): void {
    dispatch('close');
  }

  function byline(i: PassageItem): string {
    return `${i.type} · Book ${i.chapter.book_id}, Ch ${i.chapter.number} · '${i.chapter.title}'`;
  }

  const EXCERPT_MAX = 280;
  $: excerpt =
    item.text.length > EXCERPT_MAX
      ? item.text.slice(0, EXCERPT_MAX).trimEnd() + '…'
      : item.text;

  // ─── Auto-detection ────────────────────────────────────────────────────────

  /** Extract the numeric portion from "type:123" item IDs. */
  function numericId(id: string): string {
    const colon = id.indexOf(':');
    return colon === -1 ? '' : id.slice(colon + 1);
  }

  /** Map PassageType → ClaimTargetType for factual_fix pre-fill. */
  function toClaimTargetType(passageType: string): ClaimTargetType | '' {
    const map: Record<string, ClaimTargetType> = {
      claim: 'factual_claim',
      detail: 'notable_detail',
      scene: 'scene',
      embedded: 'embedded_narrative',
    };
    return (map[passageType] as ClaimTargetType) ?? '';
  }

  const autoClaimType = toClaimTargetType(item.type);
  const autoId = numericId(item.id);

  // ─── Form state ────────────────────────────────────────────────────────────

  type CorrectionType = 'merge' | 'rename' | 'factual_fix' | '';

  // Pre-select factual_fix if the item maps to a claim type
  let correctionType: CorrectionType = autoClaimType ? 'factual_fix' : '';

  // Merge fields
  let mergeTargetType: 'character' | 'canonical_location' | '' = '';
  let mergeSourceIds = '';
  let mergeIntoId = '';
  let mergeRationale = '';

  // Rename fields
  let renameTargetType: 'character' | 'canonical_location' | '' = '';
  let renameTargetId = autoId;
  let renameNewName = '';
  let renameRationale = '';

  // Factual fix fields
  let fixTargetType: ClaimTargetType | '' = autoClaimType;
  let fixTargetId = autoId;
  let fixField = '';
  let fixOldValue = '';
  let fixNewValue = '';
  let fixRationale = '';

  // Shared optional field
  let submittedBy = '';

  // ─── Validation errors ─────────────────────────────────────────────────────

  let errors: Record<string, string> = {};

  // ─── Submit ────────────────────────────────────────────────────────────────

  function buildFormState(): FormState | null {
    if (correctionType === 'merge') {
      return {
        type: 'merge',
        target_type: mergeTargetType,
        source_ids: mergeSourceIds,
        into_id: mergeIntoId,
        rationale: mergeRationale,
        submitted_by: submittedBy,
      } satisfies MergeFormState;
    }
    if (correctionType === 'rename') {
      return {
        type: 'rename',
        target_type: renameTargetType,
        target_id: renameTargetId,
        new_name: renameNewName,
        rationale: renameRationale,
        submitted_by: submittedBy,
      } satisfies RenameFormState;
    }
    if (correctionType === 'factual_fix') {
      return {
        type: 'factual_fix',
        target_type: fixTargetType,
        target_id: fixTargetId,
        field: fixField,
        old_value: fixOldValue,
        new_value: fixNewValue,
        rationale: fixRationale,
        submitted_by: submittedBy,
      } satisfies FactualFixFormState;
    }
    return null;
  }

  function onSubmit(): void {
    errors = {};

    if (!correctionType) {
      errors = { type: 'Select a correction type above' };
      return;
    }

    const state = buildFormState();
    if (!state) return;

    try {
      const correction = composeCorrection(state);
      const url = buildGitHubPRURL(correction, REPO_OWNER, REPO_NAME);
      window.open(url, '_blank');
    } catch (e) {
      if (e instanceof ValidationError) {
        errors = e.fields;
      } else {
        throw e;
      }
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="correction-backdrop" on:click={onClose}></div>

<aside
  class="correction-panel"
  role="dialog"
  aria-modal="true"
  aria-label="Suggest a correction"
>
  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <header class="correction-header">
    <h2 class="correction-title ui">Suggest a correction</h2>
    <button
      class="correction-close ui"
      type="button"
      on:click={onClose}
      aria-label="Close"
    >
      &times;
    </button>
  </header>

  <!-- ── Item context (read-only) ────────────────────────────────────────── -->
  <div class="correction-context">
    <p class="correction-byline meta">{byline(item)}</p>
    <blockquote class="correction-excerpt">{excerpt}</blockquote>
  </div>

  <!-- ── Correction type selector ───────────────────────────────────────── -->
  <fieldset class="type-selector" aria-label="Correction type">
    <legend class="field-label">Correction type</legend>
    <div class="type-chips">
      <label class="type-chip" class:selected={correctionType === 'factual_fix'}>
        <input
          type="radio"
          name="correction-type"
          value="factual_fix"
          bind:group={correctionType}
        />
        Factual fix
      </label>
      <label class="type-chip" class:selected={correctionType === 'rename'}>
        <input
          type="radio"
          name="correction-type"
          value="rename"
          bind:group={correctionType}
        />
        Rename
      </label>
      <label class="type-chip" class:selected={correctionType === 'merge'}>
        <input
          type="radio"
          name="correction-type"
          value="merge"
          bind:group={correctionType}
        />
        Merge entities
      </label>
    </div>
    {#if errors['type']}
      <p class="field-error" role="alert">{errors['type']}</p>
    {/if}
  </fieldset>

  <!-- ── Factual fix fields ─────────────────────────────────────────────── -->
  {#if correctionType === 'factual_fix'}
    <div class="form-section">
      <div class="field-group">
        <label class="field-label" for="fix-target-type">Item type</label>
        <select
          id="fix-target-type"
          class="field-input"
          class:field-error-border={errors['target_type']}
          bind:value={fixTargetType}
        >
          <option value="">— select —</option>
          <option value="factual_claim">Factual claim</option>
          <option value="notable_detail">Notable detail</option>
          <option value="scene">Scene</option>
          <option value="embedded_narrative">Embedded narrative</option>
          <option value="death_event">Death event</option>
        </select>
        {#if errors['target_type']}
          <p class="field-error" role="alert">{errors['target_type']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="fix-target-id">Item ID</label>
        <input
          id="fix-target-id"
          type="text"
          class="field-input"
          class:field-error-border={errors['target_id']}
          bind:value={fixTargetId}
          placeholder="e.g. 228"
        />
        {#if errors['target_id']}
          <p class="field-error" role="alert">{errors['target_id']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="fix-field">Field to correct</label>
        <input
          id="fix-field"
          type="text"
          class="field-input"
          class:field-error-border={errors['field']}
          bind:value={fixField}
          placeholder="e.g. revealed_at_book"
          list="fix-field-suggestions"
        />
        <datalist id="fix-field-suggestions">
          <option value="revealed_at_book" />
          <option value="revealed_at_chapter" />
          <option value="claim" />
          <option value="summary" />
          <option value="location" />
        </datalist>
        {#if errors['field']}
          <p class="field-error" role="alert">{errors['field']}</p>
        {/if}
      </div>

      <div class="field-row">
        <div class="field-group">
          <label class="field-label" for="fix-old-value">Current value</label>
          <input
            id="fix-old-value"
            type="text"
            class="field-input"
            class:field-error-border={errors['old_value']}
            bind:value={fixOldValue}
            placeholder="the value currently in the DB"
          />
          <small class="field-hint-block">
            Enter the exact value as it appears in the database — the correction
            will be rejected if this does not match.
          </small>
          {#if errors['old_value']}
            <p class="field-error" role="alert">{errors['old_value']}</p>
          {/if}
        </div>
        <div class="field-group">
          <label class="field-label" for="fix-new-value">Corrected value</label>
          <input
            id="fix-new-value"
            type="text"
            class="field-input"
            class:field-error-border={errors['new_value']}
            bind:value={fixNewValue}
            placeholder="correct value"
          />
          {#if errors['new_value']}
            <p class="field-error" role="alert">{errors['new_value']}</p>
          {/if}
        </div>
      </div>

      <div class="field-group">
        <label class="field-label" for="fix-rationale">Rationale</label>
        <textarea
          id="fix-rationale"
          class="field-input field-textarea"
          class:field-error-border={errors['rationale']}
          bind:value={fixRationale}
          placeholder="Why is this value wrong, and what's the correct source?"
          rows="3"
        ></textarea>
        {#if errors['rationale']}
          <p class="field-error" role="alert">{errors['rationale']}</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── Rename fields ──────────────────────────────────────────────────── -->
  {#if correctionType === 'rename'}
    <div class="form-section">
      <div class="field-group">
        <label class="field-label" for="rename-target-type">Entity type</label>
        <select
          id="rename-target-type"
          class="field-input"
          class:field-error-border={errors['target_type']}
          bind:value={renameTargetType}
        >
          <option value="">— select —</option>
          <option value="character">Character</option>
          <option value="canonical_location">Location</option>
        </select>
        {#if errors['target_type']}
          <p class="field-error" role="alert">{errors['target_type']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="rename-target-id">Entity ID</label>
        <input
          id="rename-target-id"
          type="text"
          class="field-input"
          class:field-error-border={errors['target_id']}
          bind:value={renameTargetId}
          placeholder="e.g. 5"
        />
        {#if errors['target_id']}
          <p class="field-error" role="alert">{errors['target_id']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="rename-new-name">New canonical name</label>
        <input
          id="rename-new-name"
          type="text"
          class="field-input"
          class:field-error-border={errors['new_name']}
          bind:value={renameNewName}
          placeholder="e.g. Severian of the Guild"
        />
        {#if errors['new_name']}
          <p class="field-error" role="alert">{errors['new_name']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="rename-rationale">Rationale</label>
        <textarea
          id="rename-rationale"
          class="field-input field-textarea"
          class:field-error-border={errors['rationale']}
          bind:value={renameRationale}
          placeholder="Why is this the correct canonical name?"
          rows="3"
        ></textarea>
        {#if errors['rationale']}
          <p class="field-error" role="alert">{errors['rationale']}</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── Merge fields ───────────────────────────────────────────────────── -->
  {#if correctionType === 'merge'}
    <div class="form-section">
      <div class="field-group">
        <label class="field-label" for="merge-target-type">Entity type</label>
        <select
          id="merge-target-type"
          class="field-input"
          class:field-error-border={errors['target_type']}
          bind:value={mergeTargetType}
        >
          <option value="">— select —</option>
          <option value="character">Character</option>
          <option value="canonical_location">Location</option>
        </select>
        {#if errors['target_type']}
          <p class="field-error" role="alert">{errors['target_type']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="merge-source-ids">
          Duplicate IDs to merge
          <span class="field-hint">(comma-separated)</span>
        </label>
        <input
          id="merge-source-ids"
          type="text"
          class="field-input"
          class:field-error-border={errors['source_ids']}
          bind:value={mergeSourceIds}
          placeholder="e.g. 1, 2"
        />
        {#if errors['source_ids']}
          <p class="field-error" role="alert">{errors['source_ids']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="merge-into-id">Canonical (keep) ID</label>
        <input
          id="merge-into-id"
          type="text"
          class="field-input"
          class:field-error-border={errors['into_id']}
          bind:value={mergeIntoId}
          placeholder="e.g. 3"
        />
        {#if errors['into_id']}
          <p class="field-error" role="alert">{errors['into_id']}</p>
        {/if}
      </div>

      <div class="field-group">
        <label class="field-label" for="merge-rationale">Rationale</label>
        <textarea
          id="merge-rationale"
          class="field-input field-textarea"
          class:field-error-border={errors['rationale']}
          bind:value={mergeRationale}
          placeholder="Why are these entries the same entity?"
          rows="3"
        ></textarea>
        {#if errors['rationale']}
          <p class="field-error" role="alert">{errors['rationale']}</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── Shared optional field + submit ────────────────────────────────── -->
  {#if correctionType}
    <div class="form-section form-footer">
      <div class="field-group">
        <label class="field-label" for="submitted-by">
          Your GitHub username
          <span class="field-hint">(optional)</span>
        </label>
        <input
          id="submitted-by"
          type="text"
          class="field-input"
          bind:value={submittedBy}
          placeholder="e.g. ewhitling"
        />
      </div>

      <button class="submit-btn" type="button" on:click={onSubmit}>
        Open PR on GitHub →
      </button>
    </div>
  {/if}

  <!-- ── Helper text ────────────────────────────────────────────────────── -->
  <p class="correction-helper meta">
    Corrections are reviewed in the open on GitHub. Merged ones are picked up
    by the next build.
  </p>
</aside>

<style>
  .correction-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 26, 0.22);
    z-index: 40;
  }

  .correction-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    width: min(28rem, 92vw);
    background: var(--paper);
    border-left: 1px solid var(--rule);
    padding: var(--space-8);
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ── Header ──────────────────────────────────────────────────────────── */

  .correction-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .correction-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
  }

  .correction-close {
    background: none;
    border: none;
    font-size: var(--text-xl);
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
  }

  .correction-close:hover {
    color: var(--ink);
  }

  /* ── Item context block ───────────────────────────────────────────────── */

  .correction-context {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--paper-deep);
    border-radius: 4px;
    border-left: 3px solid var(--rule);
  }

  .correction-byline {
    color: var(--muted);
  }

  .correction-excerpt {
    font-family: var(--font-serif);
    font-size: var(--text-base);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
    padding: 0;
    border: none;
  }

  /* ── Type selector ───────────────────────────────────────────────────── */

  .type-selector {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .type-chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .type-chip {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    font-size: var(--text-sm);
    color: var(--muted);
    cursor: pointer;
    user-select: none;
    transition: border-color 100ms ease, color 100ms ease, background 100ms ease;
  }

  .type-chip input[type='radio'] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .type-chip:hover {
    border-color: var(--accent-soft);
    color: var(--ink);
  }

  .type-chip.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 500;
  }

  /* ── Form sections ────────────────────────────────────────────────────── */

  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-footer {
    border-top: 1px solid var(--rule);
    padding-top: var(--space-4);
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--muted);
  }

  .field-hint {
    font-weight: 400;
    color: var(--whisper);
  }

  .field-hint-block {
    font-size: var(--text-xs);
    color: var(--muted);
    line-height: 1.4;
  }

  .field-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--paper);
    color: var(--ink);
    font-size: var(--text-sm);
    font-family: var(--font-sans);
    outline: none;
    box-sizing: border-box;
    transition: border-color 100ms ease;
  }

  .field-input:focus {
    border-color: var(--accent-soft);
  }

  .field-input.field-error-border {
    border-color: #c0392b;
  }

  .field-textarea {
    resize: vertical;
    min-height: 4.5rem;
    line-height: 1.5;
  }

  select.field-input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b665e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3) center;
    padding-right: var(--space-8);
    cursor: pointer;
  }

  .field-error {
    font-size: var(--text-xs);
    color: #c0392b;
    margin: 0;
  }

  /* ── Submit button ────────────────────────────────────────────────────── */

  .submit-btn {
    padding: var(--space-3) var(--space-6);
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: var(--text-sm);
    font-weight: 600;
    font-family: var(--font-sans);
    cursor: pointer;
    align-self: flex-start;
    transition: background 100ms ease;
  }

  .submit-btn:hover {
    background: var(--accent-soft);
  }

  /* ── Helper text ─────────────────────────────────────────────────────── */

  .correction-helper {
    color: var(--muted);
    margin-top: auto;
  }
</style>
