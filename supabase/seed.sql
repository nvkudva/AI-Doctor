-- Demo seed — the same data the frontend shows today
-- (apps/web/src/store/seeds.ts, read but never modified).
--
-- Passwords are never stored in the clear: auth.users.encrypted_password is a
-- bcrypt digest produced by crypt()/gen_salt(). The demo password is in the README.
-- Local development only.

do $$
declare
  h_id        uuid := '0e2c0000-0000-4000-8000-000000000001';
  alex        uuid := 'c1a90000-0000-4000-8000-000000000001';
  sara        uuid := '77b30000-0000-4000-8000-000000000001';
  maria       uuid := 'a0010000-0000-4000-8000-000000000001';
  james       uuid := 'a0020000-0000-4000-8000-000000000002';
  priya       uuid := 'a0030000-0000-4000-8000-000000000003';
  ops         uuid := '0b500000-0000-4000-8000-000000000001';
  pv_cough    uuid := 'b7d00000-0000-4000-8000-000000000001';
  pv_headache uuid := 'b7d00000-0000-4000-8000-000000000002';
  pv_rash     uuid := 'b7d00000-0000-4000-8000-000000000003';
  c1 uuid; c2 uuid; c3 uuid; h1 uuid; h2 uuid;
  d1 uuid; d2 uuid; d3 uuid; dh1 uuid; dh2 uuid;
  rv uuid; rx uuid; hash text;
  pw text := crypt('1234', gen_salt('bf'));
