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
  { id: 'c4', patient: 'Daniel Kim', demo: '52 · Male · A−', title: 'Fever and chills, 3 days', meta: 'Submitted 6 min ago', status: 'pending_review',
    summary: 'Temperature 38.9°C for 3 days with chills, body aches and a mild sore throat. No cough or breathlessness. Taking paracetamol with partial relief.',
    symptoms: ['Fever 38.9°C', 'Chills', 'Body aches', 'Sore throat'], history: 'Type 2 diabetes, on Metformin 500mg twice daily. No known drug allergies.',
    relevantLabs: [{ name: 'CBC', date: 'Jul 2, 2026', result: 'WBC mildly raised', ok: false }, { name: 'CRP', date: 'Jul 2, 2026', result: 'Raised', ok: false }],
    pastLabs: [{ name: 'HbA1c', date: 'Apr 2026', result: '7.1%', ok: false }, { name: 'Urine routine', date: 'Apr 2026', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Diabetes review', date: 'Apr 2026', note: 'HbA1c above target; diet plan reinforced, re-check in 3 months.' }],
    confidence: 'medium', flags: [
      { code: 'fever_gt_3d', severity: 'warn', text: 'Fever beyond 3 days in a diabetic patient — review promptly.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No class match against 0 recorded allergies.', source: 'validator' },
    ],
    stated: ['Fever for 3 days', 'Chills and body aches', 'Mild sore throat'], inferred: ['Likely viral upper respiratory infection; bacterial cause not excluded'],
    observation: 'He looked flushed and tired, speaking in short sentences. Alert and oriented; no confusion or neck stiffness noted.',
    rec: { type: 'investigation', title: 'Fever workup and symptomatic care',
      summary: 'Undifferentiated fever, day 3, in a patient with diabetes.',
      items: [
        { name: 'Paracetamol', dosage: '650 mg', timing: 'Every 6 hours as needed, max 3 g/day', notes: 'For fever and body aches.', why: 'To control fever and aches while the cause is clarified.', detail: '650 mg every 6 hours as needed (max 3 g/day).' },
        { name: 'Blood culture + urine routine', dosage: '', timing: 'Today', notes: 'Before any antibiotic is started.', why: 'Persistent fever in diabetes needs a source looked for.', detail: 'Collect today, before antibiotics.' },
      ], advice: 'Seek urgent care if fever exceeds 39.5°C, breathing worsens, or confusion develops.', urgency: 'urgent' } },
  { id: 'c5', patient: 'Aisha Bello', demo: '33 · Female · O+', title: 'Upper stomach pain after meals', meta: 'Submitted 22 min ago', status: 'pending',
    summary: 'Burning upper-abdominal pain after meals for 10 days, worse lying flat, with occasional acid taste. No vomiting, weight loss or black stools.',
    symptoms: ['Epigastric burning', 'Worse after meals', 'Acid reflux'], history: 'No chronic conditions. Occasional ibuprofen use for period pain. No allergies on record.',
    relevantLabs: [{ name: 'H. pylori stool antigen', date: 'Ordered', result: 'Pending', ok: false }],
    pastLabs: [{ name: 'CBC', date: 'Dec 2025', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Gastritis query', date: 'Dec 2025', note: 'Antacid trial helped briefly; advised food diary.' }],
    confidence: 'high', flags: [
      { code: 'nsaid_use', severity: 'warn', text: 'Regular NSAID use may be aggravating gastric symptoms.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No allergies on record.', source: 'validator' },
    ],
    stated: ['Burning pain after meals', 'Worse lying flat', 'Acid taste'], inferred: ['Likely reflux / gastritis'],
    observation: 'She pressed her upper abdomen while describing meals. Comfortable at rest, no guarding or distress.',
    rec: { type: 'prescription', title: 'Reflux and gastritis care', summary: 'Likely reflux / gastritis.',
      items: [
        { name: 'Omeprazole', dosage: '20 mg', timing: 'Once daily before breakfast, 14 days', notes: 'Take 30 minutes before food.', why: 'Reducing acid lets the stomach lining settle.', detail: '20 mg once daily before breakfast for 14 days.' },
        { name: 'Avoid NSAIDs; smaller evening meals', dosage: '', timing: 'Ongoing', notes: 'Use paracetamol instead; no food 3h before bed.', why: 'NSAIDs and late meals both worsen reflux.', detail: 'Switch to paracetamol; avoid late meals.' },
      ], advice: 'Seek care urgently for vomiting blood, black stools or severe pain.', urgency: 'soon' } },
  { id: 'c6', patient: 'Tomas Novak', demo: '47 · Male · AB+', title: 'Lower back pain, 5 days', meta: 'Submitted 1h ago', status: 'pending_review',
    summary: 'Dull lower-back pain since lifting a heavy box 5 days ago. No leg pain, numbness, weakness or bladder change. Eases with walking.',
    symptoms: ['Lower back ache', 'Stiffness in morning', 'No leg symptoms'], history: 'Sedentary desk job. No prior back surgery. Allergic to sulfonamides (rash).',
    relevantLabs: [{ name: 'Vitamin D', date: 'May 2026', result: 'Low', ok: false }],
    pastLabs: [{ name: 'Lipid profile', date: 'May 2026', result: 'Borderline', ok: false }],
    pastConsults: [{ title: 'Neck strain', date: 'Feb 2026', note: 'Resolved with heat and posture advice.' }],
    confidence: 'high', flags: [
      { code: 'allergy_sulfonamide', severity: 'warn', text: 'Sulfonamide allergy on file — avoid sulfa drugs.', source: 'validator' },
      { code: 'red_flag_screen', severity: 'info', text: 'No red-flag features reported (no saddle numbness, weakness or bladder change).', source: 'validator' },
    ],
    stated: ['Back pain after lifting', 'Morning stiffness', 'No leg pain'], inferred: ['Mechanical lower back strain'],
    observation: 'He stood and turned cautiously but walked with a normal gait. No obvious deformity; alert and comfortable.',
    rec: { type: 'prescription', title: 'Mechanical back pain plan', summary: 'Mechanical lower back strain, no red flags.',
      items: [
        { name: 'Paracetamol', dosage: '650 mg', timing: 'Every 8 hours as needed, 5 days', notes: 'Avoid NSAIDs if they upset the stomach.', why: 'Simple analgesia while the strain settles.', detail: '650 mg every 8 hours as needed for 5 days.' },
        { name: 'Gentle mobility and heat', dosage: '', timing: 'Twice daily, 2 weeks', notes: 'Short walks; avoid bed rest beyond a day.', why: 'Movement speeds recovery in mechanical back pain.', detail: 'Heat plus short walks twice daily.' },
      ], advice: 'Seek care if pain spreads below the knee, or numbness or bladder changes appear.', urgency: 'routine' } },
  { id: 'c7', patient: 'Elena Petrova', demo: '28 · Female · B−', title: 'Anxiety and poor sleep, 6 weeks', meta: 'Submitted 2h ago', status: 'pending',
    summary: 'Racing thoughts at night, difficulty falling asleep for 6 weeks, daytime tiredness. No self-harm thoughts. Work stress increased recently.',
    symptoms: ['Difficulty falling asleep', 'Racing thoughts', 'Daytime fatigue'], history: 'No chronic conditions. No current medications. No allergies on record.',
    relevantLabs: [{ name: 'TSH', date: 'Ordered', result: 'Pending', ok: false }],
    pastLabs: [{ name: 'CBC', date: 'Nov 2025', result: 'Normal', ok: true }, { name: 'Ferritin', date: 'Nov 2025', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Stress review', date: 'Nov 2025', note: 'Sleep hygiene discussed; symptoms had settled at that time.' }],
    confidence: 'medium', flags: [
      { code: 'safety_screen', severity: 'info', text: 'No self-harm ideation reported; crisis contacts included in advice.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No allergies on record.', source: 'validator' },
    ],
    stated: ['Cannot switch off at night', 'Tired in the day', 'Work stress'], inferred: ['Anxiety-related insomnia'],
    observation: 'She spoke quickly and fidgeted with her sleeve. Tearful briefly when describing work, then settled; fully alert.',
    rec: { type: 'prescription', title: 'Sleep and anxiety support plan', summary: 'Anxiety-related insomnia, no safety concerns raised.',
      items: [
        { name: 'Sleep hygiene routine', dosage: '', timing: 'Nightly, 4 weeks', notes: 'Fixed wake time, no screens 1h before bed, caffeine before noon only.', why: 'Regular cues retrain sleep onset without sedatives.', detail: 'Fixed wake time; screens off 1h before bed.' },
        { name: 'Guided breathing / CBT-I exercises', dosage: '', timing: '10 minutes nightly, 4 weeks', notes: 'App-based programme offered.', why: 'CBT-I is first-line for insomnia.', detail: '10 minutes nightly for 4 weeks.' },
      ], advice: 'Contact the clinic or a crisis line at once if you ever feel unsafe; book review in 2 weeks.', urgency: 'routine' } },
  { id: 'c8', patient: 'Kwame Asante', demo: '39 · Male · O−', title: 'Right ear pain, 4 days', meta: 'Approved 3h ago', status: 'approved',
    summary: 'Right ear ache for 4 days with muffled hearing after a cold. No discharge or fever. Pain eases with warm compress.',
    symptoms: ['Right ear pain', 'Muffled hearing', 'Recent cold'], history: 'Recurrent childhood ear infections. No allergies on record.',
    relevantLabs: [{ name: 'Otoscopy (photo)', date: 'Jul 1, 2026', result: 'Dull, retracted drum', ok: false }],
    pastLabs: [{ name: 'Audiometry', date: 'Jun 2024', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Viral cold', date: 'Jun 2026', note: 'Symptomatic care; resolved in a week.' }],
    confidence: 'high', flags: [
      { code: 'allergy_clear', severity: 'info', text: 'No allergies on record.', source: 'validator' },
    ],
    stated: ['Ear pain 4 days', 'Muffled hearing', 'After a cold'], inferred: ['Eustachian tube dysfunction / early otitis media'],
    observation: 'He tilted his head toward the camera to hear questions. No swelling behind the ear; comfortable at rest.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 3 * 3600 * 1000, decision: 'approved',
    rec: { type: 'prescription', title: 'Ear pain care', summary: 'Eustachian dysfunction after a cold.',
      items: [
        { name: 'Ibuprofen', dosage: '400 mg', timing: 'Every 8 hours with food, up to 3 days', notes: 'For ear pain; stop if stomach upset.', why: 'An anti-inflammatory eases ear pain and pressure.', detail: '400 mg every 8 hours with food, up to 3 days.' },
        { name: 'Steam inhalation and warm compress', dosage: '', timing: 'Twice daily, 5 days', notes: 'Keep the ear dry; no cotton buds.', why: 'Helps the tube drain and relieves pressure.', detail: 'Twice daily for 5 days; keep ear dry.' },
      ], advice: 'Seek care if discharge, fever or worsening hearing appears.', urgency: 'routine' } },
  { id: 'c9', patient: 'Ingrid Johansson', demo: '61 · Female · A+', title: 'Burning on urination, 2 days', meta: 'Submitted 18 min ago', status: 'pending_review',
    summary: 'Burning when passing urine for 2 days with frequent small volumes and lower abdominal ache. No fever or back pain. No blood seen.',
    symptoms: ['Dysuria', 'Frequency', 'Suprapubic ache'], history: 'Hypertension, on Lisinopril 10mg daily. Postmenopausal. No known drug allergies.',
    relevantLabs: [{ name: 'Urine dipstick', date: 'Jul 2, 2026', result: 'Leucocytes +, nitrites +', ok: false }],
    pastLabs: [{ name: 'Creatinine / eGFR', date: 'Mar 2026', result: 'Normal', ok: true }, { name: 'Urine culture', date: 'Mar 2026', result: 'No growth', ok: true }],
    pastConsults: [{ title: 'Hypertension review', date: 'Mar 2026', note: 'BP controlled on Lisinopril; continue and re-check in 6 months.' }],
    confidence: 'high', flags: [
      { code: 'interaction', severity: 'warn', text: 'Check antibiotic choice against Lisinopril 10 mg OD.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No drug allergies on file.', source: 'validator' },
    ],
    stated: ['Burning on urination', 'Passing urine often', 'Lower tummy ache'], inferred: ['Likely uncomplicated urinary tract infection'],
    observation: 'She shifted uncomfortably and asked to pause once. Alert, afebrile in appearance, no flank pain described.',
    rec: { type: 'prescription', title: 'Urinary infection care', summary: 'Likely uncomplicated UTI.',
      items: [
        { name: 'Nitrofurantoin', dosage: '100 mg', timing: 'Twice daily with food, 5 days', notes: 'Complete the course; check suitability with kidney function.', why: 'First-line antibiotic for uncomplicated cystitis.', detail: '100 mg twice daily with food for 5 days.' },
        { name: 'Fluids and urine culture', dosage: '', timing: 'Culture today; fluids ongoing', notes: 'Send sample before first dose if possible.', why: 'Culture confirms the organism if symptoms persist.', detail: 'Urine culture today; drink regularly.' },
      ], advice: 'Seek urgent care for fever, back/flank pain, vomiting or visible blood.', urgency: 'urgent' } },
  { id: 'c10', patient: 'Yusuf Al-Rashid', demo: '38 · Male · B+', title: 'Headaches most mornings', meta: 'Changes requested 5h ago', status: 'changes',
    summary: 'Dull morning headaches 4–5 days a week for a month, with jaw ache on waking. Partner reports loud snoring. No visual change or weakness.',
    symptoms: ['Morning headache', 'Jaw ache', 'Loud snoring'], history: 'No chronic conditions. No regular medications. Allergic to latex (contact rash).',
    relevantLabs: [{ name: 'BP (home avg)', date: 'Jun 2026', result: '128/82', ok: true }],
    pastLabs: [{ name: 'Fasting glucose', date: 'Feb 2026', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Dental review', date: 'May 2026', note: 'Bruxism noted; mouth guard advised.' }],
    confidence: 'medium', flags: [
      { code: 'info_needed', severity: 'warn', text: 'Sleep history incomplete — witnessed apnoeas not yet clarified.', source: 'validator' },
      { code: 'allergy_latex', severity: 'info', text: 'Latex allergy on file; no latex-containing item proposed.', source: 'validator' },
    ],
    stated: ['Headache on waking', 'Jaw ache', 'Snoring'], inferred: ['Possible sleep apnoea / bruxism-related headache'],
    observation: 'He rubbed his jaw while talking and yawned twice. Alert, speech clear, no neurological signs described.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 5 * 3600 * 1000, decision: 'changes',
    rec: { type: 'investigation', title: 'Sleep and headache assessment', summary: 'Morning headaches; sleep cause to clarify.',
      items: [
        { name: 'Sleep study referral', dosage: '', timing: 'Within 2 weeks', notes: 'Partner to note witnessed apnoeas meanwhile.', why: 'Morning headache plus snoring needs apnoea excluded.', detail: 'Refer within 2 weeks.' },
        { name: 'Headache and sleep diary', dosage: '', timing: 'Daily, 2 weeks', notes: 'Record wake time, headache score and snoring.', why: 'Pattern helps separate apnoea from bruxism.', detail: 'Daily for 2 weeks.' },
      ], advice: 'Seek urgent care for sudden worst-ever headache, weakness or visual change.', urgency: 'soon' } },
  { id: 'c11', patient: "Margaret O'Brien", demo: '67 · Female · O+', title: 'Productive cough and breathlessness', meta: 'Declined 2h ago · in-person advised', status: 'rejected',
    summary: 'Productive cough with green sputum for a week, increasing breathlessness on stairs and low-grade fever. Ex-smoker, quit 5 years ago.',
    symptoms: ['Productive cough', 'Breathlessness on exertion', 'Low-grade fever'], history: 'COPD under monitoring. On inhaled salbutamol as needed. No known drug allergies.',
    relevantLabs: [{ name: 'SpO2 (home)', date: 'Jul 2, 2026', result: '93% on air', ok: false }, { name: 'CRP', date: 'Jul 1, 2026', result: 'Raised', ok: false }],
    pastLabs: [{ name: 'Spirometry', date: 'Oct 2025', result: 'Moderate obstruction', ok: false }, { name: 'Chest X-ray', date: 'Oct 2025', result: 'Hyperinflation', ok: false }],
    pastConsults: [{ title: 'COPD review', date: 'Oct 2025', note: 'Inhaler technique corrected; action plan given.' }],
    confidence: 'low', flags: [
      { code: 'red_flag_breathlessness', severity: 'block', text: 'Exertional breathlessness with SpO2 93% — needs in-person assessment, not remote sign-off.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No drug allergies on file.', source: 'validator' },
    ],
    stated: ['Coughing green sputum', 'Breathless on stairs', 'Feverish'], inferred: ['Possible COPD exacerbation / chest infection'],
    observation: 'She paused mid-sentence to catch her breath twice and used short phrases. Audibly wheezy; this needs hands-on examination.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 2 * 3600 * 1000, decision: 'rejected',
    rejectReason: 'Breathlessness with SpO2 93% needs same-day in-person assessment; remote prescription declined.',
    rec: { type: 'investigation', title: 'Same-day in-person respiratory assessment', summary: 'Possible COPD exacerbation — examine in person.',
      items: [
        { name: 'In-person review with chest examination', dosage: '', timing: 'Today', notes: 'Bring inhalers and medication list.', why: 'Breathlessness and oxygen level need direct examination.', detail: 'Same-day appointment booked at CityCare.' },
        { name: 'Salbutamol inhaler (existing)', dosage: '2 puffs', timing: 'As needed, up to 4-hourly', notes: 'Use spacer; seek help if needing it more often.', why: 'Reliever inhaler while awaiting review.', detail: '2 puffs as needed via spacer.' },
      ], advice: 'Call emergency services if breathlessness worsens at rest or lips look blue.', urgency: 'urgent' } },
  { id: 'c12', patient: 'Kenji Tanaka', demo: '24 · Male · A+', title: 'Itchy rash on neck and elbows', meta: 'Approved 30 min ago', status: 'approved',
    summary: 'Itchy dry patches on neck and elbow folds for 2 weeks, worse after hot showers. No new medicines or foods. Similar patches as a teenager.',
    symptoms: ['Itchy dry patches', 'Neck and elbow folds', 'Worse after heat'], history: 'Teenage eczema, settled for years. No allergies on record.',
    relevantLabs: [{ name: 'Skin photo review', date: 'Jul 2, 2026', result: 'Dry eczematous patches', ok: false }],
    pastLabs: [{ name: 'IgE total', date: 'Jan 2025', result: 'Normal', ok: true }],
    pastConsults: [{ title: 'Dry skin advice', date: 'Jan 2025', note: 'Emollient routine started; settled at that time.' }],
    confidence: 'high', flags: [
      { code: 'allergy_clear', severity: 'info', text: 'No allergies on record.', source: 'validator' },
    ],
    stated: ['Itchy patches 2 weeks', 'Neck and elbows', 'Worse after hot showers'], inferred: ['Eczema flare'],
    observation: 'Dry, scratched patches visible in the uploaded photos. Patient calm, no signs of skin infection.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 30 * 60 * 1000, decision: 'approved',
    rec: { type: 'prescription', title: 'Eczema flare care', summary: 'Eczema flare, no infection.',
      items: [
        { name: 'Emollient cream', dosage: 'Generous layer', timing: 'Twice daily, ongoing', notes: 'Apply after lukewarm showers.', why: 'Restoring the skin barrier is the base of eczema care.', detail: 'Twice daily, ongoing.' },
        { name: 'Hydrocortisone 1% cream', dosage: 'Thin layer', timing: 'Once daily to active patches, up to 7 days', notes: 'Avoid face and skin folds unless advised.', why: 'Short mild steroid course settles the flare.', detail: 'Thin layer once daily, up to 7 days.' },
      ], advice: 'Seek care if patches weep, crust or spread quickly.', urgency: 'routine' } },
  { id: 'c13', patient: 'Lucia Fernandez', demo: '55 · Female · AB−', title: 'Bloating and stomach discomfort', meta: 'Approved yesterday', status: 'approved',
    summary: 'Bloating and upper stomach discomfort after fatty meals for 3 weeks, with mild nausea. No vomiting, jaundice or weight loss.',
    symptoms: ['Bloating', 'Post-meal discomfort', 'Mild nausea'], history: 'Gallstones noted on scan in 2024, asymptomatic since. No known drug allergies.',
    relevantLabs: [{ name: 'LFTs', date: 'Jun 28, 2026', result: 'Normal', ok: true }, { name: 'Lipase', date: 'Jun 28, 2026', result: 'Normal', ok: true }],
    pastLabs: [{ name: 'Abdominal ultrasound', date: 'Aug 2024', result: 'Gallstones, no duct dilation', ok: false }],
    pastConsults: [{ title: 'Gallstone finding', date: 'Aug 2024', note: 'Incidental; advised to report biliary pain promptly.' }],
    confidence: 'medium', flags: [
      { code: 'gallstone_history', severity: 'warn', text: 'Known gallstones — advise on biliary colic red flags.', source: 'validator' },
      { code: 'allergy_clear', severity: 'info', text: 'No drug allergies on file.', source: 'validator' },
    ],
    stated: ['Bloated after fatty meals', 'Upper tummy discomfort', 'Mild nausea'], inferred: ['Likely biliary-type dyspepsia; gallstones known'],
    observation: 'She rested a hand under her right ribs while describing meals. Comfortable, no jaundice visible, alert.',
    reviewedBy: 'Dr. Whitfield', reviewedAt: Date.now() - 26 * 3600 * 1000, decision: 'approved',
    rec: { type: 'investigation', title: 'Gallbladder review plan', summary: 'Known gallstones with new post-meal symptoms.',
      items: [
        { name: 'Abdominal ultrasound', dosage: '', timing: 'Within 2 weeks', notes: 'Compare with 2024 scan.', why: 'Symptoms with known stones need a fresh look.', detail: 'Book within 2 weeks.' },
        { name: 'Paracetamol', dosage: '650 mg', timing: 'Every 8 hours as needed', notes: 'For discomfort episodes; note what triggers them.', why: 'Simple pain relief while imaging is arranged.', detail: '650 mg every 8 hours as needed.' },
      ], advice: 'Seek urgent care for severe right-sided pain, fever or yellowing of the eyes.', urgency: 'soon' } },
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
  { id: 'h3', title: 'Fever and sore throat', date: 'Jun 12, 2026', status: 'Completed', note: 'Viral course expected; fever settled in 4 days.',
    detail: {
      summary: 'Fever 38.6°C with sore throat and body aches for 2 days. No cough, rash or ear pain; drinking fluids well.',
      evaluation: 'Viral upper respiratory infection', advice: 'Rest and fluids; return if fever passes 5 days or breathing becomes difficult.',
      tests: [{ name: 'Throat swab', detail: 'No bacterial growth' }], rx: [{ name: 'Paracetamol 650mg', dosage: '650 mg', timing: 'Every 6 hours as needed, 3 days' }],
    } },
  { id: 'h4', title: 'Stomach pain and reflux', date: 'May 20, 2026', status: 'Completed', note: 'Improved on acid suppression; diet triggers identified.',
    detail: {
      summary: 'Burning upper stomach pain after spicy meals for 2 weeks, worse at night. No weight loss or vomiting.',
      evaluation: 'Gastro-oesophageal reflux', advice: 'Smaller evening meals and head-of-bed elevation; review if pain persists beyond the course.',
      tests: [{ name: 'H. pylori stool antigen', detail: 'Negative' }], rx: [{ name: 'Omeprazole 20mg', dosage: '20 mg', timing: 'Once daily before breakfast, 28 days' }],
    } },
  { id: 'h5', title: 'Anxiety and insomnia review', date: 'Apr 28, 2026', status: 'Completed', note: 'Sleep improved with routine; follow-up offered.',
    detail: {
      summary: 'Trouble falling asleep for a month with racing thoughts before bed and early waking twice a week. Daytime concentration reduced.',
      evaluation: 'Anxiety-related insomnia', advice: 'Keep a fixed wake time and wind-down routine; book review if mood dips or sleep worsens.',
      tests: [{ name: 'TSH', detail: 'Normal' }], rx: [{ name: 'CBT-I exercise programme', dosage: '', timing: '10 minutes nightly, 4 weeks' }],
    } },
  { id: 'h6', title: 'Ear pain after a cold', date: 'Apr 9, 2026', status: 'Completed', note: 'Hearing back to normal within a week.',
    detail: {
      summary: 'Left ear ache and muffled hearing for 3 days after a cold. No discharge or fever.',
      evaluation: 'Eustachian tube dysfunction', advice: 'Keep the ear dry; return if discharge, fever or hearing loss returns.',
      tests: [], rx: [{ name: 'Ibuprofen 400mg', dosage: '400 mg', timing: 'Every 8 hours with food, up to 3 days' }],
    } },
  { id: 'h7', title: 'Urinary symptoms', date: 'Mar 19, 2026', status: 'Completed', note: 'Symptoms cleared by day 3 of the course.',
    detail: {
      summary: 'Burning on passing urine with frequency for 2 days. No fever, back pain or visible blood.',
      evaluation: 'Uncomplicated urinary tract infection', advice: 'Finish the course even if symptoms settle; seek care for fever or flank pain.',
      tests: [{ name: 'Urine culture', detail: 'E. coli, sensitive to nitrofurantoin' }], rx: [{ name: 'Nitrofurantoin 100mg', dosage: '100 mg', timing: 'Twice daily with food, 5 days' }],
    } },
  { id: 'h8', title: 'Back pain follow-up', date: 'Feb 26, 2026', status: 'Completed', note: 'Pain easing; mobility routine continued.',
    detail: {
      summary: 'Lower back ache for 10 days after gardening, improving steadily. No leg pain, numbness or weakness.',
      evaluation: 'Mechanical lower back pain, improving', advice: 'Stay active and build up walks; seek care if pain travels below the knee.',
      tests: [], rx: [{ name: 'Paracetamol 650mg', dosage: '650 mg', timing: 'Every 8 hours as needed, 5 days' }, { name: 'Heat and mobility routine', dosage: '', timing: 'Twice daily, 2 weeks' }],
    } },
];

export const seedRx: UserRx[] = [
  { name: 'Cetirizine 10mg', dosage: '10 mg', detail: 'Once daily, 14 days', date: 'Mar 4, 2026', nextDose: 'Tonight, 8:00 pm' },
  { name: 'Paracetamol 650mg', dosage: '650 mg', detail: 'Every 6 hours as needed, 3 days', date: 'Jun 12, 2026', nextDose: 'Today, 2:00 pm' },
  { name: 'Omeprazole 20mg', dosage: '20 mg', detail: 'Once daily before breakfast, 28 days', date: 'May 20, 2026', nextDose: 'Tomorrow, 7:30 am' },
  { name: 'Nitrofurantoin 100mg', dosage: '100 mg', detail: 'Twice daily with food, 5 days', date: 'Mar 19, 2026', nextDose: 'Tonight, 9:00 pm' },
  { name: 'Hydrocortisone 1% cream', dosage: 'Thin layer', detail: 'Once daily to active patches, 7 days', date: 'Jul 2, 2026', nextDose: 'Tonight, 7:00 pm' },
  { name: 'Ibuprofen 400mg', dosage: '400 mg', detail: 'Every 8 hours with food, 3 days', date: 'Jul 1, 2026', nextDose: 'Today, 6:00 pm' },
];

export const seedAppointments: Appointment[] = [
  { id: 'a1', title: 'Chest X-ray (PA view)', kind: 'Imaging', when: 'Fri 12 Sep · 10:30 am', where: 'Apollo Diagnostics · Koramangala' },
  { id: 'a2', title: 'Abdominal ultrasound', kind: 'Imaging', when: 'Mon 15 Sep · 9:00 am', where: 'CityCare · Imaging, Ground floor' },
  { id: 'a3', title: 'Urine culture (sample drop)', kind: 'Lab', when: 'Sat 13 Sep · 8:30 am', where: 'CityCare · Laboratory' },
  { id: 'a4', title: 'Follow-up: back pain review', kind: 'In-person', when: 'Wed 17 Sep · 4:15 pm', where: 'CityCare · General practice, Room 2' },
  { id: 'a5', title: 'Sleep study referral (intake call)', kind: 'Video', when: 'Thu 18 Sep · 6:00 pm', where: 'Video consultation' },
];

export const seedLabs = [
  { name: 'Complete Blood Count', date: 'Feb 2, 2026', result: 'Normal', ok: true },
  { name: 'Lipid Profile', date: 'Feb 2, 2026', result: 'Borderline', ok: false },
  { name: 'HbA1c', date: 'Apr 14, 2026', result: '7.1%', ok: false },
  { name: 'Thyroid (TSH)', date: 'Apr 28, 2026', result: 'Normal', ok: true },
  { name: 'Urine Culture', date: 'Mar 19, 2026', result: 'E. coli, treated', ok: false },
  { name: 'Liver Function Tests', date: 'Jun 28, 2026', result: 'Normal', ok: true },
  { name: 'Vitamin D', date: 'May 6, 2026', result: 'Low', ok: false },
];

// Practice figures for the doctor profile — not derivable from the demo queue.
// No patient count, no years, no rating: a consumer-marketplace rating badge
// on a clinical console signals the wrong product, and the hospital is the
// tenant's, resolved once, not a second employer written into a seed
// (DESIGN-REVIEW D29).
export const seedDoctor = {
  registration: 'GMC-483920',
  specialty: 'General Physician',
  languages: 'English · Hindi · Kannada',
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
  { id: 'ap11', patient: 'Ingrid Johansson', kind: 'video', startsAt: at(12, 0), minutes: 15,
    location: 'Video consultation', status: 'booked', reason: 'Urinary symptoms follow-up' },
  { id: 'ap12', patient: 'Tomas Novak', kind: 'in_person', startsAt: at(14, 0), minutes: 20,
    location: 'CityCare · General practice, Room 2', status: 'booked', reason: 'Back pain review' },
  { id: 'ap13', patient: 'Aisha Bello', kind: 'video', startsAt: at(15, 30), minutes: 15,
    location: 'Video consultation', status: 'completed', reason: 'Stomach pain review' },
  { id: 'ap14', patient: 'Kenji Tanaka', kind: 'lab', startsAt: at(8, 30, 1), minutes: 10,
    location: 'CityCare · Laboratory', status: 'booked', reason: 'Skin review bloods' },
  { id: 'ap15', patient: 'Lucia Fernandez', kind: 'imaging', startsAt: at(9, 45, 2), minutes: 30,
    location: 'CityCare · Imaging, Ground floor', status: 'booked', reason: 'Abdominal ultrasound' },
  { id: 'ap16', patient: 'Yusuf Al-Rashid', kind: 'video', startsAt: at(18, 0, 2), minutes: 15,
    location: 'Video consultation', status: 'booked', reason: 'Sleep study intake' },
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
  { id: 'l7', panel: 'Diabetes Monitoring', analyte: 'HbA1c', value: 7.4, text: null, unit: '%',
    refLow: 4, refHigh: 5.6, abnormal: 'high', observedAt: iso(2026, 1, 12), reportPath: 'hba1c-jan.pdf' },
  { id: 'l8', panel: 'Diabetes Monitoring', analyte: 'HbA1c', value: 7.1, text: null, unit: '%',
    refLow: 4, refHigh: 5.6, abnormal: 'high', observedAt: iso(2026, 4, 14), reportPath: 'hba1c-apr.pdf' },
  { id: 'l9', panel: 'Thyroid Function', analyte: 'TSH', value: 2.1, text: null, unit: 'mIU/L',
    refLow: 0.4, refHigh: 4.2, abnormal: 'normal', observedAt: iso(2026, 4, 28), reportPath: null },
  { id: 'l10', panel: 'Vitamin D', analyte: '25-OH Vitamin D', value: 14, text: null, unit: 'ng/mL',
    refLow: 30, refHigh: 100, abnormal: 'low', observedAt: iso(2026, 5, 6), reportPath: 'vitd-may.pdf' },
  { id: 'l11', panel: 'Lipid Profile', analyte: 'LDL cholesterol', value: 118, text: null, unit: 'mg/dL',
    refLow: 0, refHigh: 100, abnormal: 'high', observedAt: iso(2026, 6, 28), reportPath: 'lipids-jun.pdf' },
  { id: 'l12', panel: 'Iron studies', analyte: 'Ferritin', value: 16, text: null, unit: 'ng/mL',
    refLow: 15, refHigh: 200, abnormal: 'normal', observedAt: iso(2026, 6, 28), reportPath: 'iron-jun.pdf' },
];
