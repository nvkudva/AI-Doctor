-- 0001 — extensions, the enum vocabulary (DATA-MODEL §2 / §3.2), and the session
-- actor channel the state machine reads (§3.2).

create extension if not exists pgcrypto  with schema extensions;
create extension if not exists citext    with schema extensions;
create extension if not exists pg_trgm   with schema extensions;

-- ---------------------------------------------------------------- enums (§2, §3.2)
create type public.profile_kind   as enum ('patient','clinician','operator');
create type public.member_role    as enum ('patient','doctor','admin');
create type public.member_status  as enum ('active','suspended');
create type public.sex_at_birth   as enum ('male','female','other','undisclosed');

create type public.consult_status as enum (
  'active','pending_review','needs_human','approved','rejected',
  'escalated','communicated','closed','superseded','abandoned','expired');

create type public.urgency        as enum ('routine','soon','urgent');
create type public.actor_kind     as enum ('patient','ai','doctor','system');

create type public.slot_id as enum (
  'presenting_complaint','onset','duration_course','severity','character',
  'location_radiation','aggravating_relieving','associated_symptoms','red_flag_screen',
  'relevant_history','current_medications','allergies',
  'pregnancy_status','travel','occupational_exposure','sick_contacts',
  'recent_procedures','smoking_alcohol');

create type public.slot_status  as enum ('unknown','asked','filled','refused','not_applicable','unanswered');
create type public.slot_source  as enum ('patient','record','inferred');

create type public.message_sender  as enum ('patient','ai','system');
create type public.message_channel as enum ('voice','text');

create type public.consult_event_type as enum (
  'status_change','queued','doctor_opened','notification_sent','sla_escalated',
  'expired','abandoned','slot_filled','red_flag_raised','safety_check',
  'draft_created','draft_revised','media_uploaded','tool_call','refusal','system');

create type public.media_kind        as enum ('image','video');
create type public.confidence        as enum ('high','medium','low');
create type public.safety_check_kind as enum ('allergy_class','interaction','dose_sanity','age_constraint','pregnancy');
create type public.safety_verdict    as enum ('clear','caution','block');
create type public.agent_mode        as enum ('patient','coordinator');
create type public.review_sender     as enum ('doctor','ai');
create type public.review_action     as enum ('approved','edited_approved','rejected','escalated');
create type public.feedback_category as enum ('correction','style','protocol');
create type public.feedback_status   as enum ('new','triaged','applied','declined');
create type public.plan_kind         as enum ('prescription','investigation');
create type public.investigation_modality as enum ('lab','imaging','procedure','other');
create type public.order_status      as enum ('ordered','scheduled','collected','resulted','cancelled');
create type public.abnormal_flag     as enum ('normal','low','high','critical','unknown');
create type public.result_source     as enum ('upload','manual','integration');
create type public.appointment_kind   as enum ('in_person','video','imaging','lab');
create type public.appointment_status as enum ('booked','cancelled','completed','no_show');
create type public.notification_kind  as enum ('case_queued','decision','sla_delay','expired','appointment','system');

-- The tenancy helpers every policy is written against live in 0002 and 0003, next
-- to the tables they read: a LANGUAGE SQL body is parsed at CREATE time, so it
-- cannot name a table that does not exist yet.

-- The actor channel the state-machine trigger reads (§3.2). Unset => null => the
-- transition allowlist cannot match => the update is refused. Fail closed.
create or replace function public.current_actor()
returns public.actor_kind
language sql
stable
as $$
  select nullif(current_setting('vd.actor', true), '')::public.actor_kind;
$$;

create or replace function public.current_actor_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('vd.actor_id', true), '')::uuid;
$$;
