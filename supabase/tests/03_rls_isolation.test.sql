-- One patient cannot read another patient's consult, prescription or labs, and a
-- doctor cannot read another hospital's. Every assertion runs as the `authenticated`
-- role with a real JWT claim set, so what is being tested is the policy, not a
-- server-side `if`. A denied read returns zero rows; a denied write raises 42501.

begin;
select plan(14);

insert into public.hospitals (id, slug, name) values
  ('11111111-1111-4111-8111-11111111111a', 'rlsx', 'RLS Hospital X'),
  ('22222222-2222-4222-8222-22222222222b', 'rlsy', 'RLS Hospital Y');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-33333333333a','authenticated','authenticated','rls-a@test.local','x',now(),'{}'::jsonb,'{"full_name":"Patient A","kind":"patient"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-8444-44444444444b','authenticated','authenticated','rls-b@test.local','x',now(),'{}'::jsonb,'{"full_name":"Patient B","kind":"patient"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-55555555555c','authenticated','authenticated','rls-dx@test.local','x',now(),'{}'::jsonb,'{"full_name":"Doctor X","kind":"clinician"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-66666666666d','authenticated','authenticated','rls-dy@test.local','x',now(),'{}'::jsonb,'{"full_name":"Doctor Y","kind":"clinician"}'::jsonb,now(),now());

insert into public.memberships (profile_id, hospital_id, role) values
  ('33333333-3333-4333-8333-33333333333a','11111111-1111-4111-8111-11111111111a','patient'),
  ('44444444-4444-4444-8444-44444444444b','11111111-1111-4111-8111-11111111111a','patient'),
  ('55555555-5555-4555-8555-55555555555c','11111111-1111-4111-8111-11111111111a','doctor'),
  ('66666666-6666-4666-8666-66666666666d','22222222-2222-4222-8222-22222222222b','doctor');

insert into public.patient_details (profile_id, dob, sex) values
  ('33333333-3333-4333-8333-33333333333a','1990-01-01','male'),
  ('44444444-4444-4444-8444-44444444444b','1991-01-01','female');

-- Patient A's consult, transcript, draft, review, prescription and labs.
insert into public.consults (id, hospital_id, patient_id, status, chief_complaint, submitted_at)
values ('77777777-7777-4777-8777-77777777777a','11111111-1111-4111-8111-11111111111a',
        '33333333-3333-4333-8333-33333333333a','pending_review','A private complaint', now());

insert into public.consult_messages (consult_id, sender, channel, content)
values ('77777777-7777-4777-8777-77777777777a','patient','text','Something I told my own doctor.');

insert into public.ai_drafts (id, consult_id, hospital_id, version, created_by, recommendation, note,
                              confidence, flags, raw_response, model, prompt_version)
values ('88888888-8888-4888-8888-88888888888a','77777777-7777-4777-8777-77777777777a',
        '11111111-1111-4111-8111-11111111111a', 1, 'doctor_agent',
        '{"type":"prescription","title":"T","summary":"S","items":[],"advice":"A","urgency":"routine"}'::jsonb,
        'RLS draft', 'high', '[]'::jsonb, '{}'::jsonb, 'stub', 'test-v1');

insert into public.reviews (id, consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key)
values ('99999999-9999-4999-8999-99999999999a','77777777-7777-4777-8777-77777777777a',
        '55555555-5555-4555-8555-55555555555c','88888888-8888-4888-8888-88888888888a',
        (select content_hash from public.ai_drafts where id = '88888888-8888-4888-8888-88888888888a'),
        'approved', 'rls-approve');

insert into public.prescriptions (id, consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77777777-7777-4777-8777-77777777777a',
        '11111111-1111-4111-8111-11111111111a','33333333-3333-4333-8333-33333333333a',
        '55555555-5555-4555-8555-55555555555c','99999999-9999-4999-8999-99999999999a',
        'prescription','A private plan');

insert into public.lab_results (patient_id, hospital_id, panel, analyte, value_num, unit, abnormal, observed_at)
values ('33333333-3333-4333-8333-33333333333a','11111111-1111-4111-8111-11111111111a',
        'CBC','Haemoglobin', 14.1, 'g/dL','normal', now());

-- ------------------------------------------------- patient B: the negative case
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-44444444444b","role":"authenticated"}';

select is((select count(*)::int from public.consults
            where id = '77777777-7777-4777-8777-77777777777a'), 0,
  'patient B cannot read patient A''s consult — the row is not there for them');

select is((select count(*)::int from public.consult_messages
            where consult_id = '77777777-7777-4777-8777-77777777777a'), 0,
  'patient B cannot read patient A''s transcript');

select is((select count(*)::int from public.prescriptions
            where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'patient B cannot read patient A''s prescription');

select is((select count(*)::int from public.lab_results
            where patient_id = '33333333-3333-4333-8333-33333333333a'), 0,
  'patient B cannot read patient A''s labs');

select is((select count(*)::int from public.patient_details
            where profile_id = '33333333-3333-4333-8333-33333333333a'), 0,
  'patient B cannot read patient A''s clinical profile');

select is((select count(*)::int from public.ai_drafts
            where consult_id = '77777777-7777-4777-8777-77777777777a'), 0,
  'patient B cannot read the draft on patient A''s consult');

select throws_ok(
  $$insert into public.consult_messages (consult_id, sender, channel, content)
    values ('77777777-7777-4777-8777-77777777777a','patient','text','injected turn')$$,
  '42501', NULL,
  'patient B cannot append a turn to patient A''s consult');

select throws_ok(
  $$select public.approve_consult('77777777-7777-4777-8777-77777777777a',
      '88888888-8888-4888-8888-88888888888a', 'whatever', '[]'::jsonb, '[]'::jsonb, '', 'attempt')$$,
  'PT403', NULL,
  'a patient calling approve_consult is refused — the role check is in the function');

-- --------------------------------------------------- patient A: the positive case
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-33333333333a","role":"authenticated"}';

select is((select count(*)::int from public.consults
            where id = '77777777-7777-4777-8777-77777777777a'), 1,
  'patient A does read their own consult');

select is((select count(*)::int from public.prescriptions
            where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'patient A does read their own prescription');

select is((select count(*)::int from public.lab_results
            where patient_id = '33333333-3333-4333-8333-33333333333a'), 1,
  'patient A does read their own labs');

-- ------------------------------------------------------- cross-hospital doctor
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-66666666666d","role":"authenticated"}';

select is((select count(*)::int from public.consults
            where id = '77777777-7777-4777-8777-77777777777a'), 0,
  'a doctor of hospital Y cannot read hospital X''s consult');

select is((select count(*)::int from public.consult_trace
            where consult_id = '77777777-7777-4777-8777-77777777777a'), 0,
  'nor its trace — the view is security_invoker, so it inherits the same policies');

-- ------------------------------------------------------------- treating doctor
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-55555555555c","role":"authenticated"}';

select is((select count(*)::int from public.consults
            where id = '77777777-7777-4777-8777-77777777777a'), 1,
  'the doctor of hospital X does read the consult in their own queue');

reset role;
select * from finish();
rollback;
