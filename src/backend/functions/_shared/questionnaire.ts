// The deterministic next-question gate and the sufficiency rule
// (AGENT-EXPERIENCE §3.4, §3.6).
//
// This module decides. The model ranks candidates by information gain and phrases
// the question; it never chooses whether a red flag gets asked, never re-opens a
// filled slot, and never decides that the consult has enough to conclude. Those are
// the three decisions that must not be a prompt.

import {
  applicableConditionalSlots,
  applicableRedFlags,
  type Demographics,
  type Protocol,
  type RedFlag,
  type SlotId,
} from './protocols/index.ts';

export type SlotStatus = 'unknown' | 'asked' | 'filled' | 'refused' | 'not_applicable' | 'unanswered';

export type SlotState = {
  slot_id: SlotId;
  status: SlotStatus;
  value: string | null;
  confidence: number | null;
  source: 'patient' | 'record' | 'inferred';
  attempts: number;
};

export type ScreenEntry = { verdict: 'positive' | 'negative' | 'unclear'; asked: boolean; answer?: string };
export type ScreenState = Record<string, ScreenEntry>;

/** What the record already answers, so the agent confirms instead of asking. */
export type RecordFacts = {
  allergies: string[];
  medications: string[];
  conditions: string[];
};

export type GateContext = {
  protocol: Protocol;
  who: Demographics;
  slots: Map<SlotId, SlotState>;
  screen: ScreenState;
  record: RecordFacts;
  patientTurns: number;
  elapsedMs: number;
  /** Hard stops from §3.6 and the hospital quota. */
  maxPatientTurns: number;
  maxElapsedMs: number;
  quotaExhausted?: boolean;
  patientAskedToStop?: boolean;
};

export type Decision =
  /** A red flag is positive: history-taking is over (§3.7). */
  | { kind: 'stop_red_flag'; reason: string }
  /** Verbatim protocol wording. Not negotiable, not a model decision. */
  | { kind: 'red_flag_question'; flag: RedFlag; question: string; reason: string }
  /** The record answers it — confirm, never ask cold. */
  | { kind: 'confirm_record'; slot: SlotId; question: string; reason: string }
  /** The model ranks these by information gain; the engine bounds the set. */
  | { kind: 'ask_slot'; candidates: SlotId[]; defaultSlot: SlotId; defaultQuestion: string; reason: string }
  | { kind: 'conclude'; reason: string }
  | { kind: 'wrap_up'; reason: string };

const RECORD_BACKED: SlotId[] = ['allergies', 'current_medications', 'relevant_history'];

export function slotOf(ctx: GateContext, slot: SlotId): SlotState {
  return ctx.slots.get(slot) ?? { slot_id: slot, status: 'unknown', value: null, confidence: null, source: 'patient', attempts: 0 };
}

/** Filled, refused, not-applicable, or twice-attempted: never ask it again (§1.6). */
export function isClosed(state: SlotState): boolean {
  return state.status === 'filled' || state.status === 'refused' ||
    state.status === 'not_applicable' || state.status === 'unanswered' || state.attempts >= 2;
}

export function phrasingFor(protocol: Protocol, slot: SlotId, attempts: number): string {
  const pair = protocol.ask[slot];
  if (!pair) return 'Tell me a little more about that.';
  return attempts > 0 ? pair[1] : pair[0];
}

function recordValue(ctx: GateContext, slot: SlotId): string | null {
  const facts = slot === 'allergies'
    ? ctx.record.allergies
    : slot === 'current_medications'
    ? ctx.record.medications
    : slot === 'relevant_history'
    ? ctx.record.conditions
    : [];
  return facts.length ? facts.join(', ') : null;
}

/** Slots this consult may still ask about: template order plus applicable conditionals. */
export function openSlots(ctx: GateContext): SlotId[] {
  const conditional = applicableConditionalSlots(ctx.protocol, ctx.who);
  const ordered = [...ctx.protocol.slotOrder, ...conditional.filter((s) => !ctx.protocol.slotOrder.includes(s))];
  return ordered.filter((slot) => slot !== 'red_flag_screen' && !isClosed(slotOf(ctx, slot)));
}

/** The red flags for this patient that have not yet been answered either way. */
export function unansweredRedFlags(ctx: GateContext): RedFlag[] {
  return applicableRedFlags(ctx.protocol, ctx.who)
    .filter((flag) => {
      const entry = ctx.screen[flag.code];
      return !entry || entry.verdict === 'unclear';
    });
}

