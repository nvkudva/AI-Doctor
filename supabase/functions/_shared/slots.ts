// Slot filling (AGENT-EXPERIENCE §3.2, DATA-MODEL §2.7).
//
// The model proposes; this module decides what is written. Every accepted fill
// carries an evidence span that was *verified* against the patient's own words —
// a span the model asserted but that does not match the transcript is dropped and
// the fill is demoted to `inferred`, because a fabricated citation is worse for the
// reviewing doctor than a missing one.

import { isSlotId, type SlotId } from './protocols/index.ts';
import { type SlotState } from './questionnaire.ts';

export type Extraction = {
  slot_id?: unknown;
  value?: unknown;
  confidence?: unknown;
  evidence_quote?: unknown;
};

export type SlotWrite = {
  slot_id: SlotId;
  status: 'filled' | 'unanswered' | 'refused' | 'asked';
  value: string | null;
  confidence: number;
  source: 'patient' | 'record' | 'inferred';
  evidence_span?: [number, number];
};

export type SlotRejection = { slot: string; reason: string };

const MAX_VALUE = 500;

/** `red_flag_screen` is written by the engine from the protocol screen, never by the
 *  extractor: a model must not be able to close the screen by asserting a value. */
const ENGINE_OWNED: SlotId[] = ['red_flag_screen'];

function clampConfidence(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function findSpan(haystack: string, needle: string): [number, number] | null {
  if (!needle) return null;
  const at = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return null;
  return [at, at + needle.length];
}

/**
 * Validates a turn's extractions against the patient's utterance and the slots
 * already held. Opportunistic multi-slot fill is expected and allowed (§3.5); what
 * is not allowed is re-writing a slot the consult already has on weaker evidence.
 */
export function acceptExtractions(
  raw: unknown,
  patientText: string,
  current: Map<SlotId, SlotState>,
): { writes: SlotWrite[]; rejected: SlotRejection[] } {
  const rejected: SlotRejection[] = [];
  const byslot = new Map<SlotId, SlotWrite>();
  const list = Array.isArray(raw) ? raw : [];

  for (const entry of list as Extraction[]) {
    const slot = entry?.slot_id;
    if (!isSlotId(slot)) {
      rejected.push({ slot: String(slot), reason: 'not_a_slot_id' });
      continue;
    }
    if (ENGINE_OWNED.includes(slot)) {
      rejected.push({ slot, reason: 'engine_owned_slot' });
      continue;
    }
    const value = typeof entry.value === 'string' ? entry.value.trim().slice(0, MAX_VALUE) : '';
    if (!value) {
      rejected.push({ slot, reason: 'empty_value' });
      continue;
    }

    let confidence = clampConfidence(entry.confidence);
    let source: SlotWrite['source'] = 'patient';
    const quote = typeof entry.evidence_quote === 'string' ? entry.evidence_quote.trim() : '';
    let span = findSpan(patientText, quote) ?? findSpan(patientText, value);

    if (!span) {
      // Nothing in the utterance backs it. Keep it — it may be a correct inference
      // across turns — but say so, and cost it confidence.
      source = 'inferred';
      confidence = Math.min(confidence, 0.5) * 0.8;
      span = null;
    }

    // The patient's own words, preserved verbatim (§3.5). If the model paraphrased
    // the complaint, take the utterance instead of the paraphrase.
    let finalValue = value;
    if (slot === 'presenting_complaint' && !findSpan(patientText, value)) {
      finalValue = patientText.trim().slice(0, MAX_VALUE);
      source = 'patient';
      span = [0, Math.min(patientText.trim().length, MAX_VALUE)];
    }

    const existing = current.get(slot);
    if (existing && existing.status === 'filled' && (existing.confidence ?? 0) >= confidence) {
      rejected.push({ slot, reason: 'already_filled_with_equal_or_better_confidence' });
      continue;
    }

    const previous = byslot.get(slot);
    if (previous && previous.confidence >= confidence) continue;

    byslot.set(slot, {
      slot_id: slot,
      status: 'filled',
      value: finalValue,
      confidence: Number(confidence.toFixed(2)),
      source,
      ...(span ? { evidence_span: span } : {}),
    });
  }

  return { writes: [...byslot.values()], rejected };
}

/** Marks a slot the patient has now dodged twice. Surfaced to the doctor, never guessed. */
export function markUnanswered(slot: SlotId): SlotWrite {
  return { slot_id: slot, status: 'unanswered', value: null, confidence: 0, source: 'patient' };
}

/** The screen result, written by the engine once every applicable red flag is answered. */
export function screenSummarySlot(summary: string): SlotWrite {
  return { slot_id: 'red_flag_screen', status: 'filled', value: summary.slice(0, MAX_VALUE), confidence: 1, source: 'patient' };
}
