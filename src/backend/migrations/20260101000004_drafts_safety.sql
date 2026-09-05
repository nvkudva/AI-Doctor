-- 0004 — versioned drafts with the generated content hash, server-authoritative
-- safety checks, the protocol registry, the coordinator conversation and the cost
-- ledger (DATA-MODEL §2.11-§2.15, §2.17, §3.3, §3.6).

create table public.protocol_versions (
  id              uuid primary key default gen_random_uuid(),
  complaint_key   text not null,
  version         text not null,
  content_hash    text not null,
  clinician_owner text,
  approved_at     timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (complaint_key, version)
);

alter table public.consults
  add constraint consults_protocol_fk
  foreign key (protocol_version_id) references public.protocol_versions(id);

create table public.ai_drafts (
  id                    uuid primary key default gen_random_uuid(),
  consult_id            uuid not null references public.consults(id) on delete restrict,
  hospital_id           uuid not null references public.hospitals(id),
  version               int not null check (version >= 1),
  supersedes_id         uuid references public.ai_drafts(id),
  superseded_at         timestamptz,
  created_by            text not null,
  created_for_doctor_id uuid references public.profiles(id),
  recommendation        jsonb not null,
  note                  text not null,
  confidence            public.confidence not null,
  flags                 jsonb not null default '[]'::jsonb,
  unanswered_slots      text[] not null default '{}',
  raw_response          jsonb not null default '{}'::jsonb,
  model                 text not null,
  protocol_version_id   uuid references public.protocol_versions(id),
  prompt_version        text not null,
  -- The version-binding token. Stored generated, so the hash a doctor signs cannot
  -- drift from the content it hashes (§3.3).
  content_hash          text generated always as (
                          'sha256:' || encode(
                            extensions.digest(recommendation::text || coalesce(note, ''), 'sha256'),
                            'hex')) stored,
  created_at            timestamptz not null default now(),
  unique (consult_id, version)
);

-- Exactly one live draft per consult.
create unique index ai_drafts_current on public.ai_drafts (consult_id) where superseded_at is null;

-- AGENT-EXPERIENCE §5.7 — a flag the model authored can never reach a doctor's
-- screen. `source` may only be 'validator'.
create or replace function public.validate_draft_flags()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from jsonb_array_elements(new.flags) f
              where coalesce(f->>'source', '') <> 'validator') then
    raise exception 'ai_drafts.flags[].source must be ''validator''' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger t_ai_drafts_validator_flags
  before insert or update of flags on public.ai_drafts
  for each row execute function public.validate_draft_flags();

-- Drafts are append-only versions: the only mutable column is superseded_at.
create or replace function public.ai_drafts_immutable()
returns trigger language plpgsql as $$
begin
  if (new.recommendation, new.note, new.version, new.consult_id, new.confidence, new.flags)
     is distinct from
     (old.recommendation, old.note, old.version, old.consult_id, old.confidence, old.flags) then
    raise exception 'ai_drafts content is immutable; insert a new version'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger t_ai_drafts_immutable before update on public.ai_drafts
  for each row execute function public.ai_drafts_immutable();
create trigger t_ai_drafts_no_delete  before delete on public.ai_drafts
  for each row execute function public.reject_write();

create table public.safety_checks (
  id              uuid primary key default gen_random_uuid(),
  draft_id        uuid references public.ai_drafts(id),
  consult_id      uuid not null references public.consults(id) on delete restrict,
  hospital_id     uuid not null references public.hospitals(id),
  item_name       text not null,
  check_kind      public.safety_check_kind not null,
  verdict         public.safety_verdict not null,
  detail          text not null,
  ruleset_version text not null,
  created_at      timestamptz not null default now()
);
create index safety_checks_draft on public.safety_checks (draft_id);
create trigger t_safety_checks_hospital before insert on public.safety_checks
  for each row execute function public.set_hospital_from_consult();