begin
  -- ------------------------------------------------------------------ tenant
  insert into public.hospitals (id, slug, name, logo_url, theme, ai_config, admin_contact_email)
  values (h_id, 'citycare', 'CityCare Hospital', null,
          '{"accent":"#0F6E5C","surface_mode":"auto"}'::jsonb,
          jsonb_build_object(
            'model','claude-opus-5','voice_persona_id','mira-warm-in',
            'quotas', jsonb_build_object('daily_consults',200,'session_minutes_per_consult',12,'max_patient_turns',12),
            'sla', jsonb_build_object('warn_minutes',120,'expire_hours',24,'abandon_minutes',30,
                                      'clinic_hours', jsonb_build_object('tz','Asia/Kolkata','open','09:00','close','20:00'))),
          'ops@citycare.in')
  on conflict (id) do nothing;

  -- ------------------------------------------------------- auth users (5)
  -- GoTrue reads these four as NOT NULL text. Left NULL, every sign-in returns
  -- 500 "Database error querying schema" — the seeded accounts look valid in
  -- SQL and are unusable through the API.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token,
                          email_change, email_change_token_new,
                          created_at, updated_at)
  values
   ('00000000-0000-0000-0000-000000000000', alex,  'authenticated','authenticated','alex.kumar.demo@example.com',      pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Alex Kumar","kind":"patient"}'::jsonb, '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', sara,  'authenticated','authenticated','sara.whitfield.demo@example.com',  pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Sara Whitfield","kind":"clinician"}'::jsonb, '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', maria, 'authenticated','authenticated','maria.gonzalez.demo@example.com',  pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Gonzalez","kind":"patient"}'::jsonb, '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', james, 'authenticated','authenticated','james.okoro.demo@example.com',     pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"James Okoro","kind":"patient"}'::jsonb, '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', priya, 'authenticated','authenticated','priya.sharma.demo@example.com',    pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Sharma","kind":"patient"}'::jsonb, '', '', '', '', now(), now()),
   -- Operator/admin. `kind` is the global nature of the account; the operative
   -- role is the membership below (DATA-MODEL §2.2).
   ('00000000-0000-0000-0000-000000000000', ops,   'authenticated','authenticated','ops.admin.demo@example.com',       pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ops Admin","kind":"operator"}'::jsonb, '', '', '', '', now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id, u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id in (alex, sara, maria, james, priya, ops)
  on conflict do nothing;

  -- ---------------------------------------------------- memberships + details
  insert into public.memberships (profile_id, hospital_id, role) values
    (alex,  h_id, 'patient'), (sara,  h_id, 'doctor'),
    (maria, h_id, 'patient'), (james, h_id, 'patient'), (priya, h_id, 'patient'),
    (ops,   h_id, 'admin')
  on conflict (profile_id, hospital_id) do nothing;

  insert into public.patient_details (profile_id, dob, sex, blood_group, allergies, conditions, medications) values
    -- Multimorbid on purpose: the penicillin allergy and the kidney disease
    -- between them rule out most of what you would reach for first, which is
    -- the whole point of showing a safety panel to a doctor.
    (alex, '1992-03-14', 'male', 'O+',
     '[{"substance":"Penicillin","class":"beta_lactam","severity":"severe","reaction":"rash, swelling","source":"self_reported"}]'::jsonb,
     '[{"name":"IgA nephropathy","since":"2023","status":"active","source":"clinician","note":"Biopsy-proven."},
       {"name":"Chronic kidney disease, stage 3a","since":"2024","status":"active","source":"clinician","note":"eGFR 52. Avoid NSAIDs; review renally cleared doses."},
       {"name":"Asthma","since":"2015","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Ramipril","dose":"5 mg","frequency":"OD","source":"clinician","note":"Renoprotective; check potassium and creatinine after any dose change."},
       {"name":"Beclometasone inhaler","dose":"200 mcg","frequency":"BD","source":"clinician"},
       {"name":"Salbutamol inhaler","dose":"100 mcg","frequency":"PRN","source":"self_reported"}]'::jsonb),
    (maria, '1997-05-02', 'female', 'O-', '[]'::jsonb,
     '[{"name":"Seasonal allergies","status":"active","source":"self_reported"}]'::jsonb, '[]'::jsonb),
    (james, '1985-01-20', 'male', 'B+', '[]'::jsonb,
     '[{"name":"Hypertension","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Amlodipine","dose":"5 mg","frequency":"OD","source":"self_reported"}]'::jsonb),
    (priya, '1990-08-11', 'female', 'A+', '[]'::jsonb,
     '[{"name":"Childhood eczema","status":"resolved","source":"self_reported"}]'::jsonb, '[]'::jsonb)
  on conflict (profile_id) do nothing;

  insert into public.clinician_details (profile_id, registration_no, registration_authority, specialty,
                                        languages, years_experience, prefs)
  values (sara, 'GMC-483920', 'KMC', 'General Physician', array['en','hi','kn'], 12,
          '{"mira_presentation_enabled":true,"queue_sort":"urgency"}'::jsonb)
  on conflict (profile_id) do nothing;

  insert into public.protocol_versions (id, complaint_key, version, content_hash, clinician_owner, approved_at) values
    (pv_cough,    'cough',    '2026.08.1', 'sha256:7bb1cough',    'Dr. S. Whitfield', now() - interval '20 days'),
    (pv_headache, 'headache', '2026.08.1', 'sha256:7bb1headache', 'Dr. S. Whitfield', now() - interval '20 days'),
    (pv_rash,     'rash',     '2026.08.1', 'sha256:7bb1rash',     'Dr. S. Whitfield', now() - interval '20 days')
  on conflict (id) do nothing;

  -- ------------------------------------------------- doctor queue (seeds.ts:6-53)
  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               working_dx, protocol_version_id, created_at, submitted_at, last_patient_turn_at)
  values (h_id, maria, 'pending_review', 'Persistent dry cough, 2 weeks', 'soon',
          '[{"label":"Post-nasal drip","likelihood":0.55}]'::jsonb, pv_cough,
          now() - interval '20 minutes', now() - interval '14 minutes', now() - interval '15 minutes')
  returning id into c1;

  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               working_dx, protocol_version_id, created_at, submitted_at, last_patient_turn_at)
  values (h_id, james, 'pending_review', 'Recurring migraines', 'routine',
          '[{"label":"Migraine without aura","likelihood":0.8}]'::jsonb, pv_headache,
          now() - interval '50 minutes', now() - interval '40 minutes', now() - interval '41 minutes')
  returning id into c2;

  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               working_dx, protocol_version_id, created_at, submitted_at, last_patient_turn_at, decided_at)
  values (h_id, priya, 'pending_review', 'Skin rash on forearms', 'routine',
          '[{"label":"Contact dermatitis","likelihood":0.9}]'::jsonb, pv_rash,
          now() - interval '2 hours', now() - interval '100 minutes', now() - interval '100 minutes', null)
  returning id into c3;

  insert into public.consult_messages (consult_id, sender, channel, content, created_at) values
    (c1, 'patient','voice','I have had a dry cough for about two weeks now, worse at night.', now() - interval '19 minutes'),
    (c1, 'ai',     'voice','Thank you. Has there been any fever or breathlessness with it?',   now() - interval '18 minutes'),
    (c1, 'patient','voice','No fever. Some mild chest tightness, no blood.',                   now() - interval '17 minutes'),
    (c2, 'patient','voice','Throbbing headaches on one side, three times this month.',         now() - interval '49 minutes'),
    (c2, 'ai',     'voice','Do bright lights or sound make it worse?',                         now() - interval '48 minutes'),
    (c2, 'patient','voice','Yes, light especially. I feel sick with it too.',                  now() - interval '47 minutes'),
    (c3, 'patient','text', 'Itchy red rash on both forearms since I changed detergent.',       now() - interval '119 minutes');

  insert into public.consult_slots (consult_id, slot_id, status, value, confidence, source) values
    (c1, 'presenting_complaint','filled','Dry cough, two weeks',0.95,'patient'),
    (c1, 'duration_course',     'filled','About two weeks, constant, slowly worsening',0.86,'patient'),
    (c1, 'severity',            'filled','4/10; disturbs sleep',0.7,'patient'),
    (c1, 'red_flag_screen',     'filled','No haemoptysis, no fever, no weight loss',0.9,'patient'),
    (c1, 'occupational_exposure','unanswered',null,null,'patient'),
    (c2, 'presenting_complaint','filled','Unilateral throbbing headache',0.95,'patient'),
    (c2, 'duration_course',     'filled','Three episodes this month, hours each',0.85,'patient'),
    (c2, 'severity',            'filled','7/10; has to lie down',0.8,'patient'),
    (c2, 'red_flag_screen',     'filled','No thunderclap onset, no neuro deficit, no fever',0.92,'patient'),
    (c3, 'presenting_complaint','filled','Itchy rash both forearms',0.95,'patient'),
    (c3, 'duration_course',     'filled','Three days, since new detergent',0.9,'patient'),
    (c3, 'severity',            'filled','3/10; itch only',0.8,'patient'),
    (c3, 'red_flag_screen',     'filled','No blistering, no fever, no mucosal involvement',0.9,'patient');

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, unanswered_slots, raw_response, model,
                                protocol_version_id, prompt_version)
  values (c1, h_id, 1, 'doctor_agent',
    jsonb_build_object('type','investigation','title','Chest X-ray + trial of antihistamine',
      'summary','Persistent cough; imaging advised.',
      'items', jsonb_build_array(
        jsonb_build_object('name','Chest X-ray (PA view)','dosage','','timing','Within 3 days',
          'notes','Rule out lower respiratory involvement.','why','Because the cough has lasted more than two weeks.',
          'detail','Rule out lower respiratory involvement.'),
        jsonb_build_object('name','Loratadine','dosage','10 mg','timing','Once daily, 7 days',
          'notes','For suspected post-nasal drip.','why','To settle a likely post-nasal drip driving the cough.',
          'detail','7-day trial for suspected post-nasal drip.')),
      'advice','Return sooner if fever, breathlessness or coughing blood appears.','urgency','soon'),
    'Cough over two weeks, imaging advised', 'medium',
    '[{"code":"duration_gt_2w","severity":"warn","text":"Cough >2 weeks — imaging advised.","source":"validator"},
      {"code":"allergy_clear","severity":"info","text":"No class match against 0 recorded allergies.","source":"validator"}]'::jsonb,
    array['occupational_exposure'], '{}'::jsonb, 'claude-opus-5', pv_cough, 'mira-patient-v4')
  returning id into d1;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, unanswered_slots, raw_response, model,
                                protocol_version_id, prompt_version)
  values (c2, h_id, 1, 'doctor_agent',
    jsonb_build_object('type','prescription','title','Acute migraine management',
      'summary','Migraine without aura.',
      'items', jsonb_build_array(
        jsonb_build_object('name','Sumatriptan','dosage','50 mg','timing','At headache onset; repeat after 2h if needed',
          'notes','Max 100 mg per day.','why','A triptan is first-line for acute migraine attacks.',
          'detail','At onset of headache, may repeat after 2h (max 100mg/day).'),
        jsonb_build_object('name','Headache diary','dosage','','timing','Daily, 4 weeks',
          'notes','Track triggers, frequency and duration.','why','To spot triggers and see if preventive therapy is needed.',
          'detail','Track triggers, frequency and duration for 4 weeks.')),
      'advice','Book a follow-up if attacks exceed 4/month for preventive therapy.','urgency','routine'),
    'Recurring unilateral headache', 'high',
    '[{"code":"allergy_clear","severity":"info","text":"No class match against 0 recorded allergies.","source":"validator"},
      {"code":"interaction_check","severity":"warn","text":"Check interaction with Amlodipine.","source":"validator"}]'::jsonb,
    '{}'::text[], '{}'::jsonb, 'claude-opus-5', pv_headache, 'mira-patient-v4')
  returning id into d2;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, unanswered_slots, raw_response, model,
                                protocol_version_id, prompt_version)
  values (c3, h_id, 1, 'doctor_agent',
    jsonb_build_object('type','prescription','title','Contact dermatitis care',
      'summary','Contact dermatitis.',
      'items', jsonb_build_array(
        jsonb_build_object('name','Hydrocortisone 1% cream','dosage','Thin layer','timing','Twice daily, up to 7 days',
          'notes','Apply to affected areas only.','why','A mild topical steroid calms the inflamed skin.',
          'detail','Thin layer twice daily for up to 7 days.'),
        jsonb_build_object('name','Avoid new detergent','dosage','','timing','Ongoing',
          'notes','Switch to fragrance-free; wash affected clothing.','why','Removing the trigger is the main treatment.',
          'detail','Switch to fragrance-free; wash affected clothing.')),
      'advice','Seek care if rash spreads or blisters form.','urgency','routine'),
    'Contact dermatitis, clear trigger', 'high',
    '[{"code":"allergy_clear","severity":"info","text":"No class match against 0 recorded allergies.","source":"validator"}]'::jsonb,
    '{}'::text[], '{}'::jsonb, 'claude-opus-5', pv_rash, 'mira-patient-v4')
  returning id into d3;

  -- seeds.ts:41 shows this one already approved. It becomes approved the only way
  -- the schema allows: an approving review row, then a prescription through the
  -- gate trigger, then a state transition the allowlist permits.
  select content_hash into hash from public.ai_drafts where id = d3;

  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, diff,
                              time_in_consult_ms, idempotency_key)
  values (c3, sara, d3, hash, 'approved', '{}'::jsonb, 84000, 'seed-c3-approve')
  returning id into rv;

  insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id,
                                    kind, advice, edited_from_draft, approved_at)
  values (c3, h_id, priya, sara, rv, 'prescription',
          'Seek care if rash spreads or blisters form.', false, now() - interval '1 hour')
  returning id into rx;

  insert into public.prescription_items (prescription_id, position, name, dosage, timing, notes, why, detail) values
    (rx, 0, 'Hydrocortisone 1% cream', 'Thin layer', 'Twice daily, up to 7 days',
        'Apply to affected areas only.', 'A mild topical steroid calms the inflamed skin.',
        'Thin layer twice daily for up to 7 days.'),
    (rx, 1, 'Avoid new detergent', '', 'Ongoing',
        'Switch to fragrance-free; wash affected clothing.', 'Removing the trigger is the main treatment.',
        'Switch to fragrance-free; wash affected clothing.');

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', sara::text, true);
  update public.consults set status = 'approved', decided_at = now() - interval '1 hour' where id = c3;
  perform set_config('vd.actor', 'system', true);
  perform set_config('vd.actor_id', '', true);

  insert into public.notifications (hospital_id, recipient_id, consult_id, kind, title, body, deep_link)
  values (h_id, priya, c3, 'decision', 'Your prescription is ready',
          'Dr. Whitfield has approved your plan.', '/patient/records/' || c3);

  -- --------------------------------------- Alex Kumar's history (seeds.ts:55-77)
  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               created_at, submitted_at, decided_at, closed_at)
  values (h_id, alex, 'pending_review', 'Seasonal allergy check', 'routine',
          '2026-03-04T09:00:00Z', '2026-03-04T09:20:00Z', null, null)
  returning id into h1;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, raw_response, model, prompt_version)
  values (h1, h_id, 1, 'doctor_agent',
    jsonb_build_object('type','prescription','title','Seasonal allergic rhinitis',
      'summary','Recurrent sneezing, itchy watery eyes and nasal congestion each spring.',
      'items', jsonb_build_array(jsonb_build_object('name','Cetirizine 10mg','dosage','10 mg',
        'timing','Once daily for 14 days','notes','','why','An antihistamine settles seasonal symptoms.',
        'detail','Once daily, 14 days')),
      'advice','Start the antihistamine before symptoms peak, and limit time outdoors when pollen counts are high.',
      'urgency','routine'),
    'Seasonal allergic rhinitis', 'high',
    '[{"code":"allergy_clear","severity":"info","text":"No beta-lactam in this draft; penicillin allergy on file.","source":"validator"}]'::jsonb,
    '{}'::jsonb, 'claude-opus-5', 'mira-patient-v4')
  returning id into dh1;


  select content_hash into hash from public.ai_drafts where id = dh1;
  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key, created_at)
  values (h1, sara, dh1, hash, 'approved', 'seed-h1-approve', now() - interval '5 days') returning id into rv;
  insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice, approved_at)
  values (h1, h_id, alex, sara, rv, 'prescription',
          'Start the antihistamine before symptoms peak.', '2026-03-04T10:00:00Z') returning id into rx;
  insert into public.prescription_items (prescription_id, position, name, dosage, timing, notes, why, detail)
  values (rx, 0, 'Cetirizine 10mg', '10 mg', 'Once daily for 14 days', '',
          'An antihistamine settles seasonal symptoms.', 'Once daily, 14 days');

  -- Closed before the next one opens: consults_one_open allows a patient exactly one
  -- open consult per hospital (PRD §3A.5).
  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', sara::text, true);
  update public.consults set status = 'approved', decided_at = '2026-03-04T10:00:00Z' where id = h1;
  perform set_config('vd.actor', 'system', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults set status = 'communicated' where id = h1;
  update public.consults set status = 'closed', closed_at = '2026-03-05T10:00:00Z' where id = h1;

  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               created_at, submitted_at)
  values (h_id, alex, 'pending_review', 'Lower back pain', 'routine',
          '2026-01-18T09:00:00Z', '2026-01-18T09:20:00Z')
  returning id into h2;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, raw_response, model, prompt_version)
  values (h2, h_id, 1, 'doctor_agent',
    jsonb_build_object('type','prescription','title','Mechanical lower back pain',
      'summary','Dull lower-back ache for about a week after a long drive.',
      'items', jsonb_build_array(jsonb_build_object('name','Stretching routine','dosage','',
        'timing','Twice daily, 2 weeks','notes','','why','Movement is the main treatment for mechanical back pain.',
        'detail','Twice daily, 2 weeks')),
      'advice','Keep moving gently; seek care if pain spreads down the leg or bladder changes appear. No ibuprofen or naproxen — anti-inflammatories are not safe with your kidney function.',
      'urgency','routine'),
    'Mechanical lower back pain', 'high',
    '[{"code":"allergy_clear","severity":"info","text":"No beta-lactam in this draft; penicillin allergy on file.","source":"validator"}]'::jsonb,
    '{}'::jsonb, 'claude-opus-5', 'mira-patient-v4')
  returning id into dh2;
  select content_hash into hash from public.ai_drafts where id = dh2;
  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key, created_at)
  values (h2, sara, dh2, hash, 'approved', 'seed-h2-approve', now() - interval '40 days') returning id into rv;
  insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice, approved_at)
  values (h2, h_id, alex, sara, rv, 'prescription',
          'Keep moving gently; seek care if pain spreads down the leg.', '2026-01-18T10:00:00Z') returning id into rx;
  insert into public.prescription_items (prescription_id, position, name, dosage, timing, notes, why, detail)
  values (rx, 0, 'Stretching routine', '', 'Twice daily, 2 weeks', '',
          'Movement is the main treatment for mechanical back pain.', 'Twice daily, 2 weeks');

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', sara::text, true);
  update public.consults set status = 'approved', decided_at = '2026-01-18T10:00:00Z' where id = h2;
  perform set_config('vd.actor', 'system', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults set status = 'communicated' where id = h2;
  update public.consults set status = 'closed', closed_at = '2026-01-19T10:00:00Z' where id = h2;

  -- ------------------------------------------------ labs, appointment, notices
  insert into public.lab_results (patient_id, hospital_id, panel, analyte, value_num, unit,
                                  ref_low, ref_high, abnormal, observed_at, source) values
    -- Alex's own series is seeded further down, dated relative to now.
    (maria, h_id, 'Complete Blood Count', 'Haemoglobin',        13.1, 'g/dL', 12.0, 15.0, 'normal',   '2026-06-20T00:00:00Z', 'integration'),
    (maria, h_id, 'C-reactive protein',   'CRP',                12.4, 'mg/L',  0.0,  5.0, 'high',     '2026-06-20T00:00:00Z', 'integration'),
    (james, h_id, 'Blood pressure log',   'Systolic (30d avg)', 138.0, 'mmHg', 90.0,130.0,'high',     '2026-06-01T00:00:00Z', 'manual'),
    (james, h_id, 'Blood pressure log',   'Diastolic (30d avg)', 88.0, 'mmHg', 60.0, 85.0,'high',     '2026-06-01T00:00:00Z', 'manual'),
    (priya, h_id, 'Immunology',           'IgE total',         210.0, 'IU/mL', 0.0,100.0, 'high',     '2024-03-01T00:00:00Z', 'upload');

  insert into public.appointments (hospital_id, patient_id, doctor_id, kind, starts_at, duration_minutes, location)
  values (h_id, alex, null, 'imaging', '2026-09-12T05:00:00Z', 15, 'Apollo Diagnostics · Koramangala');

  insert into public.notifications (hospital_id, recipient_id, kind, title, body, deep_link)
  values (h_id, alex, 'appointment', 'Imaging appointment booked',
          'Chest X-ray (PA view) · Fri 12 Sep, 10:30 am · Apollo Diagnostics.', '/patient/records');
end $$;


-- ============================================================================
-- Ten more demo patients, each with a real history.
--
-- Written through the same doors the app uses: a consult becomes a prescription
-- only via an approving review bound to the exact draft hash (§3.4), and every
-- status move goes through the transition allowlist under an explicit actor.
-- Two helpers below exist only to keep that ceremony from being retyped 16 times.
-- ============================================================================

create or replace function pg_temp.seed_closed_case(
  p_hospital uuid, p_patient uuid, p_doctor uuid,
  p_complaint text, p_kind public.plan_kind, p_title text, p_summary text,
  p_items jsonb, p_advice text, p_note text, p_conf public.confidence,
  p_created timestamptz, p_approved timestamptz, p_closed timestamptz, p_key text
) returns uuid language plpgsql as $fn$
declare c uuid; d uuid; r uuid; rx uuid; hash text;
begin
  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               created_at, submitted_at, last_patient_turn_at)
  values (p_hospital, p_patient, 'pending_review', p_complaint, 'routine',
          p_created, p_created + interval '18 minutes', p_created + interval '16 minutes')
  returning id into c;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, raw_response, model, prompt_version)
  values (c, p_hospital, 1, 'doctor_agent',
          jsonb_build_object('type', p_kind::text, 'title', p_title, 'summary', p_summary,
                             'items', p_items, 'advice', p_advice, 'urgency', 'routine'),
          p_note, p_conf, '[]'::jsonb, '{}'::jsonb, 'claude-opus-5', 'mira-patient-v4')
  returning id into d;

  select content_hash into hash from public.ai_drafts where id = d;
  -- created_at is the decision time, not the moment the seed ran: everything
  -- that ages off a review (history, the day-3 check-in) reads this column.
  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key, created_at)
  values (c, p_doctor, d, hash, 'approved', p_key, p_approved) returning id into r;

  insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id,
                                    kind, advice, approved_at)
  values (c, p_hospital, p_patient, p_doctor, r, p_kind, p_advice, p_approved) returning id into rx;

  insert into public.prescription_items (prescription_id, position, name, dosage, timing, notes, why, detail)
  select rx, (ord - 1)::int, it->>'name', coalesce(it->>'dosage',''), it->>'timing',
         coalesce(it->>'notes',''), coalesce(it->>'why',''), coalesce(it->>'detail','')
    from jsonb_array_elements(p_items) with ordinality as t(it, ord);

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', p_doctor::text, true);
  update public.consults set status = 'approved', decided_at = p_approved where id = c;
  perform set_config('vd.actor', 'system', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults set status = 'communicated' where id = c;
  update public.consults set status = 'closed', closed_at = p_closed where id = c;
  return c;
end $fn$;

create or replace function pg_temp.seed_pending_case(
  p_hospital uuid, p_patient uuid,
  p_complaint text, p_urgency public.urgency, p_dx jsonb, p_protocol uuid,
  p_kind public.plan_kind, p_title text, p_summary text,
  p_items jsonb, p_advice text, p_note text, p_conf public.confidence,
  p_flags jsonb, p_waited interval, p_turns jsonb, p_slots jsonb
) returns uuid language plpgsql as $fn$
declare c uuid;
begin
  insert into public.consults (hospital_id, patient_id, status, chief_complaint, urgency,
                               working_dx, protocol_version_id,
                               created_at, submitted_at, last_patient_turn_at)
  values (p_hospital, p_patient, 'pending_review', p_complaint, p_urgency, p_dx, p_protocol,
          now() - p_waited - interval '6 minutes', now() - p_waited, now() - p_waited - interval '1 minute')
  returning id into c;

  insert into public.consult_messages (consult_id, sender, channel, content, created_at)
  select c, (it->>'sender')::public.message_sender, 'voice', it->>'text',
         now() - p_waited - interval '6 minutes' + (ord * interval '1 minute')
    from jsonb_array_elements(p_turns) with ordinality as t(it, ord);

  insert into public.consult_slots (consult_id, slot_id, status, value, confidence, source)
  select c, (it->>'slot')::public.slot_id, 'filled', it->>'value', (it->>'conf')::numeric, 'patient'
    from jsonb_array_elements(p_slots) as t(it);

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, raw_response, model, protocol_version_id, prompt_version)
  values (c, p_hospital, 1, 'doctor_agent',
          jsonb_build_object('type', p_kind::text, 'title', p_title, 'summary', p_summary,
                             'items', p_items, 'advice', p_advice, 'urgency', p_urgency::text),
          p_note, p_conf, p_flags, '{}'::jsonb, 'claude-opus-5', p_protocol, 'mira-patient-v4');
  return c;
