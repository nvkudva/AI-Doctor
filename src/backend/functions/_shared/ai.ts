// The model boundary. Everything the Edge Functions know about a provider is this
// interface. No provider key is read outside a provider implementation, and no key
// is ever written to the database or to this repo.
//
// The seam is deliberately narrow and *decision-free*: a provider ranks, phrases and
// drafts. It does not decide whether a red flag is asked, whether a slot may be
// re-asked, whether the consult may conclude, or whether an item is safe. Those are
// in questionnaire.ts, slots.ts and the database.

import type { SlotId } from './protocols/index.ts';

export type RecItem = {
  name: string; dosage: string; timing: string;
  notes: string; why: string; detail: string;
};

export type Recommendation = {
  type: 'prescription' | 'investigation';
  title: string; summary: string;
  items: RecItem[]; advice: string;
  urgency: 'routine' | 'soon' | 'urgent';
};

export type Usage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** `end_turn` | `refusal` | a provider finish reason. Checked before content is read. */
  stopReason: string;
  costUsd: number;
};

export type TurnRef = { role: 'patient' | 'ai'; text: string };

export type ComposeRequest = {
  /** Cache-stable prefix, in order: persona, safety rules, record snapshot. Never
   *  contains a timestamp, a turn counter or slot JSON (§2.7). */
  systemBlocks: string[];
  transcript: TurnRef[];
  /** Operator authority channel — wrap-up, quota, mode. Goes in the message tail,
   *  never into the system prefix. */
  directives: string[];
  patientText: string;
  /** The only slots the model may choose between. */
  candidates: SlotId[];
  /** When set, the wording is fixed and the model returns only an acknowledgement. */
  forcedQuestion: string | null;
  protocolLabel: string;
  /** Red-flag codes still open, for the advisory pre-screen. */
  openRedFlags: string[];
};

export type ComposeResult = {
  ack: string;
  question: string | null;
  rankedSlot: string | null;
  slots: unknown[];
  differential: { condition: string; likelihood: number }[];
  /** Advisory only. OR-ed with the phrase matcher; never the sole gate (§3.7). */
  redFlagSuspected: string[];
  usage: Usage;
};

export type ConcludeRequest = {
  systemBlocks: string[];
  transcript: TurnRef[];
  slotSummary: { slot: string; value: string; confidence: number; source: string }[];
  protocolLabel: string;
  unanswered: string[];
  redFlagPositive: string[];
};

export type ConcludeResult = {
  recommendation: Recommendation;
  note: string;
  confidence: 'high' | 'medium' | 'low';
  usage: Usage;
};

export type Citation = { message_id: string; quote: string };

export type CoordinateRequest = {
  systemBlocks: string[];
  /** The whole coordinator conversation so far — the fix for a single-message body. */
  history: { role: 'doctor' | 'ai'; text: string }[];
  transcript: { id: string; sender: string; content: string }[];
  draft: Recommendation | null;
  doctorText: string;
  mode: 'qa' | 'revise';
};

export type CoordinateResult = {
  reply: string;
  citations: Citation[];
  proposedDraft: Recommendation | null;
  usage: Usage;
};

export interface AiProvider {
  readonly model: string;
  compose(input: ComposeRequest): Promise<ComposeResult>;
  conclude(input: ConcludeRequest): Promise<ConcludeResult>;
  coordinate(input: CoordinateRequest): Promise<CoordinateResult>;
}

const ZERO_USAGE: Usage = {
  inputTokens: 0, cachedInputTokens: 0, outputTokens: 0,
  latencyMs: 0, stopReason: 'end_turn', costUsd: 0,
};

/**
 * Deterministic stand-in: same input, same output, no network, no key. It exists so
 * the loop can be exercised without a provider — NOT as a clinical fallback. The
 * agent never falls back to it at runtime; `AI_PROVIDER` selects it deliberately,
 * and its drafts recommend clinical review rather than treatment.
 */
export class StubAiProvider implements AiProvider {
  readonly model = 'stub-deterministic-2';

  compose(input: ComposeRequest): Promise<ComposeResult> {
    const slots = input.candidates.length && input.patientText
      ? [{
        slot_id: input.candidates[0],
        value: input.patientText.slice(0, 200),
        confidence: 0.7,
        evidence_quote: input.patientText.slice(0, 60),
      }]
      : [];
    return Promise.resolve({
      ack: input.patientText ? 'Thank you for telling me that.' : '',
      question: input.forcedQuestion ? null : 'Tell me a little more about that.',
      rankedSlot: input.candidates[0] ?? null,
      slots,
      differential: [{ condition: input.protocolLabel, likelihood: 0.5 }],
      redFlagSuspected: [],
      usage: { ...ZERO_USAGE, inputTokens: 800, cachedInputTokens: 700, outputTokens: 40, latencyMs: 5 },
    });
  }

  conclude(input: ConcludeRequest): Promise<ConcludeResult> {
    return Promise.resolve({
      recommendation: {
        type: 'investigation',
        title: `Review of ${input.protocolLabel.toLowerCase()}`,
        summary: `History captured across ${input.slotSummary.length} recorded slots.`,
        items: [{
          name: 'Clinical review',
          dosage: '',
          timing: 'At the doctor’s discretion',
          notes: 'Deterministic stub draft — no model was called.',
          why: 'The consult reached sufficiency on the required slot set.',
          detail: 'Stub draft for local development.',
        }],
        advice: 'Come back sooner if anything changes, and seek urgent care if you feel much worse.',
        urgency: input.redFlagPositive.length ? 'urgent' : 'routine',
      },
      note: 'Stub draft — required slots complete',
      confidence: 'low',
      usage: { ...ZERO_USAGE, inputTokens: 1200, cachedInputTokens: 900, outputTokens: 220, latencyMs: 8 },
    });
  }

  coordinate(input: CoordinateRequest): Promise<CoordinateResult> {
    const source = input.transcript.find((m) => m.sender === 'patient');
    return Promise.resolve({
      reply: source
        ? `From the transcript: “${source.content.slice(0, 120)}”`
        : 'There is nothing in the transcript that answers that.',
      citations: source ? [{ message_id: source.id, quote: source.content.slice(0, 120) }] : [],
      proposedDraft: input.mode === 'revise' && input.draft
        ? { ...input.draft, advice: input.doctorText.slice(0, 300) }
        : null,
      usage: { ...ZERO_USAGE, inputTokens: 1200, cachedInputTokens: 1000, outputTokens: 60, latencyMs: 6 },
    });
  }
}

export function getProvider(modelOverride?: string | null): AiProvider {
  const name = Deno.env.get('AI_PROVIDER') ?? 'stub';
  if (name === 'stub') return new StubAiProvider();
  if (name === 'gemini') return makeGeminiProvider(modelOverride ?? undefined);
  throw new Error(
    `AI_PROVIDER='${name}' has no implementation in this repo. Implement AiProvider and read its key from the function environment.`,
  );
}

// Imported lazily-by-reference so the stub path never touches provider code.
import { GeminiProvider } from './gemini.ts';
function makeGeminiProvider(model?: string): AiProvider {
  return new GeminiProvider(model);
}
