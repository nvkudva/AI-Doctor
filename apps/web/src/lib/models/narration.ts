// Narration: the clinical script Mira follows, per symptom.
//
// This file is the managed source of questions. The brain (SmolLM2 local or
// a frontier API) is told the script + what is already known and asks the
// next scripted question in its own words. The same slots fill up
// regardless of which brain is switched on.
//
// Storage: ConsultSlots rides inside the existing draft consult
// (persistLocal({ draftConsult: { messages, at, slots } })), so a reload
// mid-visit keeps what was asked and answered. On completion the answers
// travel with the consult's user turns into the doctor's review.

export type SlotName = 'symptom' | 'duration' | 'severity' | 'associated' | 'medicines';

export interface ScriptQuestion {
  slot: Exclude<SlotName, 'symptom'>;
  ask: string;
}

export interface SymptomScript {
  id: string;
  label: string;
  match: RegExp;
  empathy: string;
  questions: ScriptQuestion[];
  /** Heard in any patient turn, these end the script: emergency path. */
  redFlags: RegExp;
  redFlagLabel: string;
}

export interface ConsultSlots {
  scriptId: string | null;
  /** slot -> patient's own words. */
  answers: Partial<Record<SlotName, string>>;
  /** The slot Mira's last question was about; the next reply fills it. */
  pendingSlot: SlotName | null;
}

export function freshSlots(): ConsultSlots {
  return { scriptId: null, answers: {}, pendingSlot: 'symptom' };
}

const STANDARD_TAIL: ScriptQuestion[] = [
  { slot: 'duration', ask: 'How long has this been going on?' },
  { slot: 'severity', ask: 'On a scale from mild to severe, how bad does it feel right now?' },
];

const MEDICINES: ScriptQuestion = {
  slot: 'medicines',
  ask: 'Are you taking any medicines at the moment, other than what we have on file?',
};

export const SYMPTOM_SCRIPTS: SymptomScript[] = [
  {
    id: 'fever', label: 'Fever', match: /fever|temperature|hot|chills/i,
    empathy: "I'm sorry you're running a fever — that can really wear you down.",
    questions: [...STANDARD_TAIL,
      { slot: 'associated', ask: 'Any cough, sore throat, or body aches along with it?' }, MEDICINES],
    redFlags: /can'?t breathe|difficulty breathing|breathless|confused|seizure|stiff neck/i,
    redFlagLabel: 'Fever with breathing difficulty, confusion, seizure or stiff neck',
  },
  {
    id: 'headache', label: 'Headache', match: /headache|migraine|head hurts|head pain/i,
    empathy: 'That sounds really uncomfortable — headaches can make everything harder.',
    questions: [...STANDARD_TAIL,
      { slot: 'associated', ask: 'Do you also have nausea, light sensitivity, or any vision changes?' }, MEDICINES],
    redFlags: /sudden|worst ever|weakness|slurred|vision loss|face droop|faint/i,
    redFlagLabel: 'Sudden severe headache or neurological signs',
  },
  {
    id: 'stomach', label: 'Stomach pain', match: /stomach|belly|abdom|nausea|vomit|indigestion|acid/i,
    empathy: "I'm sorry — stomach trouble is miserable to deal with.",
    questions: [...STANDARD_TAIL,
      { slot: 'associated', ask: 'Any vomiting, diarrhoea, or blood in your stool?' }, MEDICINES],
    redFlags: /blood|black stool|severe|can'?t keep|dehydrat/i,
    redFlagLabel: 'GI bleeding signs or severe abdominal pain',
  },
  {
    id: 'cough', label: 'Cough / cold', match: /cough|throat|cold|congest|phlegm/i,
    empathy: 'That lingering cough sounds exhausting — I\'m glad you brought it up.',
    questions: [...STANDARD_TAIL,
      { slot: 'associated', ask: 'Is the cough dry or bringing anything up, and is it worse at night?' }, MEDICINES],
    redFlags: /breathless|can'?t breathe|coughing blood|chest pain/i,
    redFlagLabel: 'Breathlessness, chest pain or coughing blood',
  },
  {
    id: 'rash', label: 'Rash / skin', match: /rash|itch|skin|hives|eczema/i,
    empathy: 'Itchy skin is so frustrating — thank you for telling me about it.',
    questions: [...STANDARD_TAIL,
      { slot: 'associated', ask: 'Is the rash spreading, and did anything new touch your skin recently — soap, detergent, plants?' }, MEDICINES],
    redFlags: /blister|swelling|lip|tongue|fever|spreading quickly/i,
    redFlagLabel: 'Blistering, swelling or rapidly spreading rash',
  },
];

export const GENERAL_SCRIPT: SymptomScript = {
  id: 'general', label: 'General',
  match: /./,
  empathy: "Thank you for telling me — I'm here to help you figure this out.",
  questions: [...STANDARD_TAIL,
    { slot: 'associated', ask: 'Have you noticed anything else along with it — fever, tiredness, changes in appetite or sleep?' }, MEDICINES],
  redFlags: /chest pain|can'?t breathe|stroke|face droop|slurred|bleeding heavily|suicid/i,
  redFlagLabel: 'Possible emergency — advised in-person care',
};

export function matchScript(text: string): SymptomScript {
  return SYMPTOM_SCRIPTS.find(s => s.match.test(text)) || GENERAL_SCRIPT;
}

export function scriptById(id: string | null): SymptomScript {
  return SYMPTOM_SCRIPTS.find(s => s.id === id) || GENERAL_SCRIPT;
}

/** Records a patient turn: first turn names the symptom, later turns fill
 *  whichever slot Mira's last question was about. Returns the same object. */
export function recordAnswer(slots: ConsultSlots, text: string): ConsultSlots {
  const clean = text.trim();
  if (!clean) return slots;
  if (!slots.scriptId) {
    slots.scriptId = matchScript(clean).id;
    slots.answers.symptom = clean;
  } else if (slots.pendingSlot && !slots.answers[slots.pendingSlot]) {
    slots.answers[slots.pendingSlot] = clean;
  }
  return slots;
}

/** The next question the script still needs, or null when it is complete. */
export function nextQuestion(slots: ConsultSlots): ScriptQuestion | null {
  const script = scriptById(slots.scriptId);
  return script.questions.find(q => !slots.answers[q.slot]) || null;
}

export function checkRedFlag(slots: ConsultSlots, text: string): string | null {
  const script = scriptById(slots.scriptId);
  return script.redFlags.test(text) || GENERAL_SCRIPT.redFlags.test(text) ? script.redFlagLabel : null;
}

/** Prompt block for whichever brain is on: script state, in plain words. */
export function narrationGuidance(slots: ConsultSlots): string {
  const script = scriptById(slots.scriptId);
  const known = Object.entries(slots.answers)
    .map(([slot, answer]) => `${slot}: ${answer}`)
    .join('; ') || 'nothing yet';
  const next = nextQuestion(slots);
  return [
    `NARRATION SCRIPT (${script.label}): empathy first — "${script.empathy}"`,
    `Already gathered: ${known}.`,
    next
      ? `Ask next, in your own warm words, only this: ${next.slot} — "${next.ask}" Set pendingSlot by asking it.`
      : 'Script complete: you may conclude with a recommendation.',
    `Red flags for this script: ${script.redFlagLabel}. If the patient mentions one, set urgency "urgent" and tell them to seek in-person emergency care now.`,
  ].join('\n');
}
