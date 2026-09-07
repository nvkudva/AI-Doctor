// Demo seed: pilot-hospital queue and patient history. Replaced by Supabase
// seed + generated types in Phase 1; shapes already match lib/core.
import type { CaseItem } from '../lib/core';
import type { Appointment, AppointmentSlot, LabValue, UserConsult, UserRx } from './types';

export const seedQueue: CaseItem[] = [
  { id: 'c1', patient: 'Maria Gonzalez', demo: '29 · Female · O−', title: 'Persistent dry cough, 2 weeks', meta: 'Submitted 14 min ago', status: 'pending',
    summary: 'Patient reports a dry, non-productive cough for ~2 weeks, worse at night, no fever. Mild chest tightness. No recent travel. Non-smoker.',
    symptoms: ['Dry cough', 'Worse at night', 'Chest tightness'], history: 'No chronic conditions. Seasonal allergies. No current medications.',
    relevantLabs: [{ name: 'CBC', date: 'Jun 20, 2026', result: 'Normal', ok: true }, { name: 'CRP', date: 'Jun 20, 2026', result: 'Mildly raised', ok: false }],
    pastLabs: [{ name: 'Allergy panel', date: 'Sep 2025', result: 'Dust mite +', ok: false }, { name: 'Spirometry', date: 'Sep 2025', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Seasonal rhinitis', date: 'Apr 2026', note: 'Antihistamine trial gave good relief; advised allergen avoidance.' }],
    confidence: 'medium', flags: [
      { code: 'duration_gt_2w', severity: 'warn', text: 'Cough over two weeks — imaging advised.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No class match against 0 recorded allergies.', source: 'validator' },
    ],
    stated: ['Dry cough 2 weeks', 'Worse at night', 'Mild chest tightness'], inferred: ['Likely post-nasal drip / airway irritation'],
    observation: 'She sounded a little breathless between sentences and cleared her throat often. No acute distress; speech was clear and she was fully alert.',
    rec: { type: 'investigation', title: 'Chest X-ray + trial of antihistamine',
      summary: 'Persistent cough; imaging advised.',
      items: [
        { name: 'Chest X-ray (PA view)', dosage: '', timing: 'Within 3 days', notes: 'Rule out lower respiratory involvement.', why: 'Because the cough has lasted more than two weeks.', detail: 'Rule out lower respiratory involvement.' },
        { name: 'Loratadine', dosage: '10 mg', timing: 'Once daily, 7 days', notes: 'For suspected post-nasal drip.', why: 'To settle a likely post-nasal drip driving the cough.', detail: '7-day trial for suspected post-nasal drip.' },
      ], advice: 'Return sooner if fever, breathlessness or coughing blood appears.', urgency: 'soon' } },
  { id: 'c2', patient: 'James Okoro', demo: '41 · Male · B+', title: 'Recurring migraines', meta: 'Submitted 40 min ago', status: 'pending',
    summary: 'Throbbing unilateral headaches 3× this month, photophobia, relieved by rest in dark room. No aura. Family history of migraine.',
    symptoms: ['Unilateral headache', 'Photophobia', 'Nausea'], history: 'Hypertension, on Amlodipine 5mg. No known drug allergies.',
    relevantLabs: [{ name: 'BP log (30d avg)', date: 'Jun 2026', result: '138/88', ok: false }],
    pastLabs: [{ name: 'Lipid profile', date: 'Jan 2026', result: 'Normal', ok: true }, { name: 'Fasting glucose', date: 'Jan 2026', result: 'Normal', ok: true }],
    pastConsults: [
      { title: 'Hypertension review', date: 'May 2026', note: 'BP borderline on Amlodipine; advised salt reduction and re-check.' },
      { title: 'Tension headache', date: 'Nov 2025', note: 'Stress-related; resolved with rest and hydration.' },
    ],
    confidence: 'high', flags: [
      { code: 'interaction', severity: 'warn', text: 'Check interaction with Amlodipine 5 mg OD.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No drug allergies on file.', source: 'validator' },
    ],
    stated: ['Throbbing one-sided headache', 'Light sensitivity', 'Nausea'], inferred: ['Migraine without aura'],
    observation: 'He winced while describing the pain and preferred to keep the screen dim. Alert and oriented, no slurred speech or weakness.',
    rec: { type: 'prescription', title: 'Acute migraine management', summary: 'Migraine without aura.',
      items: [
        { name: 'Sumatriptan', dosage: '50 mg', timing: 'At headache onset; repeat after 2h if needed', notes: 'Max 100 mg per day.', why: 'A triptan is first-line for acute migraine attacks.', detail: 'At onset of headache, may repeat after 2h (max 100mg/day).' },
        { name: 'Headache diary', dosage: '', timing: 'Daily, 4 weeks', notes: 'Track triggers, frequency and duration.', why: 'To spot triggers and see if preventive therapy is needed.', detail: 'Track triggers, frequency and duration for 4 weeks.' },
      ], advice: 'Book a follow-up if attacks exceed 4/month for preventive therapy.', urgency: 'routine' } },
  { id: 'c3', patient: 'Priya Sharma', demo: '36 · Female · A+', title: 'Skin rash on forearms', meta: 'Approved 1h ago', status: 'approved',
    summary: 'Itchy erythematous rash on both forearms after new detergent. No systemic symptoms. Likely contact dermatitis.',
    symptoms: ['Itchy rash', 'Redness', 'Bilateral forearms'], history: 'Eczema in childhood. No allergies on record.',
    relevantLabs: [{ name: 'Patch test', date: 'Ordered', result: 'Pending', ok: false }],
    pastLabs: [{ name: 'IgE total', date: 'Mar 2024', result: 'Slightly high', ok: false }],
    pastConsults: [{ title: 'Eczema flare', date: 'Aug 2025', note: 'Managed with emollients and short steroid course.' }],
    confidence: 'high', flags: [
      { code: 'allergy_clear', severity: 'info', text: 'No allergies on record.', source: 'validator' },
      { code: 'trigger_identified', severity: 'info', text: 'Clear trigger identified — removal is the main treatment.', source: 'validator' },
    ],
    stated: ['Itchy rash both forearms', 'Started after new detergent'], inferred: ['Contact dermatitis'],
    observation: 'Visible redness across both forearms in the uploaded photo, with mild scratch marks. Patient was calm and in no distress.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 3600 * 1000, decision: 'approved',
    rec: { type: 'prescription', title: 'Contact dermatitis care', summary: 'Contact dermatitis.',
      items: [
        { name: 'Hydrocortisone 1% cream', dosage: 'Thin layer', timing: 'Twice daily, up to 7 days', notes: 'Apply to affected areas only.', why: 'A mild topical steroid calms the inflamed skin.', detail: 'Thin layer twice daily for up to 7 days.' },
        { name: 'Avoid new detergent', dosage: '', timing: 'Ongoing', notes: 'Switch to fragrance-free; wash affected clothing.', why: 'Removing the trigger is the main treatment.', detail: 'Switch to fragrance-free; wash affected clothing.' },
      ], advice: 'Seek care if rash spreads or blisters form.', urgency: 'routine' } },
];

export const seedConsults: UserConsult[] = [
  { id: 'h1', title: 'Seasonal allergy check', date: 'Mar 4, 2026', status: 'Completed', note: 'Advised antihistamine; symptoms resolved within a week.',
    detail: {
      summary: 'Recurrent sneezing, itchy watery eyes and nasal congestion each spring, worse outdoors and in the mornings. No fever or facial pain.',
      evaluation: 'Seasonal allergic rhinitis', advice: 'Start the antihistamine before symptoms peak, and limit time outdoors when pollen counts are high.',
      tests: [], rx: [{ name: 'Cetirizine 10mg', dosage: '10 mg', timing: 'Once daily for 14 days' }],
    } },
  { id: 'h2', title: 'Lower back pain', date: 'Jan 18, 2026', status: 'Completed', note: 'Recommended stretching routine and posture review.',
    detail: {
      summary: 'Dull lower-back ache for about a week after a long drive, no leg pain, numbness or weakness. Eased by movement, worse after sitting.',
      evaluation: 'Mechanical (non-specific) lower back pain', advice: 'Keep moving gently; seek care if pain spreads down the leg or bladder changes appear.',
      tests: [], rx: [{ name: 'Stretching routine', dosage: '', timing: 'Twice daily, 2 weeks' }],
    } },
];

export const seedRx: UserRx[] = [
  { name: 'Cetirizine 10mg', detail: 'Once daily, 14 days', date: 'Mar 4, 2026', nextDose: 'Tonight, 8:00 pm' },
];

export const seedAppointments: Appointment[] = [
  { id: 'a1', title: 'Chest X-ray (PA view)', kind: 'Imaging', when: 'Fri 12 Sep · 10:30 am', where: 'Apollo Diagnostics · Koramangala' },
];

export const seedLabs = [
  { name: 'Complete Blood Count', date: 'Feb 2, 2026', result: 'Normal', ok: true },
  { name: 'Lipid Profile', date: 'Feb 2, 2026', result: 'Borderline', ok: false },
];

// Practice figures for the doctor profile — not derivable from the demo queue.
export const seedDoctor = {
  registration: 'GMC-483920',
  specialty: 'General Physician',
  patients: '1,284',
  years: '12',
  rating: '4.8',
  languages: 'English · Hindi · Kannada',
  hospital: 'Apollo Clinic · Koramangala',
};

// The one patient record this demo actually holds. Anything not listed here is
// unknown to the app and must not be asserted about a signed-in patient.
export const demoPatientProfile = {
  authId: 'demo-patient',
  name: 'Alex Kumar',
  age: '34',
  sex: 'Male',
  blood: 'O+',
  allergies: ['Penicillin'],
  history: 'Mild asthma. Allergic to Penicillin. Blood group O+.',
  demo: '34 · Male · O+',
  facts: 'Age 34, male, blood group O+, allergic to Penicillin, history of mild asthma. This is the whole record — do not assume anything beyond it.',
};

// A day in the doctor's book. Times are built from "today" so the demo calendar
// always has a morning that has already happened and an evening still to come.
function at(hour: number, min: number, dayOffset = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d.getTime();
}

export const seedDoctorSlots: AppointmentSlot[] = [
  { id: 'ap1', patient: 'Ravi Deshpande', kind: 'in_person', startsAt: at(9, 0), minutes: 20,
    location: 'CityCare · Diabetes clinic, Room 4', status: 'completed' },
  { id: 'ap2', patient: 'Sofia Rossi', kind: 'in_person', startsAt: at(9, 30), minutes: 20,
    location: 'CityCare · General practice, Room 2', status: 'completed' },
  { id: 'ap3', patient: 'Grace Mensah', kind: 'video', startsAt: at(10, 0), minutes: 15,
    location: 'Video consultation', status: 'completed' },
  { id: 'ap4', patient: 'Thabo Molefe', kind: 'in_person', startsAt: at(11, 0), minutes: 15,
    location: 'CityCare · Minor injuries', status: 'no_show' },
  { id: 'ap5', patient: 'Emily Watson', kind: 'in_person', startsAt: at(11, 30), minutes: 20,
    location: 'CityCare · General practice, Room 2', status: 'completed' },
  { id: 'ap6', patient: 'Omar Haddad', kind: 'in_person', startsAt: at(16, 30), minutes: 20,
    location: 'CityCare · General practice, Room 2', status: 'booked' },
  { id: 'ap7', patient: 'Aarav Nair', kind: 'video', startsAt: at(17, 0), minutes: 15,
    location: 'Video consultation', status: 'cancelled' },
  { id: 'ap8', patient: 'Ling Wei Chen', kind: 'video', startsAt: at(17, 30), minutes: 15,
    location: 'Video consultation', status: 'booked' },
  { id: 'ap9', patient: 'Fatima Sheikh', kind: 'video', startsAt: at(10, 0, 1), minutes: 15,
    location: 'Video consultation', status: 'booked' },
  { id: 'ap10', patient: 'Daniel Okafor', kind: 'in_person', startsAt: at(11, 30, 3), minutes: 20,
    location: 'CityCare · Respiratory clinic', status: 'booked' },
];

// Lab values with the range each is judged against, newest last per analyte so
// the trend line has something to draw.
function iso(y: number, m: number, d: number): number { return new Date(y, m - 1, d).getTime(); }

export const seedLabValues: LabValue[] = [
  { id: 'l1', panel: 'Complete Blood Count', analyte: 'Haemoglobin', value: 10.2, text: null, unit: 'g/dL',
    refLow: 12, refHigh: 15, abnormal: 'low', observedAt: iso(2026, 2, 17), reportPath: 'cbc-feb.pdf' },
  { id: 'l2', panel: 'Iron studies', analyte: 'Ferritin', value: 6, text: null, unit: 'ng/mL',
    refLow: 15, refHigh: 200, abnormal: 'low', observedAt: iso(2026, 2, 17), reportPath: 'iron-feb.pdf' },
  { id: 'l3', panel: 'Complete Blood Count', analyte: 'Haemoglobin', value: 11.4, text: null, unit: 'g/dL',
    refLow: 12, refHigh: 15, abnormal: 'low', observedAt: iso(2026, 4, 20), reportPath: null },
  { id: 'l4', panel: 'Complete Blood Count', analyte: 'Haemoglobin', value: 12.6, text: null, unit: 'g/dL',
    refLow: 12, refHigh: 15, abnormal: 'normal', observedAt: iso(2026, 6, 28), reportPath: 'cbc-jun.pdf' },
  { id: 'l5', panel: 'Iron studies', analyte: 'Ferritin', value: 8, text: null, unit: 'ng/mL',
    refLow: 15, refHigh: 200, abnormal: 'low', observedAt: iso(2026, 6, 28), reportPath: 'iron-jun.pdf' },
  { id: 'l6', panel: 'Lipid Profile', analyte: 'LDL cholesterol', value: 132, text: null, unit: 'mg/dL',
    refLow: 0, refHigh: 100, abnormal: 'high', observedAt: iso(2026, 2, 2), reportPath: 'lipids-feb.pdf' },
];
