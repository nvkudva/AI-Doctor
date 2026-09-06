// NOT CLINICALLY SIGNED OFF (see ./types.ts).
import { CORE_ASK, CORE_CONFIRM, type Protocol } from './types.ts';

export const cough: Protocol = {
  id: 'cough',
  version: '2026.09.06-1',
  label: 'Cough',
  match: ['cough', 'coughing', 'chest infection', 'phlegm', 'wheeze', 'wheezing', 'hoarse'],
  associated: ['fever', 'sputum', 'wheeze', 'chest_pain', 'breathlessness', 'night_sweats'],
  redFlags: [
    {
      code: 'cough_breathing',
      ask: 'Are you short of breath at rest, or having to fight for a breath?',
      positiveIf: ['short of breath at rest', 'fighting for breath', 'can\'t breathe', 'gasping', 'struggling to breathe'],
      negativeIf: ['only when i walk', 'breathing is fine', 'no breathlessness', 'not at rest'],
      action: 'emergency',
    },
    {
      code: 'cough_haemoptysis',
      ask: 'Have you coughed up any blood, even a streak?',
      positiveIf: ['blood', 'streak', 'red in it', 'coughing up blood', 'rusty'],
      negativeIf: ['no blood', 'nothing red', 'clear', 'no'],
      action: 'urgent_same_day',
    },
    {
      code: 'cough_chest_pain',
      ask: 'Any pain in your chest when you breathe in, or pressure across the front?',
      positiveIf: ['chest pain', 'hurts to breathe', 'pressure', 'tight across'],
      negativeIf: ['no chest pain', 'no pain', 'chest is fine'],
      action: 'emergency',
    },
    {
      code: 'cough_systemic',
      ask: 'Have you had night sweats, or lost weight without trying?',
      positiveIf: ['night sweats', 'soaking', 'lost weight', 'losing weight', 'clothes are loose'],
      negativeIf: ['no sweats', 'weight is the same', 'no'],
      action: 'urgent_same_day',
    },
  ],
  conditional: [
    { slot: 'smoking_alcohol' },
    { slot: 'occupational_exposure' },
    { slot: 'travel' },
    { slot: 'sick_contacts' },
  ],
  slotOrder: [
    'presenting_complaint', 'duration_course', 'severity', 'red_flag_screen',
    'character', 'associated_symptoms', 'onset', 'aggravating_relieving',
    'smoking_alcohol', 'relevant_history', 'current_medications', 'allergies',
  ],
  ask: {
    ...CORE_ASK,
    character: ['Is the cough dry, or are you bringing anything up?', 'When you cough, does anything come up — and what colour?'],
    duration_course: ['How long has the cough been there — and is it easing or getting worse?', 'Days, weeks, or longer than that?'],
    severity: ['Is it keeping you awake, or stopping you doing things?', 'How much is it getting in the way of your day?'],
    associated_symptoms: ['Anything with it — fever, wheeze, a sore throat?', 'What else came along with the cough?'],
  },
  confirm: { ...CORE_CONFIRM },
  sufficientWhen: {
    required: ['presenting_complaint', 'duration_course', 'severity', 'red_flag_screen', 'character'],
    minPatientTurns: 4,
  },
  confidenceCeiling: 'medium',
  clinicianOwner: null,
};