end $fn$;

do $$
declare
  h_id  uuid := '0e2c0000-0000-4000-8000-000000000001';
  sara  uuid := '77b30000-0000-4000-8000-000000000001';
  pv_cough    uuid := 'b7d00000-0000-4000-8000-000000000001';
  pv_headache uuid := 'b7d00000-0000-4000-8000-000000000002';
  pv_rash     uuid := 'b7d00000-0000-4000-8000-000000000003';

  ravi   uuid := 'a0040000-0000-4000-8000-000000000004';
  fatima uuid := 'a0050000-0000-4000-8000-000000000005';
  daniel uuid := 'a0060000-0000-4000-8000-000000000006';
  ling   uuid := 'a0070000-0000-4000-8000-000000000007';
  aarav  uuid := 'a0080000-0000-4000-8000-000000000008';
  sofia  uuid := 'a0090000-0000-4000-8000-000000000009';
  thabo  uuid := 'a00a0000-0000-4000-8000-00000000000a';
  emily  uuid := 'a00b0000-0000-4000-8000-00000000000b';
  omar   uuid := 'a00c0000-0000-4000-8000-00000000000c';
  grace  uuid := 'a00d0000-0000-4000-8000-00000000000d';

  pw text := crypt('1234', gen_salt('bf'));
  ignore uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change, email_change_token_new,
                          created_at, updated_at)
  values
   ('00000000-0000-0000-0000-000000000000', ravi,   'authenticated','authenticated','ravi.deshpande.demo@example.com', pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ravi Deshpande","kind":"patient"}'::jsonb, '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', fatima, 'authenticated','authenticated','fatima.sheikh.demo@example.com',   pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Fatima Sheikh","kind":"patient"}'::jsonb,  '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', daniel, 'authenticated','authenticated','daniel.okafor.demo@example.com',   pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Daniel Okafor","kind":"patient"}'::jsonb,  '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', ling,   'authenticated','authenticated','ling.chen.demo@example.com',       pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ling Wei Chen","kind":"patient"}'::jsonb,  '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', aarav,  'authenticated','authenticated','aarav.nair.demo@example.com',      pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Aarav Nair","kind":"patient"}'::jsonb,     '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', sofia,  'authenticated','authenticated','sofia.rossi.demo@example.com',     pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sofia Rossi","kind":"patient"}'::jsonb,    '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', thabo,  'authenticated','authenticated','thabo.molefe.demo@example.com',    pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Thabo Molefe","kind":"patient"}'::jsonb,   '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', emily,  'authenticated','authenticated','emily.watson.demo@example.com',    pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Emily Watson","kind":"patient"}'::jsonb,   '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', omar,   'authenticated','authenticated','omar.haddad.demo@example.com',     pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Omar Haddad","kind":"patient"}'::jsonb,    '', '', '', '', now(), now()),
   ('00000000-0000-0000-0000-000000000000', grace,  'authenticated','authenticated','grace.mensah.demo@example.com',    pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Grace Mensah","kind":"patient"}'::jsonb,   '', '', '', '', now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id, u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id in (ravi, fatima, daniel, ling, aarav, sofia, thabo, emily, omar, grace)
  on conflict do nothing;

  insert into public.memberships (profile_id, hospital_id, role)
  select p, h_id, 'patient'
    from unnest(array[ravi, fatima, daniel, ling, aarav, sofia, thabo, emily, omar, grace]) as p
  on conflict (profile_id, hospital_id) do nothing;

  -- ------------------------------------------------------------ health profiles
  insert into public.patient_details (profile_id, dob, sex, blood_group, allergies, conditions, medications) values
    (ravi, '1968-11-02', 'male', 'B+', '[]'::jsonb,
     '[{"name":"Type 2 diabetes","since":"2014","status":"active","source":"self_reported"},
       {"name":"Hyperlipidaemia","since":"2019","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Metformin","dose":"1000 mg","frequency":"BD","source":"self_reported"},
       {"name":"Atorvastatin","dose":"20 mg","frequency":"OD","source":"self_reported"}]'::jsonb),

    (fatima, '1994-06-25', 'female', 'A-',
     '[{"substance":"Sulfamethoxazole","class":"sulfonamide","severity":"moderate","reaction":"urticaria","source":"self_reported"}]'::jsonb,
     '[{"name":"Migraine with aura","since":"2016","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Propranolol","dose":"40 mg","frequency":"BD","source":"self_reported"}]'::jsonb),

    (daniel, '2001-02-17', 'male', 'O+',
     '[{"substance":"Ibuprofen","class":"nsaid","severity":"moderate","reaction":"wheeze","source":"self_reported"}]'::jsonb,
     '[{"name":"Asthma","since":"2009","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Beclometasone inhaler","dose":"200 mcg","frequency":"BD","source":"self_reported"},
       {"name":"Salbutamol inhaler","dose":"100 mcg","frequency":"PRN","source":"self_reported"}]'::jsonb),

    (ling, '1979-09-30', 'female', 'AB+', '[]'::jsonb,
     '[{"name":"Hypothyroidism","since":"2018","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Levothyroxine","dose":"75 mcg","frequency":"OD","source":"self_reported"}]'::jsonb),

    (aarav, '1988-04-08', 'male', 'O+', '[]'::jsonb,
     '[{"name":"Gastro-oesophageal reflux","since":"2022","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Pantoprazole","dose":"40 mg","frequency":"OD","source":"self_reported"}]'::jsonb),

    (sofia, '1963-12-12', 'female', 'A+', '[]'::jsonb,
     '[{"name":"Osteoarthritis, both knees","since":"2020","status":"active","source":"self_reported"},
       {"name":"Hypertension","since":"2017","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Ramipril","dose":"5 mg","frequency":"OD","source":"self_reported"},
       {"name":"Paracetamol","dose":"1 g","frequency":"PRN","source":"self_reported"}]'::jsonb),

    (thabo, '1996-07-19', 'male', 'B-', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),

    (emily, '1990-01-05', 'female', 'O-', '[]'::jsonb,
     '[{"name":"Iron-deficiency anaemia","since":"2025","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Ferrous fumarate","dose":"210 mg","frequency":"BD","source":"self_reported"}]'::jsonb),

    (omar, '1975-03-22', 'male', 'A+',
     '[{"substance":"Codeine","class":"opioid","severity":"moderate","reaction":"vomiting","source":"self_reported"}]'::jsonb,
     '[{"name":"Chronic lower back pain","since":"2021","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Naproxen","dose":"250 mg","frequency":"PRN","source":"self_reported"}]'::jsonb),

    (grace, '1983-10-14', 'female', 'AB-', '[]'::jsonb,
     '[{"name":"Atopic eczema","since":"1998","status":"active","source":"self_reported"},
       {"name":"Allergic rhinitis","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Emollient cream","dose":"","frequency":"PRN","source":"self_reported"}]'::jsonb)
  on conflict (profile_id) do nothing;
end $$;

do $$
declare
  h_id  uuid := '0e2c0000-0000-4000-8000-000000000001';
  sara  uuid := '77b30000-0000-4000-8000-000000000001';
  pv_cough    uuid := 'b7d00000-0000-4000-8000-000000000001';
  pv_headache uuid := 'b7d00000-0000-4000-8000-000000000002';
  pv_rash     uuid := 'b7d00000-0000-4000-8000-000000000003';

  ravi   uuid := 'a0040000-0000-4000-8000-000000000004';
  fatima uuid := 'a0050000-0000-4000-8000-000000000005';
  daniel uuid := 'a0060000-0000-4000-8000-000000000006';
  ling   uuid := 'a0070000-0000-4000-8000-000000000007';
  aarav  uuid := 'a0080000-0000-4000-8000-000000000008';
  sofia  uuid := 'a0090000-0000-4000-8000-000000000009';
  thabo  uuid := 'a00a0000-0000-4000-8000-00000000000a';
  emily  uuid := 'a00b0000-0000-4000-8000-00000000000b';
  omar   uuid := 'a00c0000-0000-4000-8000-00000000000c';
  grace  uuid := 'a00d0000-0000-4000-8000-00000000000d';
  x uuid;
begin
  -- ------------------------------------------------------------- Ravi Deshpande
  x := pg_temp.seed_closed_case(h_id, ravi, sara,
    'Numbness in both feet, months', 'investigation',
    'Diabetic foot and control review',
    'Long-standing type 2 diabetes with new bilateral foot numbness — screening for peripheral neuropathy.',
    '[{"name":"HbA1c","timing":"Within 1 week","why":"Numbness with diabetes usually tracks long-term control.","detail":"Fasting not required."},
      {"name":"Monofilament foot examination","timing":"At the diabetes clinic","why":"Confirms whether protective sensation is lost.","detail":"Book with the nurse-led foot clinic."}]'::jsonb,
    'Inspect both feet daily and report any ulcer or colour change the same day.',
    'Peripheral neuropathy screen', 'high',
    '2025-11-12T09:00:00Z', '2025-11-12T10:10:00Z', '2025-11-14T10:00:00Z', 'seed-ravi-1');

  x := pg_temp.seed_closed_case(h_id, ravi, sara,
    'Statin review before annual check', 'prescription',
    'Lipid control — continue statin',
    'LDL still above target on atorvastatin 20 mg; dose stepped up before the annual review.',
    '[{"name":"Atorvastatin","dosage":"40 mg","timing":"Once daily, at night","notes":"Report unexplained muscle pain.","why":"LDL remains above target at the current dose.","detail":"Step up from 20 mg to 40 mg."},
      {"name":"Fasting lipid profile","dosage":"","timing":"In 12 weeks","notes":"","why":"To confirm the higher dose has worked.","detail":"Repeat before the annual review."}]'::jsonb,
    'Keep taking metformin as before; book the repeat lipids for twelve weeks time.',
    'Statin uptitration', 'high',
    '2026-04-03T09:00:00Z', '2026-04-03T10:20:00Z', '2026-04-04T10:00:00Z', 'seed-ravi-2');

  -- --------------------------------------------------------------- Fatima Sheikh
  x := pg_temp.seed_closed_case(h_id, fatima, sara,
    'Migraines becoming more frequent', 'prescription',
    'Migraine prophylaxis review',
    'Five attacks a month with aura, above the threshold for preventive treatment.',
    '[{"name":"Propranolol","dosage":"40 mg","timing":"Twice daily","notes":"Not to be stopped abruptly.","why":"First-line prevention once attacks exceed four a month.","detail":"Review effect after 8 weeks."},
      {"name":"Headache diary","dosage":"","timing":"Daily, 8 weeks","notes":"Record aura, duration and triggers.","why":"To measure whether prevention is working.","detail":"Bring the diary to the next review."}]'::jsonb,
    'Seek urgent care for a sudden severe headache unlike your usual ones.',
    'Migraine with aura, preventive start', 'high',
    '2026-02-20T09:00:00Z', '2026-02-20T10:05:00Z', '2026-02-21T10:00:00Z', 'seed-fatima-1');

  -- --------------------------------------------------------------- Daniel Okafor
  x := pg_temp.seed_closed_case(h_id, daniel, sara,
    'Using the blue inhaler most days', 'prescription',
    'Asthma control and inhaler technique',
    'Reliever use most days indicates poor control rather than a need for a stronger reliever.',
    '[{"name":"Beclometasone inhaler","dosage":"200 mcg","timing":"Twice daily, every day","notes":"Rinse the mouth after each dose.","why":"Daily reliever use means the preventer is being missed, not that the reliever is failing.","detail":"Take it even on good days."},
      {"name":"Spacer device","dosage":"","timing":"With every inhaler dose","notes":"Wash weekly in warm soapy water, air dry.","why":"More of the dose reaches the lungs and less the throat.","detail":"Issued at the pharmacy."}]'::jsonb,
    'Avoid ibuprofen and other NSAIDs — they have triggered wheeze for you before.',
    'Asthma, preventer adherence', 'high',
    '2026-05-15T09:00:00Z', '2026-05-15T10:15:00Z', '2026-05-16T10:00:00Z', 'seed-daniel-1');

  -- --------------------------------------------------------------- Ling Wei Chen
  x := pg_temp.seed_closed_case(h_id, ling, sara,
    'Tired all the time, feeling cold', 'investigation',
    'Thyroid function recheck',
    'Fatigue and cold intolerance on a stable levothyroxine dose — function needs rechecking.',
    '[{"name":"TSH and free T4","timing":"Within 1 week","why":"Symptoms suggest the current dose is now too low.","detail":"Take the sample before the morning dose."}]'::jsonb,
    'Keep taking levothyroxine as usual until the result is back.',
    'Hypothyroidism, possible under-replacement', 'high',
    '2026-01-30T09:00:00Z', '2026-01-30T10:10:00Z', '2026-01-31T10:00:00Z', 'seed-ling-1');

  x := pg_temp.seed_closed_case(h_id, ling, sara,
    'Thyroid result follow-up', 'prescription',
    'Levothyroxine dose increase',
    'TSH 7.8 mIU/L on 75 mcg; dose increased and a recheck booked.',
    '[{"name":"Levothyroxine","dosage":"100 mcg","timing":"Once daily, before breakfast","notes":"Separate from iron or calcium by four hours.","why":"TSH above range means the current dose is too low.","detail":"Up from 75 mcg."},
      {"name":"TSH recheck","dosage":"","timing":"In 8 weeks","notes":"","why":"Thyroid levels take about six weeks to settle after a change.","detail":"Book before leaving the clinic."}]'::jsonb,
    'Tell us if you develop palpitations or feel persistently hot and anxious.',
    'Hypothyroidism, dose adjusted', 'high',
    '2026-06-10T09:00:00Z', '2026-06-10T10:20:00Z', '2026-06-11T10:00:00Z', 'seed-ling-2');

  -- ------------------------------------------------------------------ Aarav Nair
  x := pg_temp.seed_closed_case(h_id, aarav, sara,
    'Burning chest at night, several weeks', 'prescription',
    'Reflux — night-time symptom control',
    'Night-time reflux despite a daily proton pump inhibitor taken after food.',
    '[{"name":"Pantoprazole","dosage":"40 mg","timing":"Once daily, 30 minutes before breakfast","notes":"Timing matters more than the dose here.","why":"A PPI works best taken before the first meal, not after it.","detail":"Move the existing dose earlier."},
      {"name":"Raise the head of the bed","dosage":"","timing":"Nightly","notes":"Blocks under the bed legs, not extra pillows.","why":"Gravity keeps acid down overnight.","detail":"About 15 cm is enough."}]'::jsonb,
    'Come back sooner if swallowing becomes difficult or painful, or if you lose weight without trying.',
    'GORD, optimise PPI timing', 'high',
    '2026-03-22T09:00:00Z', '2026-03-22T10:05:00Z', '2026-03-23T10:00:00Z', 'seed-aarav-1');

  -- ----------------------------------------------------------------- Sofia Rossi
  x := pg_temp.seed_closed_case(h_id, sofia, sara,
    'Both knees ache going up stairs', 'prescription',
    'Knee osteoarthritis — first-line care',
    'Bilateral knee pain on stairs, no locking or giving way; managed without imaging.',
    '[{"name":"Paracetamol","dosage":"1 g","timing":"Up to four times daily as needed","notes":"Do not exceed 4 g in 24 hours.","why":"Safest first-line pain relief alongside your blood pressure treatment.","detail":"Regular dosing works better than waiting for pain."},
      {"name":"Quadriceps strengthening","dosage":"","timing":"Daily, 12 weeks","notes":"Physiotherapy leaflet issued.","why":"Stronger thigh muscles reduce knee pain more reliably than medication.","detail":"Ten minutes a day."}]'::jsonb,
    'Avoid anti-inflammatory tablets while you are on ramipril unless we agree it first.',
    'Knee osteoarthritis', 'high',
    '2025-12-05T09:00:00Z', '2025-12-05T10:10:00Z', '2025-12-06T10:00:00Z', 'seed-sofia-1');

  x := pg_temp.seed_closed_case(h_id, sofia, sara,
    'Blood pressure check', 'investigation',
    'Home blood pressure confirmation',
    'Clinic readings around 150/90 on ramipril; home readings needed before any change.',
    '[{"name":"Home blood pressure log","timing":"Twice daily, 7 days","why":"Clinic readings run high; home readings decide whether the dose changes.","detail":"Morning and evening, seated, after five minutes rest."}]'::jsonb,
    'Bring the log to the next review before any dose change is made.',
    'Hypertension, home readings requested', 'medium',
    '2026-05-02T09:00:00Z', '2026-05-02T10:15:00Z', '2026-05-03T10:00:00Z', 'seed-sofia-2');

  -- ---------------------------------------------------------------- Thabo Molefe
  x := pg_temp.seed_closed_case(h_id, thabo, sara,
    'Twisted ankle playing football', 'prescription',
    'Lateral ankle sprain',
    'Inversion injury, able to weight-bear, no bony tenderness — no X-ray indicated.',
    '[{"name":"Naproxen","dosage":"250 mg","timing":"Twice daily with food, 5 days","notes":"Stop if stomach pain develops.","why":"Reduces swelling in the first days after a sprain.","detail":"Short course only."},
      {"name":"Ice, elevation and early movement","dosage":"","timing":"First 48 hours, then walk on it","notes":"","why":"Early gentle loading heals a sprain faster than rest.","detail":"20 minutes of ice, three times a day."}]'::jsonb,
    'Return if you cannot put weight on it after three days, or if the foot becomes numb.',
    'Ankle sprain, grade I', 'high',
    '2026-04-18T09:00:00Z', '2026-04-18T09:50:00Z', '2026-04-19T10:00:00Z', 'seed-thabo-1');

  -- ---------------------------------------------------------------- Emily Watson
  x := pg_temp.seed_closed_case(h_id, emily, sara,
    'Breathless climbing the stairs', 'investigation',
    'Anaemia screen',
    'New exertional breathlessness with heavy periods — anaemia is the first thing to exclude.',
    '[{"name":"Full blood count","timing":"Within 3 days","why":"Breathlessness on exertion with heavy periods points to anaemia.","detail":"No preparation needed."},
      {"name":"Serum ferritin","timing":"Same sample","why":"Separates iron deficiency from other causes of a low count.","detail":"Taken from the same blood draw."}]'::jsonb,
    'Seek urgent care for chest pain, fainting, or breathlessness at rest.',
    'Suspected iron-deficiency anaemia', 'high',
    '2026-02-14T09:00:00Z', '2026-02-14T10:05:00Z', '2026-02-15T10:00:00Z', 'seed-emily-1');

  x := pg_temp.seed_closed_case(h_id, emily, sara,
    'Iron tablets follow-up', 'prescription',
    'Iron replacement — continue and recheck',
    'Haemoglobin recovered to 12.6 g/dL; ferritin still low, so treatment continues.',
    '[{"name":"Ferrous fumarate","dosage":"210 mg","timing":"Twice daily, 3 more months","notes":"Take with orange juice, not tea.","why":"Stores take about three months to refill after the count recovers.","detail":"Continue past the point you feel better."},
      {"name":"Ferritin recheck","dosage":"","timing":"In 3 months","notes":"","why":"Confirms the stores are full before stopping.","detail":"Book at the end of the course."}]'::jsonb,
    'Dark stools are expected on iron; black tarry stools with pain are not — seek care.',
    'Iron-deficiency anaemia, responding', 'high',
    '2026-07-01T09:00:00Z', '2026-07-01T10:10:00Z', '2026-07-02T10:00:00Z', 'seed-emily-2');

  -- ----------------------------------------------------------------- Omar Haddad
  x := pg_temp.seed_closed_case(h_id, omar, sara,
    'Back pain after lifting at work', 'prescription',
    'Mechanical back pain — activity and physiotherapy',
    'Lumbar strain after lifting, no red flags, no leg symptoms at the time.',
    '[{"name":"Naproxen","dosage":"250 mg","timing":"Twice daily with food, 7 days","notes":"Avoid codeine — it has made you vomit before.","why":"A short anti-inflammatory course helps you keep moving.","detail":"Take with food."},
      {"name":"Physiotherapy referral","dosage":"","timing":"Within 3 weeks","notes":"","why":"Guided movement prevents this becoming long-term pain.","detail":"The clinic will call to book."}]'::jsonb,
    'Seek urgent care for numbness between the legs or loss of bladder control.',
    'Mechanical lumbar strain', 'high',
    '2025-10-09T09:00:00Z', '2025-10-09T10:15:00Z', '2025-10-10T10:00:00Z', 'seed-omar-1');

  -- ---------------------------------------------------------------- Grace Mensah
  x := pg_temp.seed_closed_case(h_id, grace, sara,
    'Eczema flare on both hands', 'prescription',
    'Atopic eczema flare',
    'Dry cracked hands after a winter of frequent hand washing.',
    '[{"name":"Betamethasone valerate 0.1% ointment","dosage":"Thin layer","timing":"Once daily, up to 14 days","notes":"Hands only; stop once the skin is smooth.","why":"A moderate steroid settles a flare faster than emollient alone.","detail":"Fingertip unit per hand."},
      {"name":"Emollient","dosage":"Generous","timing":"At least four times daily, ongoing","notes":"Continue after the flare settles.","why":"Emollient prevents the next flare; the steroid only treats this one.","detail":"Apply after every hand wash."}]'::jsonb,
    'Seek care if the skin becomes hot, weeping or crusted — that suggests infection.',
    'Atopic eczema, hand flare', 'high',
    '2026-01-25T09:00:00Z', '2026-01-25T10:10:00Z', '2026-01-26T10:00:00Z', 'seed-grace-1');

  x := pg_temp.seed_closed_case(h_id, grace, sara,
    'Sneezing and itchy eyes every morning', 'prescription',
    'Allergic rhinitis',
    'Seasonal sneezing, nasal itch and watery eyes, worse on waking.',
    '[{"name":"Fexofenadine","dosage":"180 mg","timing":"Once daily in the morning, 8 weeks","notes":"Non-sedating.","why":"Blocks the histamine driving the sneezing and itch.","detail":"Through the pollen season."},
      {"name":"Fluticasone nasal spray","dosage":"2 sprays each nostril","timing":"Once daily","notes":"Aim away from the septum.","why":"A nasal steroid controls congestion better than tablets alone.","detail":"Takes about a week to reach full effect."}]'::jsonb,
    'Keep windows shut in the early morning when pollen counts peak.',
    'Allergic rhinitis', 'high',
    '2026-06-08T09:00:00Z', '2026-06-08T10:05:00Z', '2026-06-09T10:00:00Z', 'seed-grace-2');
