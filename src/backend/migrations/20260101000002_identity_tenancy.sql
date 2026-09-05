-- 0002 — tenancy and identity (DATA-MODEL §2.1-§2.5) with the §3.6 policies.
-- Every table gets `enable` + `force` row level security; policies are additive
-- grants over a default deny.

create table public.hospitals (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                text not null,
  logo_url            text,
  theme               jsonb not null default '{}'::jsonb,
  ai_config           jsonb not null default '{}'::jsonb,
  admin_contact_email text,
  created_at          timestamptz not null default now(),
  active              boolean not null default true
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        extensions.citext not null unique,
  kind         public.profile_kind not null,
  avatar_path  text,
  locale       text not null default 'en-IN',
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  role        public.member_role not null,
  status      public.member_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (profile_id, hospital_id)
);
create index memberships_lookup on public.memberships (profile_id, hospital_id) where status = 'active';

-- ------------------------------------------------------------- tenancy helpers
-- "own hospital" (§3.6): the hospitals where the caller holds an active membership.
-- SECURITY DEFINER on purpose — a policy on `memberships` that queried
-- `memberships` would recurse. These are the single place tenancy is resolved.
create or replace function public.my_hospital_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select m.hospital_id
    from public.memberships m
   where m.profile_id = auth.uid()
     and m.status = 'active';
$fn$;

create or replace function public.is_hospital_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.memberships m
     where m.profile_id = auth.uid() and m.hospital_id = h and m.status = 'active');
$fn$;

create or replace function public.has_hospital_role(h uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.memberships m
     where m.profile_id = auth.uid()
       and m.hospital_id = h
       and m.status = 'active'
       and m.role = any(roles));
$fn$;

revoke execute on function public.my_hospital_ids()                             from public;
revoke execute on function public.is_hospital_member(uuid)                      from public;
revoke execute on function public.has_hospital_role(uuid, public.member_role[]) from public;
grant  execute on function public.my_hospital_ids()                             to authenticated, service_role;
grant  execute on function public.is_hospital_member(uuid)                      to authenticated, service_role;
grant  execute on function public.has_hospital_role(uuid, public.member_role[]) to authenticated, service_role;

create table public.patient_details (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  dob           date not null,
  sex           public.sex_at_birth not null,
  blood_group   text check (blood_group is null or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies     jsonb not null default '[]'::jsonb,
  conditions    jsonb not null default '[]'::jsonb,
  medications   jsonb not null default '[]'::jsonb,
  self_attested boolean not null default true,
  updated_at    timestamptz not null default now(),
  -- PRD §3A.5: adults only. current_date is stable-not-immutable, so this is a
  -- trigger rather than a CHECK.
  constraint patient_details_dob_past check (dob < '2100-01-01'::date)
);

create or replace function public.enforce_patient_adult()
returns trigger language plpgsql as $$
begin
  if new.dob > current_date - interval '18 years' then
    raise exception 'patient must be 18 or older' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger t_patient_details_adult
  before insert or update of dob on public.patient_details
  for each row execute function public.enforce_patient_adult();

create table public.clinician_details (
  profile_id             uuid primary key references public.profiles(id) on delete cascade,
  registration_no        text not null,
  registration_authority text not null,
  specialty              text not null,
  languages              text[] not null default '{}',
  years_experience       int,
  signature_path         text,
  prefs                  jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

-- A profile row per auth user, so identity is never derived from user_metadata
-- (the defect at apps/web/src/shell/auth.tsx:53).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, email, kind)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.email,
          coalesce((new.raw_user_meta_data->>'kind')::public.profile_kind, 'patient'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger t_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- §4.1 row 1
-- Anonymous branding lookup. A view, because "public columns only" is a column
-- projection and RLS cannot narrow columns.
create view public.hospitals_public as
  select id, slug, name, logo_url, theme from public.hospitals where active;

-- §3.6 profiles/clinician_details, patient side: the *reviewing* doctor's card.
create view public.doctor_card
with (security_invoker = on) as
  select p.id as doctor_id, p.full_name, cd.specialty, cd.registration_no
    from public.profiles p
    left join public.clinician_details cd on cd.profile_id = p.id
   where p.kind = 'clinician';

-- ------------------------------------------------------------------------- RLS
alter table public.hospitals         enable row level security;
alter table public.hospitals         force  row level security;
alter table public.profiles          enable row level security;
alter table public.profiles          force  row level security;
alter table public.memberships       enable row level security;
alter table public.memberships       force  row level security;
alter table public.patient_details   enable row level security;
alter table public.patient_details   force  row level security;
alter table public.clinician_details enable row level security;
alter table public.clinician_details force  row level security;

create policy hospitals_read_own on public.hospitals
  for select to authenticated
  using (id in (select public.my_hospital_ids()));

create policy profiles_read_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- (The patient-sees-their-reviewing-doctor policy needs `reviews`, so it is added
-- in 0005 where that table is created.)

-- (profiles_read_hospital_patients needs `consults`, so it is added in 0003.)

create policy memberships_read_own on public.memberships
  for select to authenticated using (profile_id = auth.uid());

create policy memberships_read_hospital on public.memberships
  for select to authenticated
  using (public.has_hospital_role(hospital_id, array['doctor','admin']::public.member_role[]));

-- No insert/update/delete policy exists for memberships: role assignment is never
-- client-writable. service_role writes it (it bypasses RLS) and nobody else can.
revoke insert, update, delete on public.memberships from anon, authenticated;

create policy patient_details_rw_own on public.patient_details
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- (patient_details_read_treating needs `consults`, so it is added in 0003.)

create policy clinician_details_rw_own on public.clinician_details
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy clinician_details_read_hospital on public.clinician_details
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
     where m.profile_id = public.clinician_details.profile_id
       and m.status = 'active'
       and m.hospital_id in (select public.my_hospital_ids())));

grant select on public.hospitals_public to anon, authenticated;
grant select on public.doctor_card      to authenticated;
