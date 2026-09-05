-- 0003 — the consult, the state machine, the transcript and the trace
-- (DATA-MODEL §2.6-§2.10, §3.2, §3.5, §3.6).

create table public.consults (
  id                   uuid primary key default gen_random_uuid(),
  hospital_id          uuid not null references public.hospitals(id),
  patient_id           uuid not null references public.profiles(id),
  status               public.consult_status not null default 'active',
  chief_complaint      text,
  urgency              public.urgency not null default 'routine',
  channel_mix          jsonb not null default '{}'::jsonb,
  working_dx           jsonb not null default '[]'::jsonb,
  protocol_version_id  uuid,
  assigned_doctor_id   uuid references public.profiles(id),
  sla_warned_at        timestamptz,
  created_at           timestamptz not null default now(),
  submitted_at         timestamptz,
  decided_at           timestamptz,
  closed_at            timestamptz,
  last_patient_turn_at timestamptz
);

create index consults_queue   on public.consults (hospital_id, status, urgency desc, submitted_at asc);
create index consults_patient on public.consults (patient_id, created_at desc);
create unique index consults_one_open on public.consults (patient_id, hospital_id)
  where status in ('active','pending_review','needs_human');
create index consults_sla     on public.consults (submitted_at)         where status = 'pending_review';
create index consults_abandon on public.consults (last_patient_turn_at) where status = 'active';

-- Deferred from 0002: true when the caller is a clinician of a hospital where `p`
-- has a consult (§3.6 "read patients with a consult in own hospital").
create or replace function public.shares_consult_with(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
      from public.consults c
      join public.memberships m
        on m.hospital_id = c.hospital_id
       and m.profile_id = auth.uid()
       and m.status = 'active'
       and m.role in ('doctor','admin')
     where c.patient_id = p);
$fn$;

revoke execute on function public.shares_consult_with(uuid) from public;
grant  execute on function public.shares_consult_with(uuid) to authenticated, service_role;

create policy profiles_read_hospital_patients on public.profiles
  for select to authenticated
  using (public.shares_consult_with(public.profiles.id));

create policy patient_details_read_treating on public.patient_details
  for select to authenticated using (public.shares_consult_with(profile_id));

