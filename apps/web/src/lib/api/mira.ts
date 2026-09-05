// Dr. Mira consult brain on Gemini: history-taking loop + conclusion pass.
// Key: localStorage vd_gemini_key (runtime) or VITE_GEMINI_API_KEY (build).
// Without a key the caller falls back to the demo/anthropic aiComplete path.

const MODEL = 'gemini-2.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface SymptomSlots {
  chiefComplaint?: string;
  onset?: string;
  duration?: string;
  severity?: string;
  associated?: string;
  medications?: string;
  allergies?: string;
  redFlags?: string[];
}

export interface TurnMsg {
  role: 'user' | 'assistant';
  content: string;
}

export function geminiKey(): string {
  try {
    const ls = localStorage.getItem('vd_gemini_key');
    if (ls) return ls;
  } catch { /* storage unavailable */ }
  try {
    return (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
}

export function hasGemini(): boolean {
  return !!geminiKey();
}

async function geminiJson(args: { system: string; messages: TurnMsg[]; schema: object; temperature?: number; maxTokens?: number }): Promise<any> {
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey())}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: args.system }] },
      contents: args.messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: args.schema,
        temperature: args.temperature ?? 0.7,
        maxOutputTokens: args.maxTokens || 800,
      },
    }),
  });
  if (!res.ok) throw new Error('Gemini error ' + res.status);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}';
  return JSON.parse(text);
}

const SLOT_SCHEMA = {
  type: 'object',
  properties: {
    chiefComplaint: { type: 'string' },
    onset: { type: 'string' },
    duration: { type: 'string' },
    severity: { type: 'string' },
    associated: { type: 'string' },
    medications: { type: 'string' },
    allergies: { type: 'string' },
    redFlags: { type: 'array', items: { type: 'string' } },
  },
};

const TURN_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    slots: SLOT_SCHEMA,
    done: { type: 'boolean' },
    redFlag: { type: 'boolean' },
  },
  required: ['reply', 'slots', 'done', 'redFlag'],
};

// The patient's record is supplied by the caller; nothing about a patient may
// be hardcoded here (TODO P1).
const ON_FILE_UNKNOWN =
  'Nothing is on file about this patient — no demographics, allergies or history. Do not assume any; ask before recommending anything allergy-sensitive.';

const MIRA_SYS = `You are Dr. Mira, a warm, emotionally intelligent virtual general physician. Your words are heard aloud — sound like a caring human clinician, never like a form.
{{ON_FILE}}
STYLE: empathy first, then ONE clinical question per turn. 1-2 short spoken-sounding sentences. No lists, no jargon. Vary wording; never sound scripted.
HISTORY TO FILL (slots): chiefComplaint, onset, duration, severity, associated symptoms, current medications, allergies. Ask for whatever is missing, one slot per turn.
DONE: set done=true once chiefComplaint + duration + severity are known and you have asked at least 3 questions. Do not drag past 6 questions.
RED FLAGS (chest pain, breathing difficulty, stroke signs, severe bleeding, suicidal thoughts): set redFlag=true immediately and make reply a clear instruction to seek in-person emergency care now.
Return ONLY the JSON object. Carry forward all previously filled slots unchanged.`;

export async function consultTurn(args: { messages: TurnMsg[]; slots: SymptomSlots; rush: boolean; onFile?: string }): Promise<{ reply: string; slots: SymptomSlots; done: boolean; redFlag: boolean }> {
  const system = MIRA_SYS.replace('{{ON_FILE}}', args.onFile || ON_FILE_UNKNOWN) +
    `\nSlots filled so far: ${JSON.stringify(args.slots)}.` +
    (args.rush ? ' Wrap up NOW: set done=true with your best reply.' : '');
  const data = await geminiJson({ system, messages: args.messages, schema: TURN_SCHEMA });
  return {
    reply: String(data.reply || ''),
    slots: { ...args.slots, ...(data.slots || {}) },
    done: !!data.done,
    redFlag: !!data.redFlag,
  };
}

const REC_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['prescription', 'investigation'] },
    title: { type: 'string' },
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          timing: { type: 'string' },
          notes: { type: 'string' },
          why: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
    advice: { type: 'string' },
    urgency: { type: 'string', enum: ['routine', 'soon', 'urgent'] },
  },
  required: ['type', 'title', 'summary', 'items', 'advice', 'urgency'],
};

const CONCLUDE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    note: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    flags: { type: 'array', items: { type: 'string' } },
    recommendation: REC_SCHEMA,
  },
  required: ['reply', 'note', 'confidence', 'flags', 'recommendation'],
};

const CONCLUDE_SYS = `You are Dr. Mira closing a consultation. Given the extracted symptom slots and full transcript, write the case conclusion for a licensed doctor to review.
{{ON_FILE}}
HARD SAFETY RULES: never recommend a drug in a class the patient's record says they are allergic to, and never assume an allergy that is not on file. Any red flag forces urgency "urgent" and reply must tell the patient to seek in-person emergency care now.
reply: 1-2 warm spoken sentences closing the consult (patient hears this). note: <=7 words on the chief complaint. flags: only safety concerns you actually identified from this conversation and the patient's stated history — never a routine attestation, and never a check you did not perform. Use [] when there is nothing to flag.
recommendation: type prescription (medicines + self-care) or investigation (tests first). Each item needs plain-language why. advice: when to seek further care.`;

export async function concludeConsult(args: { slots: SymptomSlots; messages: TurnMsg[]; redFlag: boolean; onFile?: string }): Promise<{ reply: string; note: string; confidence: string; flags: string[]; recommendation: any }> {
  const system = CONCLUDE_SYS.replace('{{ON_FILE}}', args.onFile || ON_FILE_UNKNOWN) +
    `\nSymptom slots: ${JSON.stringify(args.slots)}.` +
    (args.redFlag ? ' RED FLAG PRESENT: urgency must be "urgent".' : '');
  const data = await geminiJson({ system, messages: args.messages, schema: CONCLUDE_SCHEMA, temperature: 0.3, maxTokens: 1200 });
  return {
    reply: String(data.reply || ''),
    note: String(data.note || ''),
    confidence: data.confidence || 'medium',
    flags: Array.isArray(data.flags) ? data.flags : [],
    recommendation: data.recommendation || null,
  };
}
