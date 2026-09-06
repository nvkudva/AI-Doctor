// NOT CLINICALLY SIGNED OFF (see ./types.ts).
import { CORE_ASK, CORE_CONFIRM, type Protocol } from './types.ts';

export const abdominalPain: Protocol = {
  id: 'abdominal_pain',
  version: '2026.09.06-1',
  label: 'Abdominal pain',
  match: ['stomach', 'tummy', 'belly', 'abdominal', 'abdomen', 'gut', 'stomach ache', 'stomach pain', 'cramps'],
  associated: ['vomiting', 'diarrhoea', 'constipation', 'fever', 'urinary_symptoms', 'appetite_loss'],
  redFlags: [
    {
      code: 'abdo_peritonism',
      ask: 'Is your tummy tender to touch, or does it hurt more when you move or cough?',
      positiveIf: ['tender', 'hurts to touch', 'can\'t touch it', 'worse when i move', 'worse when i cough', 'rigid', 'hard'],
      negativeIf: ['no tenderness', 'fine to touch', 'no difference when i move'],
      action: 'emergency',
    },
    {
      code: 'abdo_gi_bleed',
      ask: 'Have you been sick with blood, or noticed black or tarry stools?',
      positiveIf: ['blood', 'black stool', 'tarry', 'coffee ground', 'vomiting blood', 'red in the toilet'],
      negativeIf: ['no blood', 'nothing black', 'normal colour'],
      action: 'emergency',
    },
    {
      code: 'abdo_sudden_severe',
      ask: 'Did the pain come on suddenly and at full strength, or build up?',
      positiveIf: ['suddenly', 'all at once', 'instantly', 'doubled over', 'worst pain'],
      negativeIf: ['built up', 'gradual', 'over days', 'slowly'],
      action: 'emergency',
    },
    {
      code: 'abdo_obstruction',
      ask: 'Have you been able to pass wind or open your bowels, and are you keeping fluids down?',
      positiveIf: ['can\'t pass wind', 'no bowel', 'not opened my bowels', 'vomiting everything', 'can\'t keep anything down'],
      negativeIf: ['passing wind', 'bowels are normal', 'keeping fluids down'],
      action: 'urgent_same_day',
    },
    {
      code: 'abdo_pregnancy',
      ask: 'Is there any chance you could be pregnant?',
      positiveIf: ['could be', 'possibly', 'yes', 'i am pregnant', 'late period', 'missed a period'],
      negativeIf: ['no chance', 'not pregnant', 'no'],
      action: 'emergency',
      only: { sex: ['female'], minAge: 12, maxAge: 55 },
    },
  ],
  conditional: [
    { slot: 'pregnancy_status', sex: ['female'], minAge: 12, maxAge: 55 },
    { slot: 'recent_procedures' },
    { slot: 'travel' },
  ],
  slotOrder: [
    'presenting_complaint', 'location_radiation', 'duration_course', 'severity', 'red_flag_screen',
    'onset', 'character', 'associated_symptoms', 'aggravating_relieving',
    'relevant_history', 'current_medications', 'allergies',
  ],
  ask: {
    ...CORE_ASK,
    location_radiation: ['Whereabouts in your tummy is it — and does it travel anywhere?', 'Put a hand where it hurts most — is that one spot, or all over?'],
    character: ['Is it a cramping pain that comes in waves, or a constant ache?', 'Does it grip and let go, or is it always there?'],
    aggravating_relieving: ['Does eating make it better or worse?', 'Is there anything that eases it at all — food, heat, lying still?'],
    associated_symptoms: ['Anything with it — being sick, a change in your bowels, a fever?', 'What else has been going on alongside it?'],
  },
  confirm: { ...CORE_CONFIRM },
  sufficientWhen: {
    required: ['presenting_complaint', 'location_radiation', 'duration_course', 'severity', 'red_flag_screen'],
    minPatientTurns: 5,
  },
  confidenceCeiling: 'medium',
  clinicianOwner: null,
};
