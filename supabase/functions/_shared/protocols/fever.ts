// NOT CLINICALLY SIGNED OFF (see ./types.ts).
import { CORE_ASK, CORE_CONFIRM, type Protocol } from './types.ts';

export const fever: Protocol = {
  id: 'fever',
  version: '2026.09.06-1',
  label: 'Fever',
  match: ['fever', 'temperature', 'burning up', 'hot and cold', 'shivering', 'chills', 'feverish'],
  associated: ['rigors', 'rash', 'neck_stiffness', 'cough', 'urinary_symptoms', 'diarrhoea', 'confusion'],
  redFlags: [
    {
      code: 'fever_sepsis',
      ask: 'Have you been shivering uncontrollably, or felt confused or very drowsy with it?',
      positiveIf: ['shivering uncontrollably', 'shaking', 'rigors', 'confused', 'drowsy', 'not making sense', 'can\'t stay awake'],
      negativeIf: ['no shivering', 'not confused', 'wide awake', 'alert'],
      action: 'emergency',
    },
    {
      code: 'fever_non_blanching_rash',
      ask: 'Any rash — and if you press a glass against it, does it fade?',
      positiveIf: ['rash', 'does not fade', 'doesn\'t fade', 'stays', 'spots', 'purple'],
      negativeIf: ['no rash', 'it fades', 'nothing on my skin'],
      action: 'emergency',
    },
    {
      code: 'fever_meningism',
      ask: 'Is your neck stiff, or does bright light bother your eyes?',
      positiveIf: ['neck is stiff', 'stiff neck', 'light hurts', 'photophobia', 'can\'t look at light'],
      negativeIf: ['neck is fine', 'no stiffness', 'light is fine'],
      action: 'emergency',
    },
    {
      code: 'fever_breathing',
      ask: 'Are you short of breath, or breathing faster than usual?',
      positiveIf: ['short of breath', 'breathless', 'breathing fast', 'can\'t catch my breath'],
      negativeIf: ['breathing is fine', 'no breathlessness'],
      action: 'urgent_same_day',
    },
    {
      code: 'fever_immunocompromise',
      ask: 'Are you on chemotherapy, steroids, or anything that affects your immune system?',
      positiveIf: ['chemo', 'chemotherapy', 'steroids', 'immunosuppress', 'transplant', 'methotrexate'],
      negativeIf: ['nothing like that', 'no', 'none'],
      action: 'urgent_same_day',
    },
  ],
  conditional: [
    { slot: 'travel' },
    { slot: 'sick_contacts' },
    { slot: 'pregnancy_status', sex: ['female'], minAge: 12, maxAge: 55 },
  ],
  slotOrder: [
    'presenting_complaint', 'duration_course', 'severity', 'red_flag_screen',
    'onset', 'associated_symptoms', 'travel', 'sick_contacts',
    'relevant_history', 'current_medications', 'allergies',
  ],
  ask: {
    ...CORE_ASK,
    severity: ['Have you measured it — and is it keeping you in bed?', 'Roughly how high has it got, if you took a reading?'],
    associated_symptoms: ['Anything alongside it — a cough, a sore throat, tummy upset, pain passing water?', 'What else has come with the fever?'],
    duration_course: ['How many days has the fever been there, and does it come and go through the day?', 'Is it settling, or climbing?'],
  },
  confirm: { ...CORE_CONFIRM },
  sufficientWhen: {
    required: ['presenting_complaint', 'duration_course', 'severity', 'red_flag_screen', 'associated_symptoms'],
    minPatientTurns: 4,
  },
  confidenceCeiling: 'medium',
  clinicianOwner: null,
};