end $$;

do $$
declare
  h_id  uuid := '0e2c0000-0000-4000-8000-000000000001';
  sara  uuid := '77b30000-0000-4000-8000-000000000001';
  pv_cough    uuid := 'b7d00000-0000-4000-8000-000000000001';
  pv_headache uuid := 'b7d00000-0000-4000-8000-000000000002';

  alex   uuid := 'c1a90000-0000-4000-8000-000000000001';
  maria  uuid := 'a0010000-0000-4000-8000-000000000001';
  james  uuid := 'a0020000-0000-4000-8000-000000000002';
  priya  uuid := 'a0030000-0000-4000-8000-000000000003';
  ravi   uuid := 'a0040000-0000-4000-8000-000000000004';
  fatima uuid := 'a0050000-0000-4000-8000-000000000005';
  daniel uuid := 'a0060000-0000-4000-8000-000000000006';
  ling   uuid := 'a0070000-0000-4000-8000-000000000007';
  aarav  uuid := 'a0080000-0000-4000-8000-000000000008';
  sofia  uuid := 'a0090000-0000-4000-8000-000000000009';
  thabo  uuid := 'a00a0000-0000-4000-8000-00000000000a';
  emily  uuid := 'a00b0000-0000-4000-8000-00000000000b';
  omar   uuid := 'a00c0000-0000-4000-8000-00000000000c';
  grace  uuid := 'a00d0000-0000-4000-8000-00000000000d';
  today  timestamptz;
  x uuid;
