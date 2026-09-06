// The Gemini text provider for the server-side clinical passes (AGENT-EXPERIENCE
// §2.6). The audio leg is a separate concern and lives in voice-token/.
//
// API surface verified 2026-09-06 against Google's own documentation, not written
// from memory (citations in supabase/README.md, "The server-side text passes"):
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   header: x-goog-api-key
//   body:   { contents[], systemInstruction{parts[]}, tools[]?,
//             generationConfig{ responseMimeType, responseSchema, temperature,
//                               maxOutputTokens, thinkingConfig? } }
//   result: { candidates[{ content.parts[{text|functionCall}], finishReason }],
//             usageMetadata{ promptTokenCount, cachedContentTokenCount,
//                            candidatesTokenCount, thoughtsTokenCount,
//                            totalTokenCount } }
// Schema `type` values are the uppercase Gemini Schema names (OBJECT/STRING/…).
//
// GEMINI_API_KEY is read here and only here for this path; it is never returned to a
// caller, never logged, and never written to Postgres.

import type {
  AiProvider,
  ComposeRequest,
  ComposeResult,
  ConcludeRequest,
  ConcludeResult,
  CoordinateRequest,
  CoordinateResult,
  Recommendation,
  Usage,
} from './ai.ts';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';

type Part = { text?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
};

export class GeminiError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(`gemini generateContent failed with ${status}`);
  }
}

const S = { type: 'STRING' } as const;
const N = { type: 'NUMBER' } as const;

const COMPOSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ack: S,
    question: S,
    ranked_slot: S,
    slots: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { slot_id: S, value: S, confidence: N, evidence_quote: S },
        required: ['slot_id', 'value', 'confidence', 'evidence_quote'],
      },
    },
    differential: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { condition: S, likelihood: N }, required: ['condition', 'likelihood'] },
    },
    red_flag_suspected: { type: 'ARRAY', items: S },
  },
  required: ['ack', 'question', 'ranked_slot', 'slots', 'differential', 'red_flag_suspected'],
};

const ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: { name: S, dosage: S, timing: S, notes: S, why: S, detail: S },
  required: ['name', 'dosage', 'timing', 'notes', 'why', 'detail'],
};

const CONCLUDE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING', enum: ['prescription', 'investigation'] },
    title: S,
    summary: S,
    items: { type: 'ARRAY', items: ITEM_SCHEMA },
    advice: S,
    urgency: { type: 'STRING', enum: ['routine', 'soon', 'urgent'] },
    note: S,
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
  },
  required: ['type', 'title', 'summary', 'items', 'advice', 'urgency', 'note', 'confidence'],
};

const COORDINATE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: S,
    citations: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { message_id: S, quote: S }, required: ['message_id', 'quote'] },
    },
    proposed_draft: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', enum: ['prescription', 'investigation'] },
        title: S, summary: S, items: { type: 'ARRAY', items: ITEM_SCHEMA }, advice: S,
        urgency: { type: 'STRING', enum: ['routine', 'soon', 'urgent'] },
      },
      required: ['type', 'title', 'summary', 'items', 'advice', 'urgency'],
    },
  },
  required: ['reply', 'citations'],
};

function priceUsd(usage: { input: number; output: number }): number {
  // No price is invented here. Absent configuration the ledger records 0 rather
  // than a number this repo has not verified.
  const inPrice = Number(Deno.env.get('AI_PRICE_INPUT_PER_MTOK') ?? 0);
  const outPrice = Number(Deno.env.get('AI_PRICE_OUTPUT_PER_MTOK') ?? 0);
  if (!inPrice && !outPrice) return 0;
  return Number(((usage.input / 1e6) * inPrice + (usage.output / 1e6) * outPrice).toFixed(6));
}

