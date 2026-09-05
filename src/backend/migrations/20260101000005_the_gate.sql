-- 0005 — the approval gate (DATA-MODEL §2.16, §2.18-§2.20, §3.4).
-- Nothing in this file is a convention. `prescriptions.review_id` is NOT NULL
-- UNIQUE, the trigger asserts the review is approving and version-bound, and the
-- grants leave no client role — including service_role, which the AI path runs as —
-- with an insert path.

create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  consult_id      uuid not null references public.consults(id) on delete restrict,
  hospital_id     uuid not null references public.hospitals(id),
  doctor_id       uuid not null references public.profiles(id),
  draft_id        uuid not null references public.ai_drafts(id),
  draft_hash      text not null,
  action          public.review_action not null,
  reason          text,
  patient_message text,
  diff            jsonb not null default '{}'::jsonb,
  time_in_consult_ms int,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  unique (consult_id, idempotency_key),
  constraint reviews_reason_required
    check (action not in ('rejected','escalated') or reason is not null),
  constraint reviews_patient_message_required
    check (action <> 'rejected' or patient_message is not null)
);
create index reviews_consult on public.reviews (consult_id, created_at desc);
create trigger t_reviews_hospital before insert on public.reviews
  for each row execute function public.set_hospital_from_consult();
create trigger t_reviews_no_update before update on public.reviews
  for each row execute function public.reject_write();
create trigger t_reviews_no_delete before delete on public.reviews
  for each row execute function public.reject_write();

create table public.prescriptions (
  id                uuid primary key default gen_random_uuid(),
  consult_id        uuid not null references public.consults(id) on delete restrict,
  hospital_id       uuid not null references public.hospitals(id),
  patient_id        uuid not null references public.profiles(id),
  doctor_id         uuid not null references public.profiles(id),
  review_id         uuid not null unique references public.reviews(id) on delete restrict, -- ★ THE GATE
  kind              public.plan_kind not null,
  advice            text not null default '',
  edited_from_draft boolean not null default false,
  supersedes_id     uuid references public.prescriptions(id),
  superseded_at     timestamptz,
  pdf_path          text,
  approved_at       timestamptz not null default now()
);
create index prescriptions_patient on public.prescriptions (patient_id, approved_at desc);

create table public.prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete restrict,
  position        int not null,
  name            text not null,
  dosage          text not null default '',
  timing          text not null,
  duration        text,
  notes           text not null default '',
  why             text not null default '',
  detail          text not null default '',
  unique (prescription_id, position)
);

create table public.investigation_orders (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete restrict,
  consult_id      uuid not null references public.consults(id) on delete restrict,
  patient_id      uuid not null references public.profiles(id),
  hospital_id     uuid not null references public.hospitals(id),
  position        int not null,
  name            text not null,
  modality        public.investigation_modality not null default 'other',
  timing          text not null default '',
  why             text not null default '',
  status          public.order_status not null default 'ordered',
  scheduled_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (prescription_id, position)
);
create index investigation_orders_patient on public.investigation_orders (patient_id, created_at desc);

-- §3.4 layers 3 and 4: an approving review, by the same doctor, on the same
-- consult, still bound to the exact draft version that was signed.
create or replace function public.prescriptions_require_approving_review()
returns trigger language plpgsql as $$
declare r public.reviews%rowtype;
begin
  select * into r from public.reviews where id = new.review_id;
  if not found then
    raise exception 'prescription requires a review row' using errcode = 'check_violation';
  end if;
  if r.action not in ('approved','edited_approved') then
    raise exception 'prescription requires an approving review, got %', r.action
      using errcode = 'check_violation';
  end if;
  if r.doctor_id <> new.doctor_id or r.consult_id <> new.consult_id then
    raise exception 'prescription/review mismatch' using errcode = 'check_violation';
  end if;
  if r.draft_hash <> (select content_hash from public.ai_drafts where id = r.draft_id) then
    raise exception 'draft changed after signature' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger t_prescriptions_gate before insert on public.prescriptions
  for each row execute function public.prescriptions_require_approving_review();