begin
  -- ------------------------------------------------- four more waiting for review
  x := pg_temp.seed_pending_case(h_id, omar,
    'Back pain flare, now down the left leg', 'urgent',
    '[{"label":"Lumbar radiculopathy","likelihood":0.7}]'::jsonb, null,
    'investigation', 'Sciatica — same-day assessment',
    'Known chronic back pain, now with pain radiating below the knee and calf weakness.',
    '[{"name":"Same-day clinical examination","timing":"Today","why":"New leg weakness with back pain needs a nerve examination before anything else.","detail":"Straight-leg raise and power testing."},
      {"name":"Hold naproxen until reviewed","timing":"Today","why":"Pain relief could mask a worsening deficit.","detail":"Paracetamol is fine meanwhile."}]'::jsonb,
    'Go to emergency care immediately for numbness between the legs or bladder trouble.',
    'Radicular pain with weakness', 'medium',
    '[{"code":"red_flag","severity":"warn","text":"New motor weakness reported — clinician review same day.","source":"validator"},
      {"code":"allergy_class","severity":"warn","text":"Codeine allergy on file — opioid analgesia avoided.","source":"validator"}]'::jsonb,
    interval '9 minutes',
    '[{"sender":"patient","text":"My back went again on Saturday and now the pain shoots down my left leg."},
      {"sender":"ai","text":"Thank you for telling me. Is there any weakness in that leg, or numbness?"},
      {"sender":"patient","text":"It feels weaker going up stairs. No numbness between my legs, and no bladder problems."}]'::jsonb,
    '[{"slot":"presenting_complaint","value":"Back pain radiating down the left leg","conf":0.95},
      {"slot":"duration_course","value":"Three days, worsening","conf":0.9},
      {"slot":"severity","value":"8/10; disturbs sleep","conf":0.85},
      {"slot":"red_flag_screen","value":"Leg weakness present; no saddle anaesthesia, no bladder change","conf":0.9}]'::jsonb);

  x := pg_temp.seed_pending_case(h_id, daniel,
    'Wheezing after football, twice this week', 'soon',
    '[{"label":"Exercise-induced asthma, poor control","likelihood":0.75}]'::jsonb, null,
    'prescription', 'Asthma control review',
    'Reliever needed after exercise twice this week despite a daily preventer.',
    '[{"name":"Salbutamol inhaler","dosage":"100 mcg, 2 puffs","timing":"15 minutes before exercise","notes":"Through the spacer.","why":"Pre-treatment prevents exercise-triggered narrowing.","detail":"In addition to the daily preventer."},
      {"name":"Peak flow diary","dosage":"","timing":"Morning and evening, 2 weeks","notes":"Record best of three.","why":"Shows whether control is slipping generally or only with exercise.","detail":"Bring to the review."}]'::jsonb,
    'Seek urgent care if the reliever stops working or you cannot finish a sentence.',
    'Exercise-induced symptoms on preventer', 'high',
    '[{"code":"allergy_class","severity":"info","text":"NSAID allergy on file — none in this draft.","source":"validator"}]'::jsonb,
    interval '26 minutes',
    '[{"sender":"patient","text":"I keep wheezing near the end of football, twice this week now."},
      {"sender":"ai","text":"Are you taking the brown preventer inhaler every day, even on days you feel well?"},
      {"sender":"patient","text":"Most days, yes. The blue one sorts it out within a few minutes."}]'::jsonb,
    '[{"slot":"presenting_complaint","value":"Wheeze with exercise","conf":0.95},
      {"slot":"duration_course","value":"Two episodes this week","conf":0.9},
      {"slot":"severity","value":"5/10; settles with reliever","conf":0.8},
      {"slot":"red_flag_screen","value":"No night waking, no speech difficulty, reliever effective","conf":0.9}]'::jsonb);

  x := pg_temp.seed_pending_case(h_id, fatima,
    'Aura lasting longer than usual', 'soon',
    '[{"label":"Migraine with prolonged aura","likelihood":0.65}]'::jsonb, pv_headache,
    'investigation', 'Prolonged aura — clinician review',
    'Visual aura lasting about 90 minutes, well beyond her usual 20, on propranolol prophylaxis.',
    '[{"name":"Clinician review before next dose","timing":"Within 24 hours","why":"An aura this long changes what is safe to prescribe.","detail":"Neurological examination."},
      {"name":"Avoid triptans until reviewed","timing":"Now","why":"Prolonged aura needs assessment before a triptan is given.","detail":"Paracetamol may be used meanwhile."}]'::jsonb,
    'Seek emergency care for weakness on one side, slurred speech or a sudden worst-ever headache.',
    'Aura outside her usual pattern', 'medium',
    '[{"code":"pattern_change","severity":"warn","text":"Aura duration well outside the patient baseline.","source":"validator"},
      {"code":"allergy_class","severity":"info","text":"Sulfonamide allergy on file — none in this draft.","source":"validator"}]'::jsonb,
    interval '54 minutes',
    '[{"sender":"patient","text":"The zigzag lights lasted well over an hour this time. They are usually gone in twenty minutes."},
      {"sender":"ai","text":"Did any weakness, numbness or difficulty speaking come with it?"},
      {"sender":"patient","text":"No, just the lights and then the headache. But it frightened me."}]'::jsonb,
    '[{"slot":"presenting_complaint","value":"Visual aura, prolonged","conf":0.95},
      {"slot":"duration_course","value":"About 90 minutes, once, today","conf":0.9},
      {"slot":"severity","value":"6/10 headache after the aura","conf":0.8},
      {"slot":"red_flag_screen","value":"No focal weakness, no speech change, no thunderclap onset","conf":0.92}]'::jsonb);

  x := pg_temp.seed_pending_case(h_id, thabo,
    'Sore throat, four days', 'routine',
    '[{"label":"Viral pharyngitis","likelihood":0.8}]'::jsonb, pv_cough,
    'prescription', 'Sore throat — supportive care',
    'Four days of sore throat with a cough and no fever; a viral pattern rather than a bacterial one.',
    '[{"name":"Paracetamol","dosage":"1 g","timing":"Up to four times daily as needed","notes":"Maximum 4 g in 24 hours.","why":"Pain relief is the treatment; antibiotics do not shorten a viral sore throat.","detail":"Regular dosing for the first two days."},
      {"name":"Salt-water gargle","dosage":"","timing":"Three times daily","notes":"Half a teaspoon in warm water.","why":"Eases the rawness while the infection clears.","detail":"Do not swallow."}]'::jsonb,
    'Come back if you cannot swallow fluids, the voice muffles, or a fever starts.',
    'Viral pharyngitis, no antibiotic', 'high',
    '[{"code":"antibiotic_stewardship","severity":"info","text":"Centor 1 — no antibiotic indicated.","source":"validator"}]'::jsonb,
    interval '2 hours 5 minutes',
    '[{"sender":"patient","text":"Sore throat since Tuesday, and a bit of a cough with it."},
      {"sender":"ai","text":"Any fever, or white patches at the back of the throat?"},
      {"sender":"patient","text":"No fever. I had a look and it just seems red."}]'::jsonb,
    '[{"slot":"presenting_complaint","value":"Sore throat with cough","conf":0.95},
      {"slot":"duration_course","value":"Four days, steady","conf":0.9},
      {"slot":"severity","value":"4/10; swallowing fine","conf":0.85},
      {"slot":"red_flag_screen","value":"No fever, no drooling, no voice change, no neck swelling","conf":0.9}]'::jsonb);

  -- ------------------------------------------------------------------- more labs
  insert into public.lab_results (patient_id, hospital_id, panel, analyte, value_num, unit,
                                  ref_low, ref_high, abnormal, observed_at, source) values
    (ravi,  h_id, 'Diabetes panel',       'HbA1c',            8.1, '%',      4.0,  6.0, 'high',   '2025-11-15T00:00:00Z', 'integration'),
    (ravi,  h_id, 'Lipid Profile',        'LDL cholesterol', 148.0, 'mg/dL',  0.0,100.0, 'high',   '2026-04-01T00:00:00Z', 'integration'),
    (ling,  h_id, 'Thyroid function',     'TSH',              7.8, 'mIU/L',  0.4,  4.0, 'high',   '2026-02-04T00:00:00Z', 'integration'),
    (ling,  h_id, 'Thyroid function',     'Free T4',         11.2, 'pmol/L', 9.0, 19.0, 'normal', '2026-02-04T00:00:00Z', 'integration'),
    (emily, h_id, 'Complete Blood Count', 'Haemoglobin',     10.2, 'g/dL',  12.0, 15.0, 'low',    '2026-02-17T00:00:00Z', 'integration'),
    (emily, h_id, 'Iron studies',         'Ferritin',         8.0, 'ng/mL', 15.0,200.0, 'low',    '2026-02-17T00:00:00Z', 'integration'),
    (emily, h_id, 'Complete Blood Count', 'Haemoglobin',     12.6, 'g/dL',  12.0, 15.0, 'normal', '2026-06-28T00:00:00Z', 'integration'),
    (sofia, h_id, 'Blood pressure log',   'Systolic (7d avg)',146.0,'mmHg',  90.0,130.0, 'high',   '2026-05-09T00:00:00Z', 'manual'),
    (daniel,h_id, 'Lung function',        'Peak flow (best)', 410.0,'L/min',450.0,650.0, 'low',    '2026-05-14T00:00:00Z', 'manual'),
    (grace, h_id, 'Immunology',           'IgE total',       340.0, 'IU/mL',  0.0,100.0, 'high',   '2026-01-20T00:00:00Z', 'upload');

  -- --------------------------------------------- Dr. Whitfield's appointment book
  -- Six already seen, four still to come.
  -- Today's book, built off midnight in the hospital's own timezone (§2.1
  -- clinic_hours) rather than the database's UTC, so 09:00 here is 09:00 on the
  -- desk. Without this the whole morning session lands in the browser's evening.
  today := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  insert into public.appointments (hospital_id, patient_id, doctor_id, kind, starts_at,
                                   duration_minutes, location, status) values
    (h_id, ravi,   sara, 'in_person', today + interval '9 hours',                  20, 'CityCare · Diabetes clinic, Room 4',  'completed'),
    (h_id, sofia,  sara, 'in_person', today + interval '9 hours 30 minutes',       20, 'CityCare · General practice, Room 2', 'completed'),
    (h_id, grace,  sara, 'video',     today + interval '10 hours',                 15, 'Video consultation',                  'completed'),
    (h_id, thabo,  sara, 'in_person', today + interval '11 hours',                 15, 'CityCare · Minor injuries',           'no_show'),
    (h_id, emily,  sara, 'in_person', today + interval '11 hours 30 minutes',      20, 'CityCare · General practice, Room 2', 'completed'),
    (h_id, omar,   sara, 'in_person', today + interval '16 hours 30 minutes',      20, 'CityCare · General practice, Room 2', 'booked'),
    (h_id, aarav,  sara, 'video',     today + interval '17 hours',                 15, 'Video consultation',                  'cancelled'),
    (h_id, ling,   sara, 'video',     today + interval '17 hours 30 minutes',      15, 'Video consultation',                  'booked'),
    (h_id, fatima, sara, 'video',     today + interval '1 day 10 hours',           15, 'Video consultation',                  'booked'),
    (h_id, daniel, sara, 'in_person', today + interval '3 days 11 hours 30 minutes', 20, 'CityCare · Respiratory clinic',     'booked'),
    (h_id, ravi,   sara, 'in_person', today + interval '9 days 9 hours',           20, 'CityCare · Diabetes clinic, Room 4',  'booked');

  insert into public.notifications (hospital_id, recipient_id, kind, title, body, deep_link) values
    (h_id, omar,   'appointment', 'Same-day appointment booked',
     'Dr. Whitfield · today · CityCare, Room 2.', '/patient/records'),
    (h_id, fatima, 'appointment', 'Video appointment booked',
     'Dr. Whitfield · tomorrow · video consultation.', '/patient/records');