export class GeminiProvider implements AiProvider {
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? Deno.env.get('GEMINI_TEXT_MODEL') ?? DEFAULT_TEXT_MODEL;
  }

  private key(): string {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) throw new GeminiError(501, 'GEMINI_API_KEY is not set on this deployment');
    return key;
  }

  /** One JSON-schema-constrained call. Every pass in this file goes through it. */
  private async call(
    systemBlocks: string[],
    contents: { role: 'user' | 'model'; parts: Part[] }[],
    schema: Record<string, unknown>,
    temperature: number,
  ): Promise<{ json: Record<string, unknown>; usage: Usage }> {
    const started = Date.now();
    const res = await fetch(`${ENDPOINT}/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.key(), 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: systemBlocks.map((text) => ({ text })) },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) throw new GeminiError(res.status, (await res.text()).slice(0, 500));
    const body = await res.json() as GeminiResponse;

    const finish = body.candidates?.[0]?.finishReason ?? 'STOP';
    const blocked = body.promptFeedback?.blockReason;
    const meta = body.usageMetadata ?? {};
    const input = meta.promptTokenCount ?? 0;
    const output = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
    const usage: Usage = {
      inputTokens: input,
      cachedInputTokens: meta.cachedContentTokenCount ?? 0,
      outputTokens: output,
      latencyMs: Date.now() - started,
      // A safety stop is a clinical escalation, not an error (§5.6). The caller
      // checks this before it reads content.
      stopReason: blocked || finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' ? 'refusal' : 'end_turn',
      costUsd: priceUsd({ input, output }),
    };

    if (usage.stopReason === 'refusal') return { json: {}, usage };

    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Schema-constrained output that will not parse is a failed pass, not content.
      return { json: {}, usage: { ...usage, stopReason: 'unparseable' } };
    }
    return { json, usage };
  }

  async compose(input: ComposeRequest): Promise<ComposeResult> {
    const contents = [
      ...input.transcript.map((t) => ({
        role: (t.role === 'patient' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: t.text }],
      })),
      ...(input.directives.length
        ? [{ role: 'user' as const, parts: [{ text: `[operator]\n${input.directives.join('\n')}` }] }]
        : []),
      {
        role: 'user' as const,
        parts: [{
          text: [
            `[patient utterance]\n${input.patientText}`,
            '',
            '[task]',
            `Working protocol: ${input.protocolLabel}.`,
            input.forcedQuestion
              ? `The next question is fixed and will be appended verbatim by the server: "${input.forcedQuestion}". Return an empty question and only a short acknowledgement.`
              : `Choose ONE slot from this list — and only from it — by which would most change the working diagnosis: ${input.candidates.join(', ') || '(none)'}. Put it in ranked_slot and ask exactly one plain-language question for it.`,
            'Extract every fact this utterance gives you, including ones you did not ask for. Quote the patient verbatim in evidence_quote.',
            input.openRedFlags.length
              ? `If the utterance suggests any of these, list them in red_flag_suspected: ${input.openRedFlags.join(', ')}.`
              : 'Leave red_flag_suspected empty unless the utterance suggests an emergency.',
          ].join('\n'),
        }],
      },
    ];

    const { json, usage } = await this.call(input.systemBlocks, contents, COMPOSE_SCHEMA, 0.4);
    return {
      ack: String(json.ack ?? ''),
      question: input.forcedQuestion ? null : String(json.question ?? '') || null,
      rankedSlot: json.ranked_slot ? String(json.ranked_slot) : null,
      slots: Array.isArray(json.slots) ? json.slots : [],
      differential: Array.isArray(json.differential)
        ? (json.differential as { condition: string; likelihood: number }[])
        : [],
      redFlagSuspected: Array.isArray(json.red_flag_suspected) ? json.red_flag_suspected.map(String) : [],
      usage,
    };
  }

  async conclude(input: ConcludeRequest): Promise<ConcludeResult> {
    const contents = [{
      role: 'user' as const,
      parts: [{
        text: [
          '[transcript]',
          input.transcript.map((t) => `${t.role}: ${t.text}`).join('\n'),
          '',
          '[structured history]',
          input.slotSummary.map((s) => `${s.slot} = ${s.value} (${s.source}, confidence ${s.confidence})`).join('\n'),
          '',
          `[not established] ${input.unanswered.join(', ') || 'none'}`,
          `[red flags positive] ${input.redFlagPositive.join(', ') || 'none'}`,
          `[protocol] ${input.protocolLabel}`,
          '',
          'Draft the recommendation for the reviewing doctor. It is a proposal to a clinician, not an instruction to the patient. Say what is missing rather than guessing it.',
        ].join('\n'),
      }],
    }];

    const { json, usage } = await this.call(input.systemBlocks, contents, CONCLUDE_SCHEMA, 0.2);
    const recommendation: Recommendation = {
      type: json.type === 'prescription' ? 'prescription' : 'investigation',
      title: String(json.title ?? 'Clinical review'),
      summary: String(json.summary ?? ''),
      items: Array.isArray(json.items) ? (json.items as Recommendation['items']) : [],
      advice: String(json.advice ?? ''),
      urgency: (['routine', 'soon', 'urgent'].includes(String(json.urgency)) ? json.urgency : 'routine') as Recommendation['urgency'],
    };
    return {
      recommendation,
      note: String(json.note ?? ''),
      confidence: (['high', 'medium', 'low'].includes(String(json.confidence)) ? json.confidence : 'low') as 'high' | 'medium' | 'low',
      usage,
    };
  }

  async coordinate(input: CoordinateRequest): Promise<CoordinateResult> {
    const contents = [
      {
        role: 'user' as const,
        parts: [{
          text: [
            '[consult transcript — the only source for any claim about this patient]',
            input.transcript.map((m) => `(${m.id}) ${m.sender}: ${m.content}`).join('\n'),
            '',
            '[current draft]',
            input.draft ? JSON.stringify(input.draft) : 'none',
          ].join('\n'),
        }],
      },
      ...input.history.map((h) => ({
        role: (h.role === 'doctor' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: h.text }],
      })),
      {
        role: 'user' as const,
        parts: [{
          text: input.mode === 'revise'
            ? `${input.doctorText}\n\n[task] Produce the revised draft in proposed_draft. Cite the transcript message ids behind any claim about the patient.`
            : `${input.doctorText}\n\n[task] Answer the doctor. Every factual claim about the patient must carry a citation with the message id and the literal quote.`,
        }],
      },
    ];

    const { json, usage } = await this.call(input.systemBlocks, contents, COORDINATE_SCHEMA, 0.2);
    const proposed = json.proposed_draft as Recommendation | undefined;
    return {
      reply: String(json.reply ?? ''),
      citations: Array.isArray(json.citations)
        ? (json.citations as { message_id: string; quote: string }[])
        : [],
      proposedDraft: input.mode === 'revise' && proposed && Array.isArray(proposed.items) ? proposed : null,
      usage,
    };
  }
}