-- Immutable after insert; only the async pdf_path and the supersede stamp move.
create or replace function public.prescriptions_immutable()
returns trigger language plpgsql as $$
begin
  if (new.id, new.consult_id, new.hospital_id, new.patient_id, new.doctor_id,
      new.review_id, new.kind, new.advice, new.edited_from_draft, new.approved_at)
     is distinct from
     (old.id, old.consult_id, old.hospital_id, old.patient_id, old.doctor_id,
      old.review_id, old.kind, old.advice, old.edited_from_draft, old.approved_at) then
    raise exception 'prescriptions are immutable; issue a superseding version'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger t_prescriptions_immutable before update on public.prescriptions
  for each row execute function public.prescriptions_immutable();
create trigger t_prescriptions_no_delete before delete on public.prescriptions
  for each row execute function public.reject_write();
create trigger t_prescription_items_no_update before update on public.prescription_items
  for each row execute function public.reject_write();
create trigger t_prescription_items_no_delete before delete on public.prescription_items
  for each row execute function public.reject_write();

-- §3.4 layer 5 — no client role holds a write grant on the clinical artefact. The
-- AI path runs as service_role and therefore has no path to this table at all.
revoke insert, update, delete on public.prescriptions        from anon, authenticated, service_role;
revoke insert, update, delete on public.prescription_items   from anon, authenticated, service_role;
revoke insert, update, delete on public.reviews              from anon, authenticated, service_role;

-- ------------------------------------------------------------------------- RLS
alter table public.reviews              enable row level security;
alter table public.reviews              force  row level security;
alter table public.prescriptions        enable row level security;
alter table public.prescriptions        force  row level security;
alter table public.prescription_items   enable row level security;
alter table public.prescription_items   force  row level security;
alter table public.investigation_orders enable row level security;
alter table public.investigation_orders force  row level security;

create policy reviews_doctor_read on public.reviews
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy prescriptions_patient_read on public.prescriptions
  for select to authenticated using (patient_id = auth.uid());

create policy prescriptions_doctor_read on public.prescriptions
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy prescription_items_patient_read on public.prescription_items
  for select to authenticated
  using (exists (select 1 from public.prescriptions p
                  where p.id = prescription_id and p.patient_id = auth.uid()));

create policy prescription_items_doctor_read on public.prescription_items
  for select to authenticated
  using (exists (select 1 from public.prescriptions p
                  where p.id = prescription_id
                    and public.has_hospital_role(p.hospital_id, array['doctor','admin']::public.member_role[])));

create policy investigation_orders_patient_read on public.investigation_orders
  for select to authenticated using (patient_id = auth.uid());

create policy investigation_orders_doctor_rw on public.investigation_orders
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

create policy investigation_orders_doctor_update on public.investigation_orders
  for update to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]))
  with check (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

revoke insert, delete on public.investigation_orders from anon, authenticated;
revoke update           on public.investigation_orders from anon;

-- Deferred from 0002: a patient may see the profile of the doctor who reviewed one
-- of their consults, and no other clinician.
create policy profiles_read_reviewing_doctor on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.reviews r
      join public.consults c on c.id = r.consult_id
     where r.doctor_id = public.profiles.id
       and c.patient_id = auth.uid()));

create policy clinician_details_read_reviewing on public.clinician_details
  for select to authenticated
  using (exists (
    select 1 from public.reviews r
      join public.consults c on c.id = r.consult_id
     where r.doctor_id = public.clinician_details.profile_id
       and c.patient_id = auth.uid()));

-- §3.6: the patient sees the decision, not the signature machinery. Column
-- narrowing is a view, since RLS narrows rows only.
create view public.my_review_outcomes as
  select r.id, r.consult_id, r.action, r.reason, r.patient_message, r.created_at
    from public.reviews r
    join public.consults c on c.id = r.consult_id
   where c.patient_id = auth.uid();

grant select on public.my_review_outcomes to authenticated;
