// NOT CLINICALLY SIGNED OFF (see ./types.ts).
import { CORE_ASK, CORE_CONFIRM, type Protocol } from './types.ts';

export const headache: Protocol = {
  id: 'headache',
  version: '2026.09.06-1',
  label: 'Headache',
  match: ['headache', 'head ache', 'migraine', 'head hurts', 'head is pounding', 'pain in my head', 'head pain'],
  associated: ['nausea', 'photophobia', 'visual_change', 'neck_stiffness', 'fever', 'vomiting'],
  redFlags: [
    {
      code: 'headache_thunderclap',
      ask: 'Did it come on all at once, like a switch flipping — or did it build up?',
      positiveIf: ['all at once', 'sudden', 'suddenly', 'instant', 'switch', 'thunderclap', 'worst ever', 'worst headache', 'exploded'],
      negativeIf: ['built up', 'gradual', 'came on slowly', 'over hours', 'over days'],
      action: 'emergency',
    },
    {
      code: 'headache_focal_deficit',
      ask: 'Any weakness, numbness, or trouble with your speech or your vision?',
      positiveIf: ['weakness', 'weak', 'numb', 'slurred', 'can\'t speak', 'vision', 'blurred', 'double', 'face droop'],
      negativeIf: ['no weakness', 'nothing like that', 'speech is fine', 'vision is fine', 'no numbness'],
      action: 'emergency',
    },
    {
      code: 'headache_meningism',
      ask: 'Any fever, or is your neck stiff or painful to bend forward?',
      positiveIf: ['fever', 'temperature', 'neck is stiff', 'stiff neck', 'can\'t bend', 'hurts to bend', 'rash'],
      negativeIf: ['no fever', 'neck is fine', 'no stiffness'],
      action: 'urgent_same_day',
    },
    {
      code: 'headache_raised_icp',
      ask: 'Is it worse first thing in the morning, or when you cough, strain or lie down?',
      positiveIf: ['worse in the morning', 'when i cough', 'when i strain', 'lying down', 'bending over makes it worse'],
      negativeIf: ['no difference', 'same all day', 'no'],
      action: 'urgent_same_day',
    },
  ],
  conditional: [
    { slot: 'pregnancy_status', sex: ['female'], minAge: 12, maxAge: 55 },
    { slot: 'recent_procedures' },
  ],
  slotOrder: [
    'presenting_complaint', 'onset', 'duration_course', 'severity', 'red_flag_screen',
    'character', 'location_radiation', 'associated_symptoms', 'aggravating_relieving',
    'relevant_history', 'current_medications', 'allergies',
  ],
  ask: {
    ...CORE_ASK,
    character: ['Is it throbbing, pressing, or more of a sharp stab?', 'Does it pound with your pulse, or is it a steady band?'],
    location_radiation: ['Whereabouts is it — one side, both, behind the eyes?', 'If you had to put a hand on it, where would it go?'],
    associated_symptoms: ['Has anything come with it — feeling sick, light bothering you, anything odd with your vision?', 'Anything else alongside the headache?'],
  },
  confirm: { ...CORE_CONFIRM },
  sufficientWhen: {
    required: ['presenting_complaint', 'onset', 'duration_course', 'severity', 'character', 'red_flag_screen'],
    minPatientTurns: 4,
  },
  confidenceCeiling: 'medium',
  clinicianOwner: null,
};
