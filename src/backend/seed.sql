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
  pv_cough    uuid := 'b7d00000-0000-4000-8000-000000000001';
  pv_headache uuid := 'b7d00000-0000-4000-8000-000000000002';
  pv_rash     uuid := 'b7d00000-0000-4000-8000-000000000003';
  c1 uuid; c2 uuid; c3 uuid; h1 uuid; h2 uuid;
  d1 uuid; d2 uuid; d3 uuid; dh1 uuid; dh2 uuid;
  rv uuid; rx uuid; hash text;
  pw text := crypt('demo-password-2026', gen_salt('bf'));
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
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
   ('00000000-0000-0000-0000-000000000000', alex,  'authenticated','authenticated','alex.kumar.demo@example.com',      pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Alex Kumar","kind":"patient"}'::jsonb, now(), now()),
   ('00000000-0000-0000-0000-000000000000', sara,  'authenticated','authenticated','sara.whitfield.demo@example.com',  pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Sara Whitfield","kind":"clinician"}'::jsonb, now(), now()),
   ('00000000-0000-0000-0000-000000000000', maria, 'authenticated','authenticated','maria.gonzalez.demo@example.com',  pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Gonzalez","kind":"patient"}'::jsonb, now(), now()),
   ('00000000-0000-0000-0000-000000000000', james, 'authenticated','authenticated','james.okoro.demo@example.com',     pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"James Okoro","kind":"patient"}'::jsonb, now(), now()),
   ('00000000-0000-0000-0000-000000000000', priya, 'authenticated','authenticated','priya.sharma.demo@example.com',    pw, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Priya Sharma","kind":"patient"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id, u.id::text, u.id,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
    from auth.users u
   where u.id in (alex, sara, maria, james, priya)
  on conflict do nothing;

  -- ---------------------------------------------------- memberships + details
  insert into public.memberships (profile_id, hospital_id, role) values
    (alex,  h_id, 'patient'), (sara,  h_id, 'doctor'),
    (maria, h_id, 'patient'), (james, h_id, 'patient'), (priya, h_id, 'patient')
  on conflict (profile_id, hospital_id) do nothing;

  insert into public.patient_details (profile_id, dob, sex, blood_group, allergies, conditions, medications) values
    (alex, '1992-03-14', 'male', 'O+',
     '[{"substance":"Penicillin","class":"beta_lactam","severity":"severe","reaction":"rash, swelling","source":"self_reported"}]'::jsonb,
     '[{"name":"Asthma","since":"2015","status":"active","source":"self_reported"}]'::jsonb,
     '[{"name":"Salbutamol inhaler","dose":"100 mcg","frequency":"PRN","source":"self_reported"}]'::jsonb),
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
  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key)
  values (h1, sara, dh1, hash, 'approved', 'seed-h1-approve') returning id into rv;
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
      'advice','Keep moving gently; seek care if pain spreads down the leg or bladder changes appear.',
      'urgency','routine'),
    'Mechanical lower back pain', 'high',
    '[{"code":"allergy_clear","severity":"info","text":"No beta-lactam in this draft; penicillin allergy on file.","source":"validator"}]'::jsonb,
    '{}'::jsonb, 'claude-opus-5', 'mira-patient-v4')
  returning id into dh2;
  select content_hash into hash from public.ai_drafts where id = dh2;
  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key)
  values (h2, sara, dh2, hash, 'approved', 'seed-h2-approve') returning id into rv;
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
    (alex,  h_id, 'Complete Blood Count', 'Haemoglobin',        14.4, 'g/dL', 13.0, 17.0, 'normal',   '2026-02-02T00:00:00Z', 'integration'),
    (alex,  h_id, 'Lipid Profile',        'LDL cholesterol',   132.0, 'mg/dL', 0.0, 100.0,'high',     '2026-02-02T00:00:00Z', 'integration'),
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