create table public.agent_invocations (
  id                  uuid primary key default gen_random_uuid(),
  consult_id          uuid references public.consults(id),
  hospital_id         uuid not null references public.hospitals(id),
  agent_id            text not null,
  mode                public.agent_mode not null,
  model               text not null,
  input_tokens        int not null default 0,
  cached_input_tokens int not null default 0,
  output_tokens       int not null default 0,
  audio_seconds       numeric(8,2) not null default 0,
  latency_ms          int not null default 0,
  stop_reason         text not null,
  cost_usd            numeric(10,6) not null default 0,
  created_at          timestamptz not null default now()
);
create index agent_invocations_quota on public.agent_invocations (hospital_id, created_at desc);

create table public.review_messages (
  id          uuid primary key default gen_random_uuid(),
  consult_id  uuid not null references public.consults(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id),
  doctor_id   uuid not null references public.profiles(id),
  seq         bigint not null,
  sender      public.review_sender not null,
  channel     public.message_channel not null,
  content     text not null,
  citations   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (consult_id, doctor_id, seq)
);
create trigger t_review_messages_hospital before insert on public.review_messages
  for each row execute function public.set_hospital_from_consult();

create table public.mira_feedback (
  id              uuid primary key default gen_random_uuid(),
  hospital_id     uuid not null references public.hospitals(id),
  doctor_id       uuid not null references public.profiles(id),
  consult_id      uuid references public.consults(id),
  category        public.feedback_category not null,
  feedback        text not null,
  operator_status public.feedback_status not null default 'new',
  created_at      timestamptz not null default now()
);

-- §3.6: the patient sees a draft summary, never raw_response. RLS narrows rows, not
-- columns, so the patient's read path is a definer view that projects the summary
-- columns and filters to their own current draft.
create view public.my_current_draft as
  select d.id, d.consult_id, d.version, d.recommendation, d.note, d.confidence,
         d.flags, d.unanswered_slots, d.model, d.prompt_version, d.content_hash, d.created_at
    from public.ai_drafts d
    join public.consults c on c.id = d.consult_id
   where c.patient_id = auth.uid()
     and d.superseded_at is null;

-- ------------------------------------------------------------------------- RLS
alter table public.protocol_versions enable row level security;
alter table public.protocol_versions force  row level security;
alter table public.ai_drafts         enable row level security;
alter table public.ai_drafts         force  row level security;
alter table public.safety_checks     enable row level security;
alter table public.safety_checks     force  row level security;
alter table public.agent_invocations enable row level security;
alter table public.agent_invocations force  row level security;
alter table public.review_messages   enable row level security;
alter table public.review_messages   force  row level security;
alter table public.mira_feedback     enable row level security;
alter table public.mira_feedback     force  row level security;

create policy protocol_versions_read on public.protocol_versions
  for select to authenticated using (true);
revoke insert, update, delete on public.protocol_versions from anon, authenticated;

create policy ai_drafts_doctor_read on public.ai_drafts
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

-- No client insert/update: drafts come from the AI path (service_role) or from
-- revise_draft (§4.2 row 21), which is SECURITY DEFINER.
revoke insert, update, delete on public.ai_drafts from anon, authenticated;

create policy safety_checks_doctor_read on public.safety_checks
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));
revoke insert, update, delete on public.safety_checks from anon, authenticated;

-- agent_invocations: operator only. No policy at all => default deny for clients.
revoke all on public.agent_invocations from anon, authenticated;

create policy review_messages_doctor_read on public.review_messages
  for select to authenticated
  using (doctor_id = auth.uid()
         and public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy review_messages_doctor_insert on public.review_messages
  for insert to authenticated
  with check (doctor_id = auth.uid() and sender = 'doctor'
              and exists (select 1 from public.consults c
                           where c.id = consult_id
                             and public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[])));
revoke update, delete on public.review_messages from anon, authenticated;

create policy mira_feedback_doctor_rw on public.mira_feedback
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy mira_feedback_doctor_insert on public.mira_feedback
  for insert to authenticated
  with check (doctor_id = auth.uid()
              and public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));
revoke update, delete on public.mira_feedback from anon, authenticated;

grant select on public.my_current_draft to authenticated;