export function positiveRedFlags(ctx: GateContext): string[] {
  return Object.entries(ctx.screen).filter(([, e]) => e.verdict === 'positive').map(([code]) => code);
}

export function screenComplete(ctx: GateContext): boolean {
  return applicableRedFlags(ctx.protocol, ctx.who)
    .every((flag) => ctx.screen[flag.code] && ctx.screen[flag.code].verdict !== 'unclear');
}

export function missingRequired(ctx: GateContext): SlotId[] {
  return ctx.protocol.sufficientWhen.required.filter((slot) => {
    if (slot === 'red_flag_screen') return !screenComplete(ctx);
    return slotOf(ctx, slot).status !== 'filled';
  });
}

/**
 * §3.6, as code. Every clause is checked here and none of them is a model judgement.
 * `stableDifferential` and `noNewFills` are the caller's observations of the last two
 * turns; the required-slot and screen clauses are the ones that actually gate, and
 * the database re-checks the required slots again in `ai_submit_draft`.
 */
export function isSufficient(
  ctx: GateContext,
  signals: { stableDifferential: boolean; noNewFills: boolean },
): boolean {
  if (missingRequired(ctx).length > 0) return false;
  if (!screenComplete(ctx)) return false;
  if (ctx.patientTurns < ctx.protocol.sufficientWhen.minPatientTurns) return false;
  return signals.stableDifferential || signals.noNewFills;
}

/**
 * The gate. Order is fixed: emergency, then the mandatory screen, then the record,
 * then whatever the model thinks is most informative.
 */
export function nextStep(
  ctx: GateContext,
  signals: { stableDifferential: boolean; noNewFills: boolean },
): Decision {
  const positives = positiveRedFlags(ctx);
  if (positives.length > 0) {
    return { kind: 'stop_red_flag', reason: `red flag positive: ${positives.join(', ')}` };
  }

  if (ctx.patientAskedToStop) return { kind: 'wrap_up', reason: 'patient_request' };
  if (ctx.quotaExhausted) return { kind: 'wrap_up', reason: 'quota' };

  // 1. Hard gate. A red flag left unknown after two patient turns is the next
  //    question, in the protocol's exact words.
  const pending = unansweredRedFlags(ctx);
  if (pending.length > 0 && ctx.patientTurns >= 2) {
    const flag = pending[0];
    return { kind: 'red_flag_question', flag, question: flag.ask, reason: 'red_flag_screen_incomplete' };
  }

  const overTurns = ctx.patientTurns >= ctx.maxPatientTurns;
  const overTime = ctx.elapsedMs >= ctx.maxElapsedMs;

  if (isSufficient(ctx, signals)) return { kind: 'conclude', reason: 'sufficient' };
  if (overTurns || overTime) {
    // Still owed the screen: ask it even past the cap. A consult that concludes with
    // an incomplete screen is the one failure mode the cap must not cause.
    if (pending.length > 0) {
      const flag = pending[0];
      return { kind: 'red_flag_question', flag, question: flag.ask, reason: 'red_flag_screen_incomplete' };
    }
    return { kind: 'wrap_up', reason: overTurns ? 'turn_cap' : 'time_cap' };
  }

  // 2. Record first: confirm what we already hold rather than asking it cold.
  for (const slot of RECORD_BACKED) {
    const state = slotOf(ctx, slot);
    if (isClosed(state)) continue;
    const value = recordValue(ctx, slot);
    if (!value) continue;
    const template = ctx.protocol.confirm[slot];
    if (!template) continue;
    return {
      kind: 'confirm_record',
      slot,
      question: template.replace('{value}', value),
      reason: 'record_answers_this_slot',
    };
  }

  // 3 + 4. Everything still open goes to the ranker. Protocol order is the tiebreak
  //        and the fallback, never the script.
  const candidates = openSlots(ctx);
  if (candidates.length === 0) return { kind: 'conclude', reason: 'no_open_slots' };
  const defaultSlot = candidates[0];
  return {
    kind: 'ask_slot',
    candidates: candidates.slice(0, 6),
    defaultSlot,
    defaultQuestion: phrasingFor(ctx.protocol, defaultSlot, slotOf(ctx, defaultSlot).attempts),
    reason: 'information_gain',
  };
}

/** The slot the model picked, or the engine's default if it picked outside the set. */
export function resolveRankedSlot(decision: Decision, ranked: string | null | undefined): SlotId {
  if (decision.kind !== 'ask_slot') throw new Error('resolveRankedSlot on a non-ranking decision');
  const choice = (ranked ?? '') as SlotId;
  return decision.candidates.includes(choice) ? choice : decision.defaultSlot;
}
