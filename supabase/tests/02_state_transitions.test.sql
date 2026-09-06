-- Transitions outside the §3.2 allowlist are rejected, by a trigger reading a
-- table — not by application code, and not by a CHECK (a CHECK cannot see
-- OLD.status).

begin;
select plan(9);

insert into public.hospitals (id, slug, name) values
  ('11111111-1111-4111-8111-111111111112', 'transx', 'Transition Hospital');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333334','authenticated','authenticated','tr-a@test.local','x',now(),'{}'::jsonb,'{"full_name":"Patient T","kind":"patient"}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-4555-8555-555555555556','authenticated','authenticated','tr-d@test.local','x',now(),'{}'::jsonb,'{"full_name":"Doctor T","kind":"clinician"}'::jsonb,now(),now());

insert into public.memberships (profile_id, hospital_id, role) values
  ('33333333-3333-4333-8333-333333333334','11111111-1111-4111-8111-111111111112','patient'),
  ('55555555-5555-4555-8555-555555555556','11111111-1111-4111-8111-111111111112','doctor');

insert into public.consults (id, hospital_id, patient_id, status, submitted_at)
values ('77777777-7777-4777-8777-777777777778','11111111-1111-4111-8111-111111111112',
        '33333333-3333-4333-8333-333333333334','pending_review', now());

-- ------------------------------------------------------------- the allowlist
select is(
  (select count(*)::int from public.consult_transitions
    where from_status = 'approved' and to_status = 'active'),
  0,
  'approved -> active is not in the allowlist table at all');

select is(
  (select count(*)::int from public.consult_transitions
    where from_status = 'pending_review' and to_status = 'approved' and allowed_actor = 'doctor'),
  1,
  'pending_review -> approved is allowed, and only for a doctor');

-- ------------------------------------------- 1. no actor set: fail closed
select throws_ok(
  $$update public.consults set status = 'approved'
     where id = '77777777-7777-4777-8777-777777777778'$$,
  '23514', NULL,
  'with no actor on the session the transition is refused (fail closed)');

-- ---------------------------------- 2. the wrong actor cannot make the move
do $fx$ begin perform set_config('vd.actor', 'patient', true); end $fx$;
select throws_ok(
  $$update public.consults set status = 'approved'
     where id = '77777777-7777-4777-8777-777777777778'$$,
  '23514', NULL,
  'a patient cannot move a consult to approved — only a doctor may');

-- --------------------------------------- 3. a transition off the allowlist
do $fx$ begin perform set_config('vd.actor', 'doctor', true); end $fx$;
select throws_ok(
  $$update public.consults set status = 'active'
     where id = '77777777-7777-4777-8777-777777777778'$$,
  '23514', NULL,
  'pending_review -> active is not an allowed transition for anyone');

-- ----------------------------------------------- 4. the allowed move works
do $fx$ begin perform set_config('vd.actor_id', '55555555-5555-4555-8555-555555555556', true); end $fx$;
select lives_ok(
  $$update public.consults set status = 'approved', decided_at = now()
     where id = '77777777-7777-4777-8777-777777777778'$$,
  'a doctor may move pending_review -> approved');

-- ----------------------- 5. and the trace row is written by the same trigger
select is(
  (select count(*)::int from public.consult_events
    where consult_id = '77777777-7777-4777-8777-777777777778'
      and event_type = 'status_change'
      and payload->>'from' = 'pending_review' and payload->>'to' = 'approved'
      and actor = 'doctor'),
  1,
  'the transition wrote its own status_change event — the trace cannot be skipped');

-- ---------------------------- 6. approved is terminal except where allowed
select throws_ok(
  $$update public.consults set status = 'active'
     where id = '77777777-7777-4777-8777-777777777778'$$,
  '23514', NULL,
  'an approved consult cannot be reopened as active');

-- ----------------------------------------- 7. the trace itself is append-only
select throws_ok(
  $$update public.consult_events set payload = '{"tampered":true}'::jsonb
     where consult_id = '77777777-7777-4777-8777-777777777778'$$,
  '42501', NULL,
  'consult_events cannot be rewritten after the fact');

select * from finish();
rollback;
