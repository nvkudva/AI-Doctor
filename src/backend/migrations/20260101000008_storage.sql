-- 0008 — the six buckets of DATA-MODEL §5.1, the §5.2 path convention helper, and
-- the §5.3 per-bucket policies. Every key starts with the hospital id, so a policy
-- decides access from the path alone with no join.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tenant-assets',     'tenant-assets',     true,   2097152, array['image/svg+xml','image/png','image/webp']),
  ('avatars',           'avatars',           false,  2097152, array['image/jpeg','image/png','image/webp']),
  ('consult-media',     'consult-media',     false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4']),
  ('consult-audio',     'consult-audio',     false, 26214400, array['audio/webm','audio/ogg','audio/mpeg']),
  ('lab-reports',       'lab-reports',       false, 20971520, array['application/pdf','image/jpeg','image/png']),
  ('prescription-pdfs', 'prescription-pdfs', false,  2097152, array['application/pdf'])
on conflict (id) do nothing;

-- §5.2 — one helper, used by every policy.
create or replace function public.storage_hospital_id(name text)
returns uuid language sql immutable as $$
  select nullif(split_part(name, '/', 1), '')::uuid;
$$;

create or replace function public.storage_second_segment(name text)
returns uuid language sql immutable as $$
  select nullif(split_part(name, '/', 2), '')::uuid;
$$;

grant execute on function public.storage_hospital_id(text)   to authenticated, anon, service_role;
grant execute on function public.storage_second_segment(text) to authenticated, anon, service_role;

-- ------------------------------------------------------------- tenant-assets
-- Public read; writes are operator-only, which means service_role — no policy.
create policy "tenant assets are world readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'tenant-assets');

-- -------------------------------------------------------------------- avatars
create policy "avatar owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.storage_second_segment(name) = auth.uid());

create policy "treating clinician reads avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars'
         and public.shares_consult_with(public.storage_second_segment(name)));

create policy "avatar owner writes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars'
              and public.storage_second_segment(name) = auth.uid()
              and public.is_hospital_member(public.storage_hospital_id(name)));

create policy "avatar owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.storage_second_segment(name) = auth.uid());

create policy "avatar owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_second_segment(name) = auth.uid());

-- -------------------------------------------------------------- consult-media
create policy "consult media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'consult-media' and exists (
    select 1 from public.consults c
     where c.id = public.storage_second_segment(name)
       and (c.patient_id = auth.uid()
            or public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[]))));

-- The patient may write, and only while the consult is still active (§5.3).
create policy "consult media write while active" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'consult-media' and exists (
    select 1 from public.consults c
     where c.id = public.storage_second_segment(name)
       and c.patient_id = auth.uid()
       and c.status = 'active'
       and c.hospital_id = public.storage_hospital_id(name)));

-- No delete policy on consult-media, consult-audio, lab-reports or
-- prescription-pdfs: deletion is the retention job's, never a user's (§5.4).

-- -------------------------------------------------------------- consult-audio
create policy "consult audio read" on storage.objects
  for select to authenticated
  using (bucket_id = 'consult-audio' and exists (
    select 1 from public.consults c
     where c.id = public.storage_second_segment(name)
       and (c.patient_id = auth.uid()
            or public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[]))));
-- Writes: service_role only, so no insert policy exists.

-- ---------------------------------------------------------------- lab-reports
create policy "lab report read" on storage.objects
  for select to authenticated
  using (bucket_id = 'lab-reports'
         and (public.storage_second_segment(name) = auth.uid()
              or public.has_hospital_role(public.storage_hospital_id(name),
                                          array['doctor','admin']::public.member_role[])));

create policy "lab report write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lab-reports'
              and (public.storage_second_segment(name) = auth.uid()
                   or public.has_hospital_role(public.storage_hospital_id(name),
                                               array['doctor','admin']::public.member_role[]))
              -- the row must already have been reserved by create_lab_upload (§4.3 #31)
              and exists (select 1 from public.lab_results l where l.report_path = name));

-- ---------------------------------------------------------- prescription-pdfs
create policy "prescription pdf read" on storage.objects
  for select to authenticated
  using (bucket_id = 'prescription-pdfs' and exists (
    select 1 from public.prescriptions p
     where p.pdf_path = name
       and (p.patient_id = auth.uid()
            or public.has_hospital_role(p.hospital_id, array['doctor','admin']::public.member_role[]))));
-- Writes: service_role only (rendered after approval), so no insert policy exists.

-- ------------------------------------------------------- §5.4 retention sweep
-- Audio is off by default; a hospital that opts in sets
-- ai_config.audio_retention_days. Every batch leaves an audit row.
create or replace function public.run_storage_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_deleted int := 0; r record;
begin
  for r in
    select o.id, o.name, public.storage_hospital_id(o.name) as hospital_id
      from storage.objects o
      join public.hospitals h on h.id = public.storage_hospital_id(o.name)
     where o.bucket_id = 'consult-audio'
       and coalesce((h.ai_config->>'audio_retention_days')::int, 0) > 0
       and o.created_at < now() - make_interval(days => (h.ai_config->>'audio_retention_days')::int)
  loop
    delete from storage.objects where id = r.id;
    v_deleted := v_deleted + 1;
  end loop;

  if v_deleted > 0 then
    insert into public.audit_log (actor_role, action, target_kind, detail)
    values ('system', 'storage.retention_swept', 'bucket',
            jsonb_build_object('bucket', 'consult-audio', 'deleted', v_deleted));
  end if;

  return jsonb_build_object('deleted', v_deleted);
end $$;

revoke execute on function public.run_storage_retention() from public, anon, authenticated;
grant  execute on function public.run_storage_retention() to service_role;
