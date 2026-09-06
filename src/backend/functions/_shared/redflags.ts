// The always-on red-flag layer (AGENT-EXPERIENCE §3.7).
//
// Three detectors are OR-ed in the design; this file is the one that cannot fail —
// it is a regex sweep that runs on every patient utterance, server-side, BEFORE any
// model is called and regardless of whether a model is reachable. The protocol's own
// discriminating questions are the second detector, evaluated here too. A model
// pre-screen is advisory and is OR-ed in by the caller; it is never the sole gate.
//
// NOT CLINICALLY SIGNED OFF. The phrase list below is a seed drawn from the
// complaint protocols; it needs a named clinician owner before real use.

import type { RedFlag } from './protocols/index.ts';

export type Detector = 'phrase_match' | 'protocol_question' | 'model_prescreen';

export type RedFlagHit = {
  code: string;
  action: 'emergency' | 'urgent_same_day';
  detector: Detector;
  /** The literal span of the patient's own words that fired it. */
  evidence: string;
  span: [number, number];
};

type Pattern = { code: string; action: 'emergency' | 'urgent_same_day'; re: RegExp };

/** Tuned for recall: a false positive costs one referral, the inverse costs a life. */
const PATTERNS: Pattern[] = [
  { code: 'acs_chest_pain', action: 'emergency', re: /\b(crushing|pressure|tight(ness)?|heavy|elephant)\b[^.?!]{0,40}\bchest\b|\bchest\b[^.?!]{0,40}\b(crushing|pressure|tight(ness)?|heaviness|radiat\w+)\b/i },
  { code: 'acs_radiation', action: 'emergency', re: /\bpain\b[^.?!]{0,40}\b(into|down|to)\b[^.?!]{0,20}\b(left arm|jaw|shoulder blade)\b/i },
  { code: 'airway_breathing', action: 'emergency', re: /\b(can(no|')?t breathe|cannot breathe|struggling to breathe|gasping for (air|breath)|fighting for breath|choking)\b/i },
  { code: 'anaphylaxis', action: 'emergency', re: /\b(throat (is )?(closing|swelling)|tongue (is )?swollen|lips? (are )?swelling|anaphylaxis)\b/i },
  { code: 'stroke_focal', action: 'emergency', re: /\b(face (has )?dropp?ed|face is drooping|slurr(ed|ing) (my )?(speech|words)|can(no|')?t (speak|talk|move) (properly|my)|weak(ness)? (down|on) one side|numb (down|on) one side|arm went (dead|limp))\b/i },
  { code: 'headache_thunderclap', action: 'emergency', re: /\b(worst headache (of my life|ever)|thunderclap|like (a|being) (hit|struck)[^.?!]{0,20}head|head (just )?exploded)\b/i },
  { code: 'meningism', action: 'emergency', re: /\bneck (is |feels )?(stiff|rigid)\b|\brash (that )?(doesn'?t|does not|won'?t) fade\b|\bnon.?blanching\b/i },
  { code: 'haemoptysis', action: 'urgent_same_day', re: /\bcough(ing|ed)? up\b[^.?!]{0,20}\bblood\b/i },
  { code: 'haematemesis', action: 'emergency', re: /\b(vomit(ing|ed)?|throw(ing|n)? up|sick)\b[^.?!]{0,20}\bblood\b|\bcoffee ground\b/i },
  { code: 'melaena', action: 'emergency', re: /\b(black|tarry)\b[^.?!]{0,20}\b(stool|poo|motion)s?\b/i },
  { code: 'abdo_sudden_severe', action: 'emergency', re: /\b(sudden|all at once|out of nowhere)\b[^.?!]{0,30}\b(severe|agonis\w+|excruciating|worst)\b|\bdoubled over\b/i },
  { code: 'sepsis', action: 'emergency', re: /\b(shaking uncontrollably|shivering uncontrollably|rigors?)\b|\b(confused|not making sense|drowsy|can(no|')?t (stay|keep) awake)\b[^.?!]{0,30}\bfever\b|\bfever\b[^.?!]{0,30}\b(confus\w+|drowsy)\b/i },
  { code: 'unresponsive', action: 'emergency', re: /\b(passed out|blacked out|fainted|unconscious|unresponsive|had a (fit|seizure)|convuls\w+)\b/i },
  { code: 'cyanosis', action: 'emergency', re: /\b(lips? (are |went |turning )?blue|going blue|grey and clammy)\b/i },
  { code: 'self_harm', action: 'emergency', re: /\b(kill myself|end my life|take my own life|suicidal|don'?t want to (be here|live)|overdose[d]?)\b/i },
  { code: 'obstetric_bleed', action: 'emergency', re: /\b(pregnan\w+)\b[^.?!]{0,40}\b(bleed\w+|blood)\b|\b(bleed\w+)\b[^.?!]{0,40}\bpregnan\w+/i },
  { code: 'testicular_torsion', action: 'emergency', re: /\b(sudden|severe)\b[^.?!]{0,30}\b(testic\w+|scrot\w+|groin)\b[^.?!]{0,20}\bpain\b/i },
  { code: 'cauda_equina', action: 'emergency', re: /\b(numb\w*)\b[^.?!]{0,30}\b(saddle|between my legs|inner thigh)\b|\b(can(no|')?t (pee|pass urine|control my bladder|control my bowels))\b/i },
];

/**
 * The instant layer. Runs in ~1 ms on every utterance and on interim transcripts.
 * Negation is deliberately NOT filtered here: "I have no crushing chest pain" firing
 * a false positive costs a doctor thirty seconds, and the protocol question that
 * follows resolves it.
 */
export function scanText(text: string): RedFlagHit[] {
  const hits: RedFlagHit[] = [];
  const seen = new Set<string>();
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(text);
    if (!match || seen.has(pattern.code)) continue;
    seen.add(pattern.code);
    hits.push({
      code: pattern.code,
      action: pattern.action,
      detector: 'phrase_match',
      evidence: match[0].slice(0, 240),
      span: [match.index, match.index + match[0].length],
    });
  }
  return hits;
}

export type AnswerVerdict = 'positive' | 'negative' | 'unclear';

const BARE_NEGATIVE = /^\s*(no|nope|none|not really|nothing|neither|no it'?s not|not at all)\b[^a-z]*$/i;
const BARE_POSITIVE = /^\s*(yes|yeah|yep|it is|i (do|have|am))\b[^a-z]*$/i;

/**
 * Evaluates a patient's answer to a protocol red-flag question. Explicit negatives
 * are checked first so "no fever, neck is fine" does not fire on "fever".
 * `unclear` is never treated as negative: the screen stays open.
 */
export function evaluateAnswer(flag: RedFlag, answer: string): AnswerVerdict {
  const text = (answer ?? '').toLowerCase();
  if (!text.trim()) return 'unclear';
  if (BARE_NEGATIVE.test(text)) return 'negative';
  for (const phrase of flag.negativeIf ?? []) {
    if (text.includes(phrase.toLowerCase())) return 'negative';
  }
  for (const phrase of flag.positiveIf) {
    const at = text.indexOf(phrase.toLowerCase());
    if (at < 0) continue;
    // "no chest pain" / "never had blood" — a negation immediately before the phrase.
    const before = text.slice(Math.max(0, at - 14), at);
    if (/\b(no|not|never|without|denies)\s*$/.test(before)) continue;
    return 'positive';
  }
  if (BARE_POSITIVE.test(text)) return 'positive';
  return 'unclear';
}

export function hitFromProtocolAnswer(flag: RedFlag, answer: string, offset = 0): RedFlagHit {
  return {
    code: flag.code,
    action: flag.action,
    detector: 'protocol_question',
    evidence: answer.slice(0, 240),
    span: [offset, offset + Math.min(answer.length, 240)],
  };
}