create table public.consult_events (
  id          uuid primary key default gen_random_uuid(),
  consult_id  uuid not null references public.consults(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id),
  event_type  public.consult_event_type not null,
  actor       public.actor_kind not null,
  actor_id    uuid references public.profiles(id),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index consult_events_time on public.consult_events (consult_id, created_at);

-- §3.2 — the allowlist is a table, readable by the client (§4.3 row 32) so the UI
-- derives legal actions from the same source the database enforces.
create table public.consult_transitions (
  from_status   public.consult_status not null,
  to_status     public.consult_status not null,
  allowed_actor public.actor_kind not null,
  primary key (from_status, to_status, allowed_actor)
);

insert into public.consult_transitions (from_status, to_status, allowed_actor) values
  ('active','pending_review','ai'),        ('active','pending_review','patient'),
  ('active','needs_human','ai'),           ('active','needs_human','system'),
  ('active','abandoned','system'),
  ('pending_review','approved','doctor'),  ('pending_review','rejected','doctor'),
  ('pending_review','escalated','doctor'), ('pending_review','expired','system'),
  ('pending_review','needs_human','system'),
  ('needs_human','approved','doctor'),     ('needs_human','rejected','doctor'),
  ('needs_human','escalated','doctor'),    ('needs_human','expired','system'),
  ('approved','communicated','system'),    ('communicated','closed','system'),
  ('approved','superseded','doctor'),
  ('rejected','closed','system'),          ('escalated','closed','system');

-- A CHECK cannot see OLD.status; a trigger can. The same trigger writes the
-- status_change event, so no path can move a consult without leaving a trace row.
create or replace function public.enforce_consult_transition()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    if not exists (select 1 from public.consult_transitions t
                    where t.from_status = old.status
                      and t.to_status   = new.status
                      and t.allowed_actor = public.current_actor()) then
      raise exception 'illegal consult transition % -> % by %',
        old.status, new.status, coalesce(public.current_actor()::text, '<unset>')
        using errcode = 'check_violation';
    end if;

    insert into public.consult_events (consult_id, hospital_id, event_type, actor, actor_id, payload)
    values (new.id, new.hospital_id, 'status_change',
            public.current_actor(), public.current_actor_id(),
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

create trigger t_consults_transition
  before update on public.consults
  for each row execute function public.enforce_consult_transition();

create table public.consult_messages (
  id          uuid primary key default gen_random_uuid(),
  consult_id  uuid not null references public.consults(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id),
  seq         bigint not null,
  sender      public.message_sender not null,
  agent_id    text,
  channel     public.message_channel not null,
  content     text not null,
  is_interim  boolean not null default false,
  audio_path  text,
  audio_ms    int,
  created_at  timestamptz not null default now()
);
create unique index consult_messages_seq on public.consult_messages (consult_id, seq);
-- The regconfig cast is required: to_tsvector(text, text) is only STABLE, and an
-- expression index needs IMMUTABLE.
create index consult_messages_fts on public.consult_messages
  using gin (to_tsvector('english'::regconfig, content));

create table public.consult_slots (
  id                  uuid primary key default gen_random_uuid(),
  consult_id          uuid not null references public.consults(id) on delete restrict,
  slot_id             public.slot_id not null,
  status              public.slot_status not null default 'unknown',
  value               text,
  confidence          numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source              public.slot_source not null default 'patient',
  evidence_message_id uuid references public.consult_messages(id),
  evidence_span       int[],
  attempts            int not null default 0 check (attempts <= 2),
  updated_at          timestamptz not null default now(),
  unique (consult_id, slot_id),
  constraint consult_slots_filled_has_value check (status <> 'filled' or value is not null)
);

create table public.consult_media (
  id           uuid primary key default gen_random_uuid(),
  consult_id   uuid not null references public.consults(id) on delete restrict,
  hospital_id  uuid not null references public.hospitals(id),
  uploaded_by  uuid not null references public.profiles(id),
  kind         public.media_kind not null,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','video/mp4')),
  bytes        bigint not null check (bytes <= 10485760),
  sha256       text not null,
  ai_findings  jsonb,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- hospital_id is denormalized onto every consult-scoped child so no policy needs a
-- join (§3.1); this trigger is what keeps it honest.
create or replace function public.set_hospital_from_consult()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare h uuid;
begin
  select c.hospital_id into h from public.consults c where c.id = new.consult_id;
  if h is null then raise exception 'unknown consult %', new.consult_id; end if;
  new.hospital_id := h;
  return new;
end $$;

create trigger t_consult_messages_hospital before insert on public.consult_messages
  for each row execute function public.set_hospital_from_consult();
create trigger t_consult_events_hospital   before insert on public.consult_events
  for each row execute function public.set_hospital_from_consult();
create trigger t_consult_media_hospital    before insert on public.consult_media
  for each row execute function public.set_hospital_from_consult();

-- Gapless per-consult ordering without a client-supplied seq.
create or replace function public.set_message_seq()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.seq is null then
    select coalesce(max(m.seq), 0) + 1 into new.seq
      from public.consult_messages m where m.consult_id = new.consult_id;
  end if;
  return new;
end $$;

create trigger t_consult_messages_seq before insert on public.consult_messages
  for each row execute function public.set_message_seq();

-- ------------------------------------------------------- append-only enforcement
create or replace function public.reject_write()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end $$;

create trigger t_consult_messages_no_update before update on public.consult_messages
  for each row execute function public.reject_write();
create trigger t_consult_messages_no_delete before delete on public.consult_messages
  for each row execute function public.reject_write();
create trigger t_consult_events_no_update   before update on public.consult_events
  for each row execute function public.reject_write();
create trigger t_consult_events_no_delete   before delete on public.consult_events
  for each row execute function public.reject_write();

-- ------------------------------------------------------------------------- RLS
alter table public.consults            enable row level security;
alter table public.consults            force  row level security;
alter table public.consult_events      enable row level security;
alter table public.consult_events      force  row level security;
alter table public.consult_messages    enable row level security;
alter table public.consult_messages    force  row level security;
alter table public.consult_slots       enable row level security;
alter table public.consult_slots       force  row level security;
alter table public.consult_media       enable row level security;
alter table public.consult_media       force  row level security;
alter table public.consult_transitions enable row level security;
alter table public.consult_transitions force  row level security;

-- consults: patient reads own; **no insert policy** — start_consult (§4.1 row 4) is
-- the only way in. Doctors read and update their own hospital's.
create policy consults_patient_read on public.consults
  for select to authenticated using (patient_id = auth.uid());

create policy consults_doctor_read on public.consults
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy consults_doctor_update on public.consults
  for update to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]))
  with check (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

revoke insert, delete on public.consults from anon, authenticated;

-- consult_messages: a patient may append their own turns and nothing else. There is
-- no way for a client to write a row whose sender is 'ai'.
create policy consult_messages_patient_read on public.consult_messages
  for select to authenticated
  using (exists (select 1 from public.consults c
                  where c.id = consult_id and c.patient_id = auth.uid()));

create policy consult_messages_patient_insert on public.consult_messages
  for insert to authenticated
  with check (sender = 'patient'
              and is_interim = false
              and exists (select 1 from public.consults c
                           where c.id = consult_id
                             and c.patient_id = auth.uid()
                             and c.status = 'active'));

create policy consult_messages_doctor_read on public.consult_messages
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

-- consult_events: doctors read their hospital's; nobody but service_role writes.
create policy consult_events_doctor_read on public.consult_events
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

revoke insert, update, delete on public.consult_events from anon, authenticated;

-- consult_slots: read-only to both sides; the AI path is the only writer.
create policy consult_slots_patient_read on public.consult_slots
  for select to authenticated
  using (exists (select 1 from public.consults c
                  where c.id = consult_id and c.patient_id = auth.uid()));

create policy consult_slots_doctor_read on public.consult_slots
  for select to authenticated
  using (exists (select 1 from public.consults c
                  where c.id = consult_id
                    and public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[])));

revoke insert, update, delete on public.consult_slots from anon, authenticated;

create policy consult_media_patient_rw on public.consult_media
  for select to authenticated
  using (exists (select 1 from public.consults c
                  where c.id = consult_id and c.patient_id = auth.uid()));

create policy consult_media_patient_insert on public.consult_media
  for insert to authenticated
  with check (uploaded_by = auth.uid()
              and exists (select 1 from public.consults c
                           where c.id = consult_id
                             and c.patient_id = auth.uid()
                             and c.status = 'active'));

create policy consult_media_doctor_read on public.consult_media
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

revoke update, delete on public.consult_media from anon, authenticated;

-- The allowlist itself is world-readable to any authenticated caller (§4.3 row 32).
create policy consult_transitions_read on public.consult_transitions
  for select to authenticated using (true);
revoke insert, update, delete on public.consult_transitions from anon, authenticated;
