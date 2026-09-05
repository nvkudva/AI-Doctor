-- The approval gate cannot be bypassed (DATA-MODEL §3.4).
-- Every assertion below is against Postgres DDL — a constraint, a trigger or a
-- grant. None of it is application code, so none of it can be routed around.

begin;
select plan(12);

-- ------------------------------------------------------------------- fixture
insert into public.hospitals (id, slug, name) values
  ('11111111-1111-4111-8111-111111111111', 'gatex', 'Gate Hospital X');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','gate-a@test.local','x',now(),'{}'::jsonb,'{"full_name":"Patient A","kind":"patient"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555555','authenticated','authenticated','gate-dx@test.local','x',now(),'{}'::jsonb,'{"full_name":"Doctor X","kind":"clinician"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-4666-8666-666666666666','authenticated','authenticated','gate-dz@test.local','x',now(),'{}'::jsonb,'{"full_name":"Doctor Z","kind":"clinician"}'::jsonb,now(),now());

insert into public.memberships (profile_id, hospital_id, role) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','patient'),
  ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','doctor'),
  ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','doctor');

insert into public.consults (id, hospital_id, patient_id, status, chief_complaint, submitted_at)
values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333','pending_review','Gate test', now());

insert into public.ai_drafts (id, consult_id, hospital_id, version, created_by, recommendation, note,
                              confidence, flags, raw_response, model, prompt_version)
values ('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777',
        '11111111-1111-4111-8111-111111111111', 1, 'doctor_agent',
        '{"type":"prescription","title":"T","summary":"S","items":[{"name":"Loratadine","dosage":"10 mg","timing":"OD","notes":"","why":"","detail":""}],"advice":"A","urgency":"routine"}'::jsonb,
        'Gate draft', 'high', '[]'::jsonb, '{}'::jsonb, 'stub', 'test-v1');

-- A rejecting review and an approving one, both real rows.
insert into public.reviews (id, consult_id, doctor_id, draft_id, draft_hash, action, reason,
                            patient_message, idempotency_key)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','77777777-7777-4777-8777-777777777777',
        '55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888',
        (select content_hash from public.ai_drafts where id = '88888888-8888-4888-8888-888888888888'),
        'rejected', 'not appropriate', 'Please book an in-person visit.', 'gate-reject');

insert into public.reviews (id, consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key)
values ('99999999-9999-4999-8999-999999999999','77777777-7777-4777-8777-777777777777',
        '55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888',
        (select content_hash from public.ai_drafts where id = '88888888-8888-4888-8888-888888888888'),
        'approved', 'gate-approve');

-- ---------------------------------------------------------------- structure
select col_is_unique('public', 'prescriptions', 'review_id',
  'prescriptions.review_id is UNIQUE — one prescription per review, structurally');

select col_not_null('public', 'prescriptions', 'review_id',
  'prescriptions.review_id is NOT NULL — a prescription without a review cannot be represented');

-- ---------------------------------------------- 1. no review at all: NOT NULL
select throws_ok(
  $$insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, kind, advice)
    values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
            'prescription','no review')$$,
  '23502', NULL,
  'a prescription with no review row is rejected by NOT NULL');

-- --------------------------------------------- 2. a rejecting review is not a yes
select throws_ok(
  $$insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
    values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
            'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','prescription','rejected review')$$,
  '23514', 'prescription requires an approving review, got rejected',
  'a rejected review cannot produce a prescription');

-- ----------------------------------------- 3. a different doctor cannot ride along
select throws_ok(
  $$insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
    values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666',
            '99999999-9999-4999-8999-999999999999','prescription','wrong doctor')$$,
  '23514', 'prescription/review mismatch',
  'the signing doctor must be the doctor on the review');

-- --------------------------------- 4. version binding: a stale hash is refused
insert into public.reviews (id, consult_id, doctor_id, draft_id, draft_hash, action, idempotency_key)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','77777777-7777-4777-8777-777777777777',
        '55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888',
        'sha256:stale-hash-from-an-earlier-read', 'approved', 'gate-stale');

select throws_ok(
  $$insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
    values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
            'cccccccc-cccc-4ccc-8ccc-cccccccccccc','prescription','stale hash')$$,
  '23514', 'draft changed after signature',
  'a prescription bound to a stale draft hash is refused');

-- ------------------------------------------- 5. the approving review does work
select lives_ok(
  $$insert into public.prescriptions (id, consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77777777-7777-4777-8777-777777777777',
            '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
            '55555555-5555-4555-8555-555555555555','99999999-9999-4999-8999-999999999999',
            'prescription','approved')$$,
  'an approving, version-bound review by the right doctor does produce a prescription');

-- ------------------------------- 6. and it cannot be reused for a second script
select throws_ok(
  $$insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id, kind, advice)
    values ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
            '99999999-9999-4999-8999-999999999999','prescription','second bite')$$,
  '23505', NULL,
  'one review signs exactly one prescription (UNIQUE review_id)');

-- ------------------------------------------------ 7. immutable after signature
select throws_ok(
  $$update public.prescriptions set advice = 'quietly rewritten'
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501', 'prescriptions are immutable; issue a superseding version',
  'an approved prescription cannot be edited after the fact');

-- --------------------------------------------------------- 8. grants (§3.4 L5)
select ok(not has_table_privilege('authenticated', 'public.prescriptions', 'INSERT'),
  'the authenticated role holds no INSERT grant on prescriptions');

select ok(not has_table_privilege('service_role', 'public.prescriptions', 'INSERT'),
  'service_role — the role the AI path runs as — holds no INSERT grant on prescriptions');

select ok(not has_table_privilege('authenticated', 'public.reviews', 'INSERT'),
  'a doctor cannot insert a review directly; approve_consult is the only path');

select * from finish();
rollback;