end $$;

-- ============================================================================
-- Alex Kumar's record, filled out for the demo.
--
-- Two constraints shape what goes in here. Every analyte gets more than one
-- reading, because a single point draws no trend line. And only genuinely
-- current medicines are prescribed: the app puts every approved prescription
-- on today's dose schedule, so a course that finished a year ago would show up
-- as due tonight. Older consults are investigations and advice instead.
-- ============================================================================

do $$
declare
  h_id uuid := '0e2c0000-0000-4000-8000-000000000001';
  alex uuid := 'c1a90000-0000-4000-8000-000000000001';
  sara uuid := '77b30000-0000-4000-8000-000000000001';
  x uuid;
begin
  -- ---------------------------------------------------------------- history
  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Wheeze and night cough, worse since the cold weather', 'investigation',
    'Asthma control review',
    'Night waking twice a week and reliever use most days through the winter.',
    '[{"name":"Spirometry with reversibility","timing":"Within 2 weeks","why":"Confirms how much of the narrowing opens up with a reliever.","detail":"Book at the respiratory clinic."},
      {"name":"Peak flow diary","timing":"Morning and evening, 2 weeks","why":"Shows whether control is slipping overnight, which is when your symptoms are.","detail":"Record the best of three."}]'::jsonb,
    'Seek urgent care if the reliever stops working or you cannot finish a sentence.',
    'Asthma, poor overnight control', 'high',
    now() - interval '14 months', now() - interval '14 months' + interval '4 hours',
    now() - interval '14 months' + interval '1 day', 'seed-alex-asthma');

  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Facial pain and a blocked nose, ten days', 'investigation',
    'Acute sinusitis — supportive care',
    'Ten days of nasal congestion and cheek pain, no fever, no visual symptoms.',
    '[{"name":"Saline nasal rinse","timing":"Twice daily, 10 days","why":"Clears the congestion that keeps the sinuses from draining.","detail":"Sachets from any pharmacy."},
      {"name":"Steam inhalation","timing":"As needed","why":"Eases the pressure while it settles.","detail":"Most sinusitis this age is viral and clears without antibiotics."}]'::jsonb,
    'Come back if the pain is one-sided and worsening, or if vision or the eye socket is involved. Note: penicillin allergy on file — any antibiotic here must be a non-beta-lactam.',
    'Acute sinusitis, no antibiotic indicated', 'high',
    now() - interval '9 months', now() - interval '9 months' + interval '3 hours',
    now() - interval '9 months' + interval '1 day', 'seed-alex-sinus');

  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Routine check — father had a heart attack at 58', 'investigation',
    'Cardiovascular risk screen',
    'No symptoms. First-degree family history of early coronary disease.',
    '[{"name":"Fasting lipid profile","timing":"Within 2 weeks","why":"A family history this early moves the screening age forward.","detail":"Nothing but water for 10 hours beforehand."},
      {"name":"HbA1c","timing":"Same sample","why":"Checks blood sugar over the last three months alongside the lipids.","detail":"No preparation needed."}]'::jsonb,
    'Nothing to change today. The results decide whether anything needs treating.',
    'Screening, family history', 'high',
    now() - interval '7 months', now() - interval '7 months' + interval '5 hours',
    now() - interval '7 months' + interval '1 day', 'seed-alex-screen');

  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Cholesterol result follow-up', 'investigation',
    'Raised LDL — diet first',
    'LDL 151 mg/dL with a family history, but no other risk factors at 33.',
    '[{"name":"Diet and exercise plan","timing":"Ongoing, review in 6 months","why":"At your age and risk level this comes before any tablet.","detail":"Oily fish twice a week, less saturated fat, 150 minutes of activity."},
      {"name":"Repeat lipid profile","timing":"In 6 months","why":"Shows whether the change is working before a statin is considered.","detail":"Fasting again."}]'::jsonb,
    'Book the repeat lipids in six months. Come sooner for chest pain or breathlessness on exertion.',
    'Raised LDL, lifestyle first', 'high',
    now() - interval '6 months', now() - interval '6 months' + interval '2 hours',
    now() - interval '6 months' + interval '1 day', 'seed-alex-lipids');

  -- The one current course, so the dose schedule has a twice-daily preventer
  -- on it rather than only the antihistamine.
  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Using the blue inhaler more than usual again', 'prescription',
    'Asthma preventer step-up',
    'Reliever needed four days out of seven; preventer dose increased.',
    '[{"name":"Beclometasone inhaler","dosage":"200 mcg","timing":"Twice daily, every day","notes":"Rinse your mouth after each dose.","why":"Regular reliever use means the preventer is not holding, not that you need more reliever.","detail":"Up from 100 mcg twice daily."},
      {"name":"Salbutamol inhaler","dosage":"100 mcg","timing":"As needed, and 15 minutes before exercise","notes":"Through a spacer.","why":"Pre-treatment stops exercise setting off the wheeze.","detail":"Keep it with you."}]'::jsonb,
    'Seek urgent care if the reliever stops working, or if you cannot speak a full sentence.',
    'Asthma step-up, preventer', 'high',
    now() - interval '12 days', now() - interval '12 days' + interval '2 hours',
    now() - interval '11 days', 'seed-alex-preventer');

  -- ------------------------------------------------------------- the kidney
  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Blood in the urine after a chest infection', 'investigation',
    'Visible haematuria — nephrology referral',
    'Frank haematuria two days into an upper respiratory infection, second episode in a year.',
    '[{"name":"Urine albumin:creatinine ratio","timing":"Within 1 week","why":"Measures how much protein the kidneys are leaking, which decides how urgent this is.","detail":"First morning sample."},
      {"name":"Creatinine and eGFR","timing":"Same sample","why":"Establishes where kidney function is starting from.","detail":"No preparation needed."},
      {"name":"Nephrology referral","timing":"Routine","why":"Haematuria that tracks an infection this closely is the classic pattern for IgA nephropathy, and it needs a biopsy to confirm.","detail":"The clinic will write to you."}]'::jsonb,
    'Seek urgent care for reduced urine output, swelling of the face or legs, or breathlessness.',
    'Synpharyngitic haematuria, suspected IgA nephropathy', 'medium',
    now() - interval '30 months', now() - interval '30 months' + interval '6 hours',
    now() - interval '30 months' + interval '1 day', 'seed-alex-haematuria');

  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Kidney review — protein still in the urine', 'prescription',
    'CKD stage 3a — start an ACE inhibitor',
    'Biopsy-proven IgA nephropathy with an ACR of 78 mg/mmol and eGFR drifting down.',
    '[{"name":"Ramipril","dosage":"5 mg","timing":"Once daily, at night","notes":"A dry cough is the usual side effect; tell us rather than stopping it.","why":"It lowers the protein leak, which is what actually slows the disease down.","detail":"Started at 2.5 mg and stepped up."},
      {"name":"Creatinine and potassium","dosage":"","timing":"Two weeks after any dose change","notes":"","why":"An ACE inhibitor can raise potassium and nudge creatinine; both need checking once.","detail":"Bloods only."}]'::jsonb,
    'Avoid ibuprofen, naproxen and any other anti-inflammatory — with your kidney function they are not safe. Paracetamol is fine.',
    'IgA nephropathy, proteinuria — ACE inhibitor started', 'high',
    now() - interval '20 months', now() - interval '20 months' + interval '3 hours',
    now() - interval '20 months' + interval '1 day', 'seed-alex-acei');

  x := pg_temp.seed_closed_case(h_id, alex, sara,
    'Annual kidney check', 'investigation',
    'CKD annual review — stable',
    'eGFR 52 and holding, ACR down to 31 mg/mmol on ramipril. Blood pressure 124/78.',
    '[{"name":"Renal profile and urine ACR","timing":"In 6 months","why":"Twice a year is the review interval for stage 3a that is not moving.","detail":"First morning urine plus bloods."},
      {"name":"Blood pressure at home","timing":"Weekly","why":"Blood pressure is the single biggest lever on how fast kidney function falls.","detail":"Target below 130/80."}]'::jsonb,
    'Keep off anti-inflammatories. If you get a vomiting or diarrhoeal illness, stop the ramipril for those days and drink — dehydration plus an ACE inhibitor is what puts kidneys in hospital.',
    'CKD 3a, stable on ACE inhibitor', 'high',
    now() - interval '3 months', now() - interval '3 months' + interval '2 hours',
    now() - interval '3 months' + interval '1 day', 'seed-alex-ckd-review');

  insert into public.lab_results (patient_id, hospital_id, panel, analyte, value_num, unit,
                                  ref_low, ref_high, abnormal, observed_at, source) values
    (alex, h_id, 'Renal profile', 'Creatinine', 118, 'umol/L', 60, 110, 'high',   now() - interval '30 months', 'integration'),
    (alex, h_id, 'Renal profile', 'Creatinine', 141, 'umol/L', 60, 110, 'high',   now() - interval '20 months', 'integration'),
    (alex, h_id, 'Renal profile', 'Creatinine', 138, 'umol/L', 60, 110, 'high',   now() - interval '3 months',  'integration'),
    (alex, h_id, 'Renal profile', 'eGFR',        68, 'mL/min/1.73m2', 90, 120, 'low', now() - interval '30 months', 'integration'),
    (alex, h_id, 'Renal profile', 'eGFR',        49, 'mL/min/1.73m2', 90, 120, 'low', now() - interval '20 months', 'integration'),
    (alex, h_id, 'Renal profile', 'eGFR',        52, 'mL/min/1.73m2', 90, 120, 'low', now() - interval '3 months',  'integration'),
    (alex, h_id, 'Renal profile', 'Potassium',  4.9, 'mmol/L', 3.5, 5.3, 'normal', now() - interval '3 months', 'integration'),

    (alex, h_id, 'Urine protein', 'Albumin:creatinine ratio', 78, 'mg/mmol', 0, 3, 'high', now() - interval '20 months', 'integration'),
    (alex, h_id, 'Urine protein', 'Albumin:creatinine ratio', 44, 'mg/mmol', 0, 3, 'high', now() - interval '12 months', 'integration'),
    (alex, h_id, 'Urine protein', 'Albumin:creatinine ratio', 31, 'mg/mmol', 0, 3, 'high', now() - interval '3 months',  'integration');

  insert into public.appointments (hospital_id, patient_id, doctor_id, kind, starts_at,
                                   duration_minutes, location, status) values
    (h_id, alex, sara, 'in_person', now() - interval '3 months' + interval '4 days', 20, 'CityCare · Nephrology clinic', 'completed'),
    (h_id, alex, sara, 'in_person', now() + interval '16 days' + interval '10 hours', 20, 'CityCare · Nephrology clinic', 'booked');

  -- ------------------------------------------------------------------- labs
  -- Three lipid readings and three counts, so the panel screens have a trend
  -- to draw and the LDL visibly comes down after the diet plan.
  insert into public.lab_results (patient_id, hospital_id, panel, analyte, value_num, unit,
                                  ref_low, ref_high, abnormal, observed_at, source) values
    (alex, h_id, 'Lipid Profile', 'LDL cholesterol',   151, 'mg/dL',  0, 100, 'high',   now() - interval '7 months', 'integration'),
    (alex, h_id, 'Lipid Profile', 'LDL cholesterol',   141, 'mg/dL',  0, 100, 'high',   now() - interval '4 months', 'integration'),
    (alex, h_id, 'Lipid Profile', 'LDL cholesterol',   132, 'mg/dL',  0, 100, 'high',   now() - interval '5 weeks',  'integration'),
    (alex, h_id, 'Lipid Profile', 'Total cholesterol', 214, 'mg/dL',  0, 200, 'high',   now() - interval '5 weeks',  'integration'),
    (alex, h_id, 'Lipid Profile', 'HDL cholesterol',    46, 'mg/dL', 40, 100, 'normal', now() - interval '5 weeks',  'integration'),
    (alex, h_id, 'Lipid Profile', 'Triglycerides',     158, 'mg/dL',  0, 150, 'high',   now() - interval '5 weeks',  'integration'),

    (alex, h_id, 'Complete Blood Count', 'Haemoglobin', 14.0, 'g/dL', 13.0, 17.0, 'normal', now() - interval '7 months', 'integration'),
    (alex, h_id, 'Complete Blood Count', 'Haemoglobin', 14.2, 'g/dL', 13.0, 17.0, 'normal', now() - interval '4 months', 'integration'),
    (alex, h_id, 'Complete Blood Count', 'White cell count', 6.4, 'x10^9/L', 4.0, 11.0, 'normal', now() - interval '5 weeks', 'integration'),
    (alex, h_id, 'Complete Blood Count', 'Platelets',       249, 'x10^9/L', 150, 400, 'normal', now() - interval '5 weeks', 'integration'),

    (alex, h_id, 'Diabetes panel', 'HbA1c', 5.6, '%', 4.0, 5.7, 'normal', now() - interval '7 months', 'integration'),
    (alex, h_id, 'Diabetes panel', 'HbA1c', 5.4, '%', 4.0, 5.7, 'normal', now() - interval '5 weeks',  'integration'),

    (alex, h_id, 'Vitamin D', '25-hydroxyvitamin D', 18, 'ng/mL', 30, 100, 'low', now() - interval '5 weeks', 'integration'),

    (alex, h_id, 'Lung function', 'Peak flow (best)', 470, 'L/min', 500, 700, 'low',    now() - interval '14 months', 'manual'),
    (alex, h_id, 'Lung function', 'Peak flow (best)', 545, 'L/min', 500, 700, 'normal', now() - interval '10 days',   'manual');

  -- ----------------------------------------------------------- appointments
  insert into public.appointments (hospital_id, patient_id, doctor_id, kind, starts_at,
                                   duration_minutes, location, status) values
    (h_id, alex, sara, 'lab',       now() - interval '7 months' + interval '9 days',  15, 'CityCare · Phlebotomy, Ground floor', 'completed'),
    (h_id, alex, sara, 'in_person', now() - interval '6 months' + interval '2 days',  20, 'CityCare · General practice, Room 2', 'completed'),
    (h_id, alex, sara, 'video',     now() - interval '12 days' + interval '3 hours',  15, 'Video consultation',                   'completed'),
    (h_id, alex, sara, 'lab',       now() - interval '5 weeks' + interval '1 day',    15, 'CityCare · Phlebotomy, Ground floor',  'completed');

  insert into public.notifications (hospital_id, recipient_id, kind, title, body, deep_link) values
    (h_id, alex, 'system', 'Your vitamin D is low',
     '18 ng/mL against a range of 30–100. Dr. Whitfield has seen it and will raise it at your next visit.', '/patient/records?tab=labs'),
    (h_id, alex, 'decision', 'Preventer dose increased',
     'Dr. Whitfield approved the step-up to beclometasone 200 mcg twice daily.', '/patient/records');
end $$;

drop function if exists pg_temp.seed_closed_case(uuid, uuid, uuid, text, public.plan_kind, text, text,
  jsonb, text, text, public.confidence, timestamptz, timestamptz, timestamptz, text);
drop function if exists pg_temp.seed_pending_case(uuid, uuid, text, public.urgency, jsonb, uuid,
  public.plan_kind, text, text, jsonb, text, text, public.confidence, jsonb, interval, jsonb, jsonb);
