-- 0006 — the patient's record surface, outbound notices, the audit log, and the
-- consult_trace read model (DATA-MODEL §2.21-§2.26, §3.6).

create table public.lab_results (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.profiles(id),
  hospital_id uuid not null references public.hospitals(id),
  order_id    uuid references public.investigation_orders(id),
  panel       text not null,
  analyte     text not null,
  value_num   numeric,
  value_text  text,
  unit        text,
  ref_low     numeric,
  ref_high    numeric,
  abnormal    public.abnormal_flag not null default 'unknown',
  observed_at timestamptz not null,
  source      public.result_source not null default 'upload',
  report_path text,
  created_at  timestamptz not null default now(),
  constraint lab_results_has_a_value check (value_num is not null or value_text is not null)
);
create index lab_results_patient on public.lab_results (patient_id, observed_at desc);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  hospital_id      uuid not null references public.hospitals(id),
  patient_id       uuid not null references public.profiles(id),
  doctor_id        uuid references public.profiles(id),
  consult_id       uuid references public.consults(id),
  review_id        uuid references public.reviews(id),
  kind             public.appointment_kind not null,
  starts_at        timestamptz not null,
  duration_minutes int not null default 15,
  location         text,
  status           public.appointment_status not null default 'booked',
  created_at       timestamptz not null default now()
);
create index appointments_patient on public.appointments (patient_id, starts_at);

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  hospital_id       uuid not null references public.hospitals(id),
  recipient_id      uuid not null references public.profiles(id),
  consult_id        uuid references public.consults(id),
  kind              public.notification_kind not null,
  title             text not null,
  body              text not null,
  deep_link         text,
  read_at           timestamptz,
  delivered_push_at timestamptz,
  created_at        timestamptz not null default now()
);
create index notifications_recipient on public.notifications (recipient_id, created_at desc);

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  last_success_at timestamptz,
  failure_count   int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  actor_id    uuid references public.profiles(id),
  actor_role  public.actor_kind not null,
  action      text not null,
  target_kind text not null,
  target_id   text,
  ip_hash     text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_time on public.audit_log (created_at desc);
create trigger t_audit_log_no_update before update on public.audit_log
  for each row execute function public.reject_write();
create trigger t_audit_log_no_delete before delete on public.audit_log
  for each row execute function public.reject_write();

-- ---------------------------------------------------------------- §2.26 the view
-- security_invoker: the reader's own policies decide what the trace shows. Nothing
-- writes through it.
create view public.consult_trace
with (security_invoker = on) as
  select m.consult_id, m.hospital_id, m.created_at as at,
         (case m.sender when 'patient' then 'patient' when 'ai' then 'ai' else 'system' end)::public.actor_kind as actor,
         null::uuid as actor_id, 'message'::text as kind, m.id as source_id,
         initcap(m.sender::text) || ' (' || m.channel::text || '): ' || left(m.content, 160) as summary,
         to_jsonb(m) as payload
    from public.consult_messages m
  union all
  select e.consult_id, e.hospital_id, e.created_at, e.actor, e.actor_id, 'event', e.id,
         e.event_type::text || ' ' || coalesce(e.payload::text, '{}'), to_jsonb(e)
    from public.consult_events e
  union all
  select d.consult_id, d.hospital_id, d.created_at, 'ai'::public.actor_kind, null, 'draft', d.id,
         'Draft v' || d.version::text || ' (' || d.confidence::text || '): ' || d.note, to_jsonb(d)
    from public.ai_drafts d
  union all
  select s.consult_id, s.hospital_id, s.created_at, 'system'::public.actor_kind, null, 'safety_check', s.id,
         s.check_kind::text || ' ' || s.item_name || ' → ' || s.verdict, to_jsonb(s)
    from public.safety_checks s
  union all
  select rm.consult_id, rm.hospital_id, rm.created_at,
         (case rm.sender when 'doctor' then 'doctor' else 'ai' end)::public.actor_kind,
         rm.doctor_id, 'review_message', rm.id, left(rm.content, 160), to_jsonb(rm)
    from public.review_messages rm
  union all
  select r.consult_id, r.hospital_id, r.created_at, 'doctor'::public.actor_kind, r.doctor_id,
         'review', r.id, 'Decision: ' || r.action::text, to_jsonb(r)
    from public.reviews r
  union all
  select p.consult_id, p.hospital_id, p.approved_at, 'doctor'::public.actor_kind, p.doctor_id,
         'prescription', p.id, 'Signed ' || p.kind::text, to_jsonb(p)
    from public.prescriptions p
  union all
  select cm.consult_id, cm.hospital_id, cm.created_at, 'patient'::public.actor_kind, cm.uploaded_by,
         'media', cm.id, cm.kind::text || ' ' || cm.mime_type, to_jsonb(cm)
    from public.consult_media cm;

-- ------------------------------------------------------------------------- RLS
alter table public.lab_results        enable row level security;
alter table public.lab_results        force  row level security;
alter table public.appointments       enable row level security;
alter table public.appointments       force  row level security;
alter table public.notifications      enable row level security;
alter table public.notifications      force  row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force  row level security;
alter table public.audit_log          enable row level security;
alter table public.audit_log          force  row level security;

create policy lab_results_patient_read on public.lab_results
  for select to authenticated using (patient_id = auth.uid());

create policy lab_results_doctor_read on public.lab_results
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

-- Inserted by create_lab_upload (§4.3 row 31), never by a raw client write.
revoke insert, update, delete on public.lab_results from anon, authenticated;

create policy appointments_patient_read on public.appointments
  for select to authenticated using (patient_id = auth.uid());

create policy appointments_doctor_rw on public.appointments
  for all to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]))
  with check (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy notifications_own_read on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

-- The recipient may mark it read; nothing else about a notice is client-writable.
create policy notifications_own_mark_read on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.notifications_only_read_at()
returns trigger language plpgsql as $$
begin
  if (new.id, new.hospital_id, new.recipient_id, new.consult_id, new.kind,
      new.title, new.body, new.deep_link, new.created_at)
     is distinct from
     (old.id, old.hospital_id, old.recipient_id, old.consult_id, old.kind,
      old.title, old.body, old.deep_link, old.created_at) then
    raise exception 'only read_at may be updated' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger t_notifications_only_read_at before update on public.notifications
  for each row execute function public.notifications_only_read_at();

revoke insert, delete on public.notifications from anon, authenticated;

create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- audit_log: operator only, and service_role is the only writer. No policy exists.
revoke all on public.audit_log from anon, authenticated;

grant select on public.consult_trace to authenticated;
