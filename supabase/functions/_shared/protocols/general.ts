// The conservative fallback (AGENT-EXPERIENCE §3.3): broader red-flag screen, lower
// sufficiency threshold, and a draft that may never claim better than `low`
// confidence. Any complaint that does not bind a specific protocol lands here.
//
// NOT CLINICALLY SIGNED OFF (see ./types.ts).

import { CORE_ASK, CORE_CONFIRM, type Protocol } from './types.ts';

export const general: Protocol = {
  id: 'general',
  version: '2026.09.06-1',
  label: 'Undifferentiated complaint',
  match: [],
  associated: ['fever', 'breathlessness', 'chest pain', 'vomiting', 'rash', 'confusion', 'weight loss'],
  redFlags: [
    {
      code: 'general_chest_pain',
      ask: 'Have you had any chest pain, or any pressure or tightness across your chest?',
      positiveIf: ['chest pain', 'chest tight', 'pressure in my chest', 'crushing', 'heavy chest'],
      negativeIf: ['no chest pain', 'nothing in my chest', 'chest is fine'],
      action: 'emergency',
    },
    {
      code: 'general_breathing',
      ask: 'Are you having any trouble breathing, or feeling short of breath at rest?',
      positiveIf: ['can\'t breathe', 'cannot breathe', 'struggling to breathe', 'short of breath', 'gasping'],
      negativeIf: ['breathing is fine', 'no trouble breathing', 'no shortness'],
      action: 'emergency',
    },
    {
      code: 'general_neuro',
      ask: 'Any weakness or numbness down one side, or trouble with your speech or vision?',
      positiveIf: ['weakness', 'numb', 'slurred', 'can\'t speak', 'face droop', 'vision gone', 'double vision'],
      negativeIf: ['no weakness', 'speech is fine', 'vision is fine'],
      action: 'emergency',
    },
    {
      code: 'general_bleeding',
      ask: 'Have you seen any blood — coughing it up, being sick with it, or in your stool or urine?',
      positiveIf: ['blood', 'bleeding', 'coughing up blood', 'black stool', 'vomiting blood'],
      negativeIf: ['no blood', 'no bleeding'],
      action: 'urgent_same_day',
    },
    {
      code: 'general_systemic',
      ask: 'Have you had a fever, or lost weight without meaning to?',
      positiveIf: ['fever', 'temperature', 'shivering', 'lost weight', 'losing weight'],
      negativeIf: ['no fever', 'no temperature', 'weight is stable'],
      action: 'urgent_same_day',
    },
  ],
  conditional: [
    { slot: 'pregnancy_status', sex: ['female'], minAge: 12, maxAge: 55 },
    { slot: 'travel' },
  ],
  slotOrder: [
    'presenting_complaint', 'duration_course', 'severity', 'red_flag_screen',
    'onset', 'location_radiation', 'character', 'associated_symptoms',
    'aggravating_relieving', 'relevant_history', 'current_medications', 'allergies',
  ],
  ask: { ...CORE_ASK },
  confirm: { ...CORE_CONFIRM },
  sufficientWhen: {
    required: ['presenting_complaint', 'duration_course', 'severity', 'red_flag_screen'],
    minPatientTurns: 4,
  },
  confidenceCeiling: 'low',
  clinicianOwner: null,
};
