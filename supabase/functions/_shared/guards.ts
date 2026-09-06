// Post-generation checks on patient-facing text (AGENT-EXPERIENCE §5.3, §3.5).
//
// Every rule here runs on text the model has already produced. None of them is a
// prompt instruction: the caller regenerates once on a violation and, failing that,
// replaces the text with fixed wording — so violating text is never what reaches a
// patient, whatever the model wrote.

export type Violation = { rule: string; detail: string };

const DOSE = /\b\d+(\.\d+)?\s?(mg|mcg|µg|g|ml|iu|units?)\b/i;
const FREQUENCY = /\b(twice|three times|four times|once)\s+(a|per)\s+day\b|\b(bd|tds|qds|od|prn)\b|\bevery\s+\d+\s+hours?\b/i;
const APPROVAL_PROMISE = /\b(the )?doctor will (approve|sign|okay|ok this)|will be approved|once (it'?s|it is) approved\b/i;
const DEFINITIVE_DX = /\b(you (definitely )?have|this is (definitely|certainly)|you'?ve got|it'?s definitely|i can confirm|the diagnosis is)\b/i;
const PROGNOSIS = /\b(you'?ll be (fine|better)|this will (clear|settle|resolve) (in|within)|nothing to worry about|it'?s nothing serious|you'?ll recover in)\b/i;
const REASSURANCE = /\b(nothing to worry about|it'?s not serious|that'?s (perfectly )?normal|no need to worry|i'?m not worried)\b/i;

export type GuardContext = {
  /** True while any red flag is positive: reassurance is blocked outright. */
  redFlagActive: boolean;
  /** First three tokens of each of the previous two agent turns (§3.5). */
  recentOpeners: string[];
};

/**
 * Returns every violation in `text`. An empty array is the only thing that may be
 * spoken as written.
 */
export function checkPatientText(text: string, ctx: GuardContext): Violation[] {
  const found: Violation[] = [];
  const questions = (text.match(/\?/g) ?? []).length;
  if (questions > 1) found.push({ rule: 'one_question_per_turn', detail: `${questions} questions in one turn` });

  if (DOSE.test(text) && FREQUENCY.test(text)) {
    found.push({ rule: 'medication_instruction', detail: 'a drug dose with a frequency is a prescription' });
  } else if (DOSE.test(text)) {
    found.push({ rule: 'medication_dose', detail: 'a dose may not be spoken to a patient before review' });
  }
  if (APPROVAL_PROMISE.test(text)) found.push({ rule: 'pre_empts_the_gate', detail: 'promises the doctor\'s decision' });
  if (DEFINITIVE_DX.test(text)) found.push({ rule: 'definitive_diagnosis', detail: 'asserts a diagnosis as fact' });
  if (PROGNOSIS.test(text)) found.push({ rule: 'prognosis', detail: 'states an unreviewed timeline or outcome' });
  if (ctx.redFlagActive && REASSURANCE.test(text)) {
    found.push({ rule: 'reassurance_over_red_flag', detail: 'reassures while a red flag is positive' });
  }

  const opener = openerOf(text);
  if (opener && ctx.recentOpeners.includes(opener)) {
    found.push({ rule: 'repeated_opener', detail: `two turns opened with "${opener}"` });
  }
  return found;
}

export function openerOf(text: string): string {
  return text.trim().toLowerCase().split(/\s+/).slice(0, 3).join(' ');
}

/** Violations that mean the turn must not be spoken at all, even rewritten. */
const HARD_RULES = ['medication_instruction', 'medication_dose', 'definitive_diagnosis', 'reassurance_over_red_flag'];

export function isHard(violations: Violation[]): boolean {
  return violations.some((v) => HARD_RULES.includes(v.rule));
}

/**
 * Fixed wording, used when a regenerated turn still violates. It says nothing
 * clinical, which is the point: the fallback for "the model said something unsafe"
 * cannot itself be generated.
 */
export const SAFE_FALLBACK = 'I want to get this right, so I am going to leave that for the doctor to go through with you. ';

/** The acknowledgement is bounded here rather than trusted to the prompt. */
export function sanitizeAck(ack: string | null | undefined): string {
  const text = (ack ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const words = text.split(' ');
  const clipped = words.slice(0, 14).join(' ');
  if (/\?/.test(clipped)) return '';
  if (DOSE.test(clipped) || DEFINITIVE_DX.test(clipped)) return '';
  return clipped.endsWith('.') || clipped.endsWith('!') ? clipped : clipped + '.';
}

/** One question, one turn: the composed reply is ack + exactly one question. */
export function compose(ack: string, question: string): string {
  const cleanAck = sanitizeAck(ack);
  const q = question.trim();
  return cleanAck ? `${cleanAck} ${q}` : q;
}
