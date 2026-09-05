// The model boundary. Everything the Edge Functions know about a provider is this
// interface; the only implementation checked in is deterministic and calls nothing.
//
// A real provider is selected with AI_PROVIDER=<name> and reads its key from the
// function's environment. No key is ever written to the database or to this repo.

export type Slot = {
  slot_id: string;
  status: 'unknown' | 'asked' | 'filled' | 'refused' | 'not_applicable' | 'unanswered';
  value?: string;
  confidence?: number;
  source?: 'patient' | 'record' | 'inferred';
  evidence_span?: [number, number];
};

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

export type ConsultTurnInput = {
  consultId: string;
  patientText: string;
  filledSlots: string[];
  turnIndex: number;
  allergies: { substance: string; class: string }[];
};

export type ConsultTurnOutput = {
  reply: string;
  slots: Slot[];
  /** Present only when the agent decided the consult is sufficient (§3.6). */
  draft?: { recommendation: Recommendation; note: string; confidence: 'high' | 'medium' | 'low'; unanswered: string[] };
  stopReason: 'end_turn' | 'refusal';
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number; latencyMs: number; costUsd: number };
};

export type ReviewTurnInput = {
  consultId: string;
  doctorText: string;
  mode: 'qa' | 'revise';
  transcript: { id: string; sender: string; content: string }[];
  draft?: Recommendation;
};

export type ReviewTurnOutput = {
  reply: string;
  citations: { kind: string; id: string; span: [number, number]; quote: string }[];
  proposedDraft?: Recommendation;
  stopReason: 'end_turn' | 'refusal';
  usage: ConsultTurnOutput['usage'];
};

export interface AiProvider {
  readonly model: string;
  consultTurn(input: ConsultTurnInput): Promise<ConsultTurnOutput>;
  reviewTurn(input: ReviewTurnInput): Promise<ReviewTurnOutput>;
}

/** The slot order the stub walks; the four required ones come first (§3.2). */
const SLOT_ORDER = [
  'presenting_complaint', 'duration_course', 'severity', 'red_flag_screen',
  'onset', 'character', 'associated_symptoms',
];

const QUESTION: Record<string, string> = {
  duration_course: 'How long has this been going on, and is it getting better or worse?',
  severity: 'On a scale of nought to ten, how bad is it — and is it stopping you sleeping or working?',
  red_flag_screen: 'A few things I have to check: any fever, chest pain, breathlessness, or blood?',
  onset: 'Did it come on suddenly, or build up gradually?',
  character: 'How would you describe it — sharp, dull, burning, throbbing?',
  associated_symptoms: 'Has anything else come along with it?',
};

/**
 * Deterministic stand-in. Same input, same output, no network, no key. It fills one
 * slot per turn and concludes with a draft that carries no flags of its own —
 * flags are the validator's output, and the validator lives in the database
 * (ai_submit_draft → check_drug_safety).
 */
export class StubAiProvider implements AiProvider {
  readonly model = 'stub-deterministic-1';

  async consultTurn(input: ConsultTurnInput): Promise<ConsultTurnOutput> {
    const filled = new Set(input.filledSlots);
    const next = SLOT_ORDER.find((s) => !filled.has(s));
    const usage = {
      inputTokens: 800 + input.turnIndex * 40,
      cachedInputTokens: 700,
      outputTokens: 60,
      latencyMs: 120,
      costUsd: 0.0021,
    };

    if (next && next !== 'presenting_complaint') {
      return {
        reply: QUESTION[next] ?? 'Tell me a little more about that.',
        slots: [{
          slot_id: next === 'presenting_complaint' ? 'presenting_complaint' : next,
          status: 'filled',
          value: input.patientText.slice(0, 200),
          confidence: 0.8,
          source: 'patient',
          evidence_span: [0, Math.min(input.patientText.length, 200)],
        }],
        stopReason: 'end_turn',
        usage,
      };
    }

    if (next === 'presenting_complaint') {
      return {
        reply: QUESTION.duration_course,
        slots: [{
          slot_id: 'presenting_complaint',
          status: 'filled',
          value: input.patientText.slice(0, 200),
          confidence: 0.9,
          source: 'patient',
          evidence_span: [0, Math.min(input.patientText.length, 200)],
        }],
        stopReason: 'end_turn',
        usage,
      };
    }

    // Every required slot is filled: conclude. Note the wording — this is a message
    // to the doctor that the patient overhears, never an instruction to the patient
    // (AGENT-EXPERIENCE §5.3).
    return {
      reply: 'Thank you — I have what I need. I am putting a recommendation to the doctor now.',
      slots: [],
      draft: {
        recommendation: {
          type: 'investigation',
          title: 'Review of ' + (input.patientText.slice(0, 40) || 'the reported complaint'),
          summary: 'Symptom set captured across ' + input.turnIndex + ' turns.',
          items: [{
            name: 'Clinical review',
            dosage: '',
            timing: 'At the doctor’s discretion',
            notes: 'Deterministic stub draft — no model was called.',
            why: 'The consult reached sufficiency on the required slot set.',
            detail: 'Stub draft for local development.',
          }],
          advice: 'Come back sooner if anything changes.',
          urgency: 'routine',
        },
        note: 'Stub draft — required slots complete',
        confidence: 'medium',
        unanswered: SLOT_ORDER.filter((s) => !filled.has(s)),
      },
      stopReason: 'end_turn',
      usage,
    };
  }

  async reviewTurn(input: ReviewTurnInput): Promise<ReviewTurnOutput> {
    // Every factual claim must come from the transcript, so the stub only ever
    // speaks with a quote in hand. With nothing to quote it says so.
    const source = input.transcript.find((m) => m.sender === 'patient');
    const citations = source
      ? [{ kind: 'consult_message', id: source.id, span: [0, Math.min(source.content.length, 120)] as [number, number], quote: source.content.slice(0, 120) }]
      : [];

    const reply = source
      ? 'From the transcript: “' + source.content.slice(0, 120) + '”'
      : 'There is nothing in the transcript that answers that.';

    return {
      reply,
      citations,
      proposedDraft: input.mode === 'revise' && input.draft
        ? { ...input.draft, advice: input.doctorText.slice(0, 300) }
        : undefined,
      stopReason: 'end_turn',
      usage: { inputTokens: 1200, cachedInputTokens: 1000, outputTokens: 40, latencyMs: 90, costUsd: 0.0018 },
    };
  }
}

export function getProvider(): AiProvider {
  const name = Deno.env.get('AI_PROVIDER') ?? 'stub';
  if (name === 'stub') return new StubAiProvider();
  throw new Error(
    `AI_PROVIDER='${name}' has no implementation in this repo. Implement AiProvider and read its key from the function environment.`,
  );
}
