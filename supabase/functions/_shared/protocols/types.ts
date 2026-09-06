// The shape of a complaint protocol (AGENT-EXPERIENCE §3.3).
//
// A protocol is DATA. It is diffed in git, hashed, and registered in
// `protocol_versions` before the consult it governs may conclude, so the draft a
// doctor signs names the exact clinical policy that produced it. Nothing in this
// folder is a prompt: the engine in ../questionnaire.ts reads these structures and
// decides; the model only ranks and phrases.
//
// NOT CLINICALLY SIGNED OFF. Every protocol here carries `clinicianOwner: null`.
// `register_protocol_version` records that as `approved_at IS NULL`, the validator
// turns it into a draft flag, and AGENT-EXPERIENCE §7.2 is the open question.

/** Mirror of the `public.slot_id` enum (migration 0001). */
export type SlotId =
  | 'presenting_complaint' | 'onset' | 'duration_course' | 'severity' | 'character'
  | 'location_radiation' | 'aggravating_relieving' | 'associated_symptoms' | 'red_flag_screen'
  | 'relevant_history' | 'current_medications' | 'allergies'
  | 'pregnancy_status' | 'travel' | 'occupational_exposure' | 'sick_contacts'
  | 'recent_procedures' | 'smoking_alcohol';

export const SLOT_IDS: readonly SlotId[] = [
  'presenting_complaint', 'onset', 'duration_course', 'severity', 'character',
  'location_radiation', 'aggravating_relieving', 'associated_symptoms', 'red_flag_screen',
  'relevant_history', 'current_medications', 'allergies',
  'pregnancy_status', 'travel', 'occupational_exposure', 'sick_contacts',
  'recent_procedures', 'smoking_alcohol',
];

export function isSlotId(v: unknown): v is SlotId {
  return typeof v === 'string' && (SLOT_IDS as readonly string[]).includes(v);
}

/** A slot that is only opened when the record says it applies (§3.5 "skip the obvious"). */
export interface ConditionalSlot {
  slot: SlotId;
  sex?: ('male' | 'female' | 'other' | 'undisclosed')[];
  minAge?: number;
  maxAge?: number;
}

/** What a positive answer costs. `emergency` stops the consult; both raise urgency. */
export type RedFlagAction = 'emergency' | 'urgent_same_day';

export interface RedFlag {
  /** Stable key; must have a row in `red_flag_scripts` (migration 0011). */
  code: string;
  /** The exact discriminating question. Paraphrase loses the discrimination, so the
   *  engine sends this verbatim and the model may not rewrite it. */
  ask: string;
  /** Lower-cased fragments that make the answer positive. */
  positiveIf: string[];
  /** Fragments that make it explicitly negative; checked before `positiveIf`. */
  negativeIf?: string[];
  action: RedFlagAction;
  /** Demographic gate. An inapplicable red flag is never asked and never blocks
   *  sufficiency — §3.5 "skip the obvious". */
  only?: Omit<ConditionalSlot, 'slot'>;
}

export interface Protocol {
  /** `complaint_key` in `protocol_versions`. */
  id: string;
  /** Bump on ANY content change — `register_protocol_version` refuses a changed
   *  body under an unchanged version, so drift cannot go unnoticed. */
  version: string;
  label: string;
  /** Lower-cased keywords that bind this protocol to a presenting complaint. */
  match: string[];
  /** Associated symptoms worth asking about for this complaint. */
  associated: string[];
  redFlags: RedFlag[];
  conditional: ConditionalSlot[];
  /** Priority order among unfilled slots. A TIEBREAK for the ranker, not a script. */
  slotOrder: SlotId[];
  /** Two phrasings per slot: attempt 1 open, attempt 2 at a lower cognitive load
   *  (§1.6 "never re-ask with the same words"). */
  ask: Partial<Record<SlotId, [string, string]>>;
  /** Record-first confirmation (§3.4 rule 2). `{value}` is the recorded value. */
  confirm: Partial<Record<SlotId, string>>;
  sufficientWhen: { required: SlotId[]; minPatientTurns: number };
  /** The best confidence a draft from this protocol may claim. */
  confidenceCeiling: 'high' | 'medium' | 'low';
  /** null until a named clinician signs the content off. */
  clinicianOwner: string | null;
}

/** Core wording shared by every protocol; a protocol overrides what it needs. */
export const CORE_ASK: Partial<Record<SlotId, [string, string]>> = {
  presenting_complaint: ['So — what has been going on?', 'Tell me in your own words what brought you here today.'],
  onset: ['Did it come on all at once, or build up over time?', 'Was there a moment you could point to when it started?'],
  duration_course: [
    'How long has this been going on, and has it been there constantly or does it come and go?',
    'Is it days or weeks — and is it settling, staying the same, or getting worse?',
  ],
  severity: [
    'How bad is it at its worst — and is it stopping you sleeping or getting on with your day?',
    'If nought were nothing at all and ten the worst you can imagine, roughly where does it sit?',
  ],
  character: ['How would you describe it?', 'Is it more sharp, or more of a dull ache?'],
  location_radiation: ['Where do you feel it — and does it move anywhere?', 'Can you point to one spot, or is it spread out?'],
  aggravating_relieving: [
    'Is there anything that makes it better or worse — and have you tried anything for it?',
    'Does anything you do change it at all?',
  ],
  associated_symptoms: ['Has anything else come along with it?', 'Anything else you have noticed since it started, even if it seems unrelated?'],
  relevant_history: ['Has anything like this happened before?', 'Have you ever been seen about this before?'],
  current_medications: ['Are you taking anything at the moment?', 'Any tablets, inhalers or drops — even ones you buy yourself?'],
  allergies: ['Do you have any allergies to medicines?', 'Has a medicine ever given you a rash or made you unwell?'],
  pregnancy_status: ['Is there any chance you could be pregnant?', 'Just to be safe — could you be pregnant at the moment?'],
  travel: ['Have you been away anywhere recently?', 'Any travel in the last month or so?'],
  sick_contacts: ['Is anyone around you unwell with the same thing?', 'Anyone at home or at work with something similar?'],
  occupational_exposure: ['Is there anything at work you are around a lot?', 'Does your work bring you near dust, fumes or chemicals?'],
  recent_procedures: ['Have you had any procedures or operations recently?', 'Anything done in hospital in the last few months?'],
  smoking_alcohol: ['Do you smoke, or drink much?', 'Roughly how much do you smoke or drink in a week?'],
};

/** Record-first confirmations. Never ask a patient to re-state what we already hold. */
export const CORE_CONFIRM: Partial<Record<SlotId, string>> = {
  allergies: 'I have {value} down as an allergy for you — still right?',
  current_medications: 'It says here you are taking {value} — is that still the case?',
  relevant_history: 'Your record mentions {value} — is that still going on?',
};
