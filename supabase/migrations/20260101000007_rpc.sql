-- 0007 — the (R) rows of DATA-MODEL §4: Postgres functions, SECURITY DEFINER where
-- the write carries privilege the caller does not have, each one a transaction.
--
-- Error convention: SQLSTATEs of the form PTnnn are mapped by PostgREST to HTTP
-- status nnn. MESSAGE carries the envelope's `code`, DETAIL its `message`, HINT the
-- `retryable` flag — see README "Error envelope".

-- ------------------------------------------------- the allergy-class map (§5.2)
create table public.drug_class_map (
  drug_name       extensions.citext primary key,
  drug_class      text not null,
  ruleset_version text not null default 'allergy-map-2026.08'
);
alter table public.drug_class_map enable row level security;
alter table public.drug_class_map force  row level security;
create policy drug_class_map_read on public.drug_class_map for select to authenticated using (true);
revoke insert, update, delete on public.drug_class_map from anon, authenticated;

insert into public.drug_class_map (drug_name, drug_class) values
  ('benzylpenicillin','beta_lactam'), ('phenoxymethylpenicillin','beta_lactam'),
  ('amoxicillin','beta_lactam'), ('ampicillin','beta_lactam'),
  ('flucloxacillin','beta_lactam'), ('co-amoxiclav','beta_lactam'),
  ('piperacillin-tazobactam','beta_lactam'), ('penicillin','beta_lactam'),
  ('cefalexin','cephalosporin'), ('ceftriaxone','cephalosporin'), ('cefuroxime','cephalosporin'),
  ('sumatriptan','triptan'), ('loratadine','antihistamine'), ('cetirizine','antihistamine'),
  ('hydrocortisone 1% cream','topical_corticosteroid'), ('ibuprofen','nsaid'), ('aspirin','nsaid');

-- Server-authoritative. A string match on "penicillin" catches none of the family,
-- which is why this resolves through a class map and not through a prompt.
create or replace function public.check_drug_safety(p_consult_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_patient uuid;
  v_allergies jsonb;
  v_item jsonb;
  v_name text;
  v_class text;
  v_verdict public.safety_verdict;
  v_detail text;
  v_out jsonb := '[]'::jsonb;
begin
  select c.patient_id into v_patient from public.consults c where c.id = p_consult_id;
  if v_patient is null then
    raise exception 'consult_not_found' using errcode = 'PT404', detail = 'unknown consult';
  end if;
  select coalesce(pd.allergies, '[]'::jsonb) into v_allergies
    from public.patient_details pd where pd.profile_id = v_patient;
  v_allergies := coalesce(v_allergies, '[]'::jsonb);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := coalesce(v_item->>'name', '');
    select m.drug_class into v_class from public.drug_class_map m where m.drug_name = v_name;

    if v_class is not null and exists (
         select 1 from jsonb_array_elements(v_allergies) a where a->>'class' = v_class) then
      v_verdict := 'block';
      v_detail := v_name || ' is ' || v_class || '; the record carries an allergy in that class.';
    elsif v_class = 'cephalosporin' and exists (
         select 1 from jsonb_array_elements(v_allergies) a where a->>'class' = 'beta_lactam') then
      v_verdict := 'caution';
      v_detail := 'Cephalosporin with a recorded beta-lactam allergy: cross-reactivity possible.';
    else
      v_verdict := 'clear';
      v_detail := 'No class match against ' || jsonb_array_length(v_allergies) || ' recorded allergies.';
    end if;

    insert into public.safety_checks (consult_id, item_name, check_kind, verdict, detail, ruleset_version)
    values (p_consult_id, v_name, 'allergy_class', v_verdict, v_detail, 'allergy-map-2026.08');

    v_out := v_out || jsonb_build_object('item', v_name, 'verdict', v_verdict, 'reason', v_detail);
  end loop;

  return v_out;
end $$;

-- ------------------------------------------------------------------ §4.1 row 4
create or replace function public.start_consult(p_hospital_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_open public.consults%rowtype; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = 'PT401';
  end if;
  if not public.has_hospital_role(p_hospital_id, array['patient']::public.member_role[]) then
    raise exception 'not_a_patient_here' using errcode = 'PT403',
      detail = 'no active patient membership at this hospital';
  end if;

  select * into v_open from public.consults
   where patient_id = auth.uid() and hospital_id = p_hospital_id
     and status in ('active','pending_review','needs_human')
   for update;

  if found then
    if v_open.status = 'active' then
      return jsonb_build_object('consult_id', v_open.id, 'status', v_open.status, 'resumed', true);
    end if;
    raise exception 'consult_open_not_resumable' using errcode = 'PT409',
      detail = 'an open consult is already awaiting review';
  end if;

  insert into public.consults (hospital_id, patient_id, status, last_patient_turn_at)
  values (p_hospital_id, auth.uid(), 'active', now())
  returning id into v_id;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, actor_id, payload)
  values (v_id, p_hospital_id, 'system', 'patient', auth.uid(), jsonb_build_object('reason','consult_started'));

  return jsonb_build_object('consult_id', v_id, 'status', 'active', 'resumed', false);
end $$;

-- ------------------------------------------------------------------ §4.2 row 19
create or replace function public.open_consult(p_consult_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; v_bundle jsonb;
begin
  select * into c from public.consults where id = p_consult_id;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403', detail = 'not a clinician of this hospital';
  end if;

  if c.assigned_doctor_id is null then
    update public.consults set assigned_doctor_id = auth.uid() where id = c.id;
  end if;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, actor_id, payload)
  values (c.id, c.hospital_id, 'doctor_opened', 'doctor', auth.uid(), '{}'::jsonb);

  select jsonb_build_object(
    'consult', to_jsonb(c2),
    'patient', (select jsonb_build_object('profile', to_jsonb(p), 'details', to_jsonb(pd))
                  from public.profiles p
                  left join public.patient_details pd on pd.profile_id = p.id
                 where p.id = c.patient_id),
    'draft',    (select to_jsonb(d) from public.ai_drafts d
                  where d.consult_id = c.id and d.superseded_at is null),
    'slots',    (select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_id), '[]'::jsonb)
                   from public.consult_slots s where s.consult_id = c.id),
    'messages', (select coalesce(jsonb_agg(to_jsonb(m) order by m.seq), '[]'::jsonb)
                   from public.consult_messages m where m.consult_id = c.id),
    'safety',   (select coalesce(jsonb_agg(to_jsonb(sc) order by sc.created_at), '[]'::jsonb)
                   from public.safety_checks sc where sc.consult_id = c.id),
    'labs',     (select coalesce(jsonb_agg(to_jsonb(l) order by l.observed_at desc), '[]'::jsonb)
                   from public.lab_results l
                  where l.patient_id = c.patient_id and l.hospital_id = c.hospital_id),
    'prior_consults', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', pc.id, 'chief_complaint', pc.chief_complaint,
                          'status', pc.status, 'created_at', pc.created_at) order by pc.created_at desc), '[]'::jsonb)
                   from public.consults pc
                  where pc.patient_id = c.patient_id and pc.hospital_id = c.hospital_id and pc.id <> c.id)
  ) into v_bundle
  from public.consults c2 where c2.id = c.id;

  return v_bundle;
end $$;

-- ------------------------------------------------------------------ §4.2 row 21
create or replace function public.revise_draft(p_consult_id uuid, p_base_draft_id uuid, p_recommendation jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; base public.ai_drafts%rowtype; v_new public.ai_drafts%rowtype;
        v_safety jsonb; v_flags jsonb := '[]'::jsonb;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  select * into base from public.ai_drafts where id = p_base_draft_id and consult_id = p_consult_id;
  if not found then raise exception 'draft_not_found' using errcode = 'PT404'; end if;
  if base.superseded_at is not null then
    raise exception 'base_draft_superseded' using errcode = 'PT409',
      detail = 'another revision landed first; re-read the current draft';
  end if;

  v_safety := public.check_drug_safety(p_consult_id, coalesce(p_recommendation->'items', '[]'::jsonb));
  if exists (select 1 from jsonb_array_elements(v_safety) s where s->>'verdict' = 'block') then
    raise exception 'safety_block' using errcode = 'PT422', detail = v_safety::text;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', 'safety_' || (s->>'verdict'), 'severity',
           case when s->>'verdict' = 'caution' then 'warn' else 'info' end,
           'text', s->>'reason', 'source', 'validator')), '[]'::jsonb)
    into v_flags from jsonb_array_elements(v_safety) s;

  update public.ai_drafts set superseded_at = now() where id = base.id;

  insert into public.ai_drafts (consult_id, hospital_id, version, supersedes_id, created_by,
                                created_for_doctor_id, recommendation, note, confidence, flags,
                                unanswered_slots, raw_response, model, protocol_version_id, prompt_version)
  values (p_consult_id, c.hospital_id, base.version + 1, base.id, 'coordinator_agent',
          auth.uid(), p_recommendation, base.note, base.confidence, v_flags,
          base.unanswered_slots, '{}'::jsonb, base.model, base.protocol_version_id, base.prompt_version)
  returning * into v_new;

  update public.safety_checks set draft_id = v_new.id
   where consult_id = p_consult_id and draft_id is null;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, actor_id, payload)
  values (p_consult_id, c.hospital_id, 'draft_revised', 'doctor', auth.uid(),
          jsonb_build_object('draft_id', v_new.id, 'version', v_new.version));

  return jsonb_build_object('draft_id', v_new.id, 'version', v_new.version, 'content_hash', v_new.content_hash);
end $$;

-- --------------------------------------------------- §4.2 row 22 — THE gate call
-- The only write path to `prescriptions` in the entire system.
create or replace function public.approve_consult(
  p_consult_id uuid, p_draft_id uuid, p_draft_hash text,
  p_final_items jsonb default '[]'::jsonb, p_investigations jsonb default '[]'::jsonb,
  p_advice text default '', p_idempotency_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  c public.consults%rowtype; d public.ai_drafts%rowtype;
  v_existing public.reviews%rowtype; v_review_id uuid; v_rx_id uuid;
  v_edited boolean; v_diff jsonb; v_item jsonb; i int := 0;
begin
  if p_idempotency_key is null or length(p_idempotency_key) = 0 then
    raise exception 'idempotency_key_required' using errcode = 'PT400';
  end if;

  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403', detail = 'not a doctor of this hospital';
  end if;

  select * into v_existing from public.reviews
   where consult_id = p_consult_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'review_id', v_existing.id,
      'prescription_id', (select id from public.prescriptions where review_id = v_existing.id),
      'status', c.status, 'idempotent_replay', true);
  end if;

  if c.status not in ('pending_review','needs_human') then
    raise exception 'already_decided' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;

  select * into d from public.ai_drafts where id = p_draft_id and consult_id = p_consult_id;
  if not found then raise exception 'draft_not_found' using errcode = 'PT404'; end if;
  if d.content_hash <> p_draft_hash then
    raise exception 'draft_changed' using errcode = 'PT409',
      detail = 'the draft was revised after you read it; re-read before signing';
  end if;

  v_edited := (coalesce(p_final_items, '[]'::jsonb) is distinct from coalesce(d.recommendation->'items', '[]'::jsonb))
           or (coalesce(p_advice, '') is distinct from coalesce(d.recommendation->>'advice', ''));
  v_diff := jsonb_build_object(
    'items', case when v_edited then jsonb_build_object(
                    'from', d.recommendation->'items', 'to', p_final_items) else 'null'::jsonb end,
    'advice', case when coalesce(p_advice,'') is distinct from coalesce(d.recommendation->>'advice','')
                   then jsonb_build_object('from', d.recommendation->>'advice', 'to', p_advice)
                   else 'null'::jsonb end);

  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, diff, idempotency_key)
  values (p_consult_id, auth.uid(), p_draft_id, p_draft_hash,
          (case when v_edited then 'edited_approved' else 'approved' end)::public.review_action,
          v_diff, p_idempotency_key)
  returning id into v_review_id;

  insert into public.prescriptions (consult_id, hospital_id, patient_id, doctor_id, review_id,
                                    kind, advice, edited_from_draft)
  values (p_consult_id, c.hospital_id, c.patient_id, auth.uid(), v_review_id,
          coalesce((d.recommendation->>'type')::public.plan_kind, 'prescription'),
          coalesce(p_advice, ''), v_edited)
  returning id into v_rx_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_final_items, '[]'::jsonb)) loop
    insert into public.prescription_items (prescription_id, position, name, dosage, timing, duration, notes, why, detail)
    values (v_rx_id, i, v_item->>'name', coalesce(v_item->>'dosage',''), coalesce(v_item->>'timing',''),
            v_item->>'duration', coalesce(v_item->>'notes',''), coalesce(v_item->>'why',''),
            coalesce(v_item->>'detail',''));
    i := i + 1;
  end loop;

  i := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_investigations, '[]'::jsonb)) loop
    insert into public.investigation_orders (prescription_id, consult_id, patient_id, hospital_id,
                                             position, name, modality, timing, why)
    values (v_rx_id, p_consult_id, c.patient_id, c.hospital_id, i, v_item->>'name',
            coalesce((v_item->>'modality')::public.investigation_modality, 'other'),
            coalesce(v_item->>'timing',''), coalesce(v_item->>'why',''));
    i := i + 1;
  end loop;

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', auth.uid()::text, true);
  update public.consults set status = 'approved', decided_at = now() where id = p_consult_id;

  insert into public.notifications (hospital_id, recipient_id, consult_id, kind, title, body, deep_link)
  values (c.hospital_id, c.patient_id, p_consult_id, 'decision',
          'Your prescription is ready',
          'A doctor has reviewed and approved your plan.',
          '/patient/records/' || p_consult_id);

  return jsonb_build_object('review_id', v_review_id, 'prescription_id', v_rx_id, 'status', 'approved');
end $$;

-- ------------------------------------------------------------------ §4.2 row 23
create or replace function public.reject_consult(
  p_consult_id uuid, p_draft_id uuid, p_draft_hash text,
  p_reason text, p_patient_message text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; d public.ai_drafts%rowtype;
        v_existing public.reviews%rowtype; v_review_id uuid;
begin
  if coalesce(p_patient_message, '') = '' then
    raise exception 'patient_message_required' using errcode = 'PT400',
      detail = 'a rejected consult must carry a message the patient can read';
  end if;

  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  select * into v_existing from public.reviews
   where consult_id = p_consult_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('review_id', v_existing.id, 'status', c.status, 'idempotent_replay', true);
  end if;

  if c.status not in ('pending_review','needs_human') then
    raise exception 'already_decided' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;

  select * into d from public.ai_drafts where id = p_draft_id and consult_id = p_consult_id;
  if not found then raise exception 'draft_not_found' using errcode = 'PT404'; end if;
  if d.content_hash <> p_draft_hash then
    raise exception 'draft_changed' using errcode = 'PT409';
  end if;

  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, reason,
                              patient_message, idempotency_key)
  values (p_consult_id, auth.uid(), p_draft_id, p_draft_hash, 'rejected', p_reason,
          p_patient_message, p_idempotency_key)
  returning id into v_review_id;

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', auth.uid()::text, true);
  update public.consults set status = 'rejected', decided_at = now() where id = p_consult_id;

  insert into public.notifications (hospital_id, recipient_id, consult_id, kind, title, body, deep_link)
  values (c.hospital_id, c.patient_id, p_consult_id, 'decision',
          'A doctor has reviewed your consult', p_patient_message, '/patient/records/' || p_consult_id);

  return jsonb_build_object('review_id', v_review_id, 'status', 'rejected');
end $$;

-- ------------------------------------------------------------------ §4.2 row 24
create or replace function public.escalate_consult(
  p_consult_id uuid, p_draft_id uuid, p_draft_hash text, p_reason text,
  p_appointment jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; d public.ai_drafts%rowtype;
        v_existing public.reviews%rowtype; v_review_id uuid; v_appt_id uuid;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  select * into v_existing from public.reviews
   where consult_id = p_consult_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('review_id', v_existing.id,
      'appointment_id', (select id from public.appointments where review_id = v_existing.id),
      'idempotent_replay', true);
  end if;

  if c.status not in ('pending_review','needs_human') then
    raise exception 'already_decided' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;

  select * into d from public.ai_drafts where id = p_draft_id and consult_id = p_consult_id;
  if not found then raise exception 'draft_not_found' using errcode = 'PT404'; end if;
  if d.content_hash <> p_draft_hash then
    raise exception 'draft_changed' using errcode = 'PT409';
  end if;

  insert into public.reviews (consult_id, doctor_id, draft_id, draft_hash, action, reason, idempotency_key)
  values (p_consult_id, auth.uid(), p_draft_id, p_draft_hash, 'escalated', p_reason, p_idempotency_key)
  returning id into v_review_id;

  insert into public.appointments (hospital_id, patient_id, doctor_id, consult_id, review_id,
                                   kind, starts_at, location)
  values (c.hospital_id, c.patient_id, auth.uid(), p_consult_id, v_review_id,
          coalesce((p_appointment->>'kind')::public.appointment_kind, 'in_person'),
          (p_appointment->>'starts_at')::timestamptz, p_appointment->>'location')
  returning id into v_appt_id;

  perform set_config('vd.actor', 'doctor', true);
  perform set_config('vd.actor_id', auth.uid()::text, true);
  update public.consults set status = 'escalated', decided_at = now() where id = p_consult_id;

  insert into public.notifications (hospital_id, recipient_id, consult_id, kind, title, body, deep_link)
  values (c.hospital_id, c.patient_id, p_consult_id, 'appointment',
          'A doctor would like to see you', p_reason, '/patient/records/' || p_consult_id);

  return jsonb_build_object('review_id', v_review_id, 'appointment_id', v_appt_id, 'status', 'escalated');
end $$;

-- ------------------------------------------------- §4.1 rows 9 and 12, §4.3 row 31
-- Storage: the RPC validates MIME, size and row state and reserves the id-only key
-- (§5.2); the client then exchanges the returned path for a short-lived signed URL,
-- which the storage policies in 0008 authorize. Nothing here hands out a broad grant.
create or replace function public.create_media_upload(
  p_consult_id uuid, p_mime_type text, p_bytes bigint, p_sha256 text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; v_id uuid := gen_random_uuid(); v_ext text; v_path text;
begin
  select * into c from public.consults where id = p_consult_id;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if c.patient_id <> auth.uid() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  if c.status <> 'active' then
    raise exception 'consult_not_active' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;
  if p_bytes > 10485760 then raise exception 'too_large' using errcode = 'PT413'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/heic','video/mp4') then
    raise exception 'unsupported_media_type' using errcode = 'PT415';
  end if;

  v_ext := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
                            when 'image/webp' then 'webp' when 'image/heic' then 'heic' else 'mp4' end;
  v_path := c.hospital_id || '/' || c.id || '/' || v_id || '.' || v_ext;

  insert into public.consult_media (id, consult_id, hospital_id, uploaded_by, kind, storage_path,
                                    mime_type, bytes, sha256)
  values (v_id, p_consult_id, c.hospital_id, auth.uid(),
          (case when p_mime_type like 'video/%' then 'video' else 'image' end)::public.media_kind,
          v_path, p_mime_type, p_bytes, p_sha256);

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, actor_id, payload)
  values (p_consult_id, c.hospital_id, 'media_uploaded', 'patient', auth.uid(),
          jsonb_build_object('media_id', v_id));

  return jsonb_build_object('media_id', v_id, 'bucket', 'consult-media', 'path', v_path,
                            'expires_at', now() + interval '60 seconds');
end $$;

create or replace function public.create_lab_upload(
  p_patient_id uuid, p_panel text, p_mime_type text, p_bytes bigint,
  p_analyte text default 'Report', p_observed_at timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_hospital uuid; v_id uuid := gen_random_uuid(); v_ext text; v_path text;
begin
  if p_bytes > 20971520 then raise exception 'too_large' using errcode = 'PT413'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png') then
    raise exception 'unsupported_media_type' using errcode = 'PT415';
  end if;

  if p_patient_id = auth.uid() then
    select hospital_id into v_hospital from public.memberships
     where profile_id = auth.uid() and status = 'active' and role = 'patient' limit 1;
  else
    select c.hospital_id into v_hospital from public.consults c
     where c.patient_id = p_patient_id
       and public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[])
     limit 1;
  end if;
  if v_hospital is null then raise exception 'forbidden' using errcode = 'PT403'; end if;

  v_ext := case p_mime_type when 'application/pdf' then 'pdf'
                            when 'image/png' then 'png' else 'jpg' end;
  v_path := v_hospital || '/' || p_patient_id || '/' || v_id || '.' || v_ext;

  insert into public.lab_results (id, patient_id, hospital_id, panel, analyte, value_text,
                                  abnormal, observed_at, source, report_path)
  values (v_id, p_patient_id, v_hospital, p_panel, p_analyte, 'See attached report',
          'unknown', p_observed_at, 'upload', v_path);

  insert into public.audit_log (hospital_id, actor_id, actor_role, action, target_kind, target_id, detail)
  values (v_hospital, auth.uid(),
          (case when p_patient_id = auth.uid() then 'patient' else 'doctor' end)::public.actor_kind,
          'storage.upload_reserved', 'storage_object', v_path,
          jsonb_build_object('bucket', 'lab-reports', 'ttl_s', 60));

  return jsonb_build_object('result_id', v_id, 'bucket', 'lab-reports', 'path', v_path,
                            'expires_at', now() + interval '60 seconds');
end $$;

create or replace function public.sign_prescription_pdf(p_prescription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare p public.prescriptions%rowtype;
begin
  select * into p from public.prescriptions where id = p_prescription_id;
  if not found then raise exception 'not_found' using errcode = 'PT404'; end if;
  if p.patient_id <> auth.uid()
     and not public.has_hospital_role(p.hospital_id, array['doctor','admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;
  if p.pdf_path is null then
    raise exception 'pdf_not_ready' using errcode = 'PT404', detail = 'the PDF has not been rendered yet';
  end if;

  insert into public.audit_log (hospital_id, actor_id, actor_role, action, target_kind, target_id, detail)
  values (p.hospital_id, auth.uid(),
          (case when p.patient_id = auth.uid() then 'patient' else 'doctor' end)::public.actor_kind,
          'storage.signed_url_issued', 'storage_object', p.pdf_path,
          jsonb_build_object('bucket', 'prescription-pdfs', 'ttl_s', 300));

  return jsonb_build_object('bucket', 'prescription-pdfs', 'path', p.pdf_path,
                            'expires_at', now() + interval '300 seconds');
end $$;

-- ------------------------------------------------------------------ §4.3 row 29
create or replace function public.search_consults(
  p_q text default null, p_patient_id uuid default null, p_status public.consult_status default null,
  p_urgency public.urgency default null, p_from timestamptz default null, p_to timestamptz default null,
  p_limit int default 25, p_cursor timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_rows jsonb;
begin
  select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object('id', c.id, 'hospital_id', c.hospital_id, 'patient_id', c.patient_id,
                              'status', c.status, 'urgency', c.urgency,
                              'chief_complaint', c.chief_complaint, 'created_at', c.created_at) as r
      from public.consults c
     where public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[])
       and (p_patient_id is null or c.patient_id = p_patient_id)
       and (p_status  is null or c.status  = p_status)
       and (p_urgency is null or c.urgency = p_urgency)
       and (p_from is null or c.created_at >= p_from)
       and (p_to   is null or c.created_at <= p_to)
       and (p_cursor is null or c.created_at < p_cursor)
       and (p_q is null or exists (
             select 1 from public.consult_messages m
              where m.consult_id = c.id
                and to_tsvector('english'::regconfig, m.content)
                    @@ plainto_tsquery('english'::regconfig, p_q)))
     order by c.created_at desc
     limit least(coalesce(p_limit, 25), 200)
  ) s;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', case when jsonb_array_length(v_rows) = 0 then null
                        else v_rows->-1->>'created_at' end);
end $$;

-- ------------------------------------------------------------------ §4.3 row 30
create or replace function public.export_consult_trace(p_consult_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype;
begin
  select * into c from public.consults where id = p_consult_id;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if not public.has_hospital_role(c.hospital_id, array['doctor','admin']::public.member_role[]) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  insert into public.audit_log (hospital_id, actor_id, actor_role, action, target_kind, target_id)
  values (c.hospital_id, auth.uid(), 'doctor', 'trace.exported', 'consult', p_consult_id::text);

  return jsonb_build_object(
    'consult', to_jsonb(c),
    'exported_at', now(),
    'trace', (select coalesce(jsonb_agg(jsonb_build_object(
                'at', t.at, 'actor', t.actor, 'actor_id', t.actor_id, 'kind', t.kind,
                'source_id', t.source_id, 'summary', t.summary, 'payload', t.payload) order by t.at), '[]'::jsonb)
                from public.consult_trace t where t.consult_id = p_consult_id));
end $$;

-- ------------------------------------------------------------------ §4.3 row 33
create or replace function public.run_consult_timers()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_warned int := 0; v_expired int := 0; v_abandoned int := 0; r record;
begin
  perform set_config('vd.actor', 'system', true);
  perform set_config('vd.actor_id', '', true);

  for r in select c.id, c.hospital_id, c.patient_id,
                  coalesce((h.ai_config->'sla'->>'warn_minutes')::int, 120)   as warn_minutes,
                  coalesce((h.ai_config->'sla'->>'expire_hours')::int, 24)    as expire_hours,
                  coalesce((h.ai_config->'sla'->>'abandon_minutes')::int, 30) as abandon_minutes,
                  c.status, c.submitted_at, c.last_patient_turn_at, c.sla_warned_at
             from public.consults c join public.hospitals h on h.id = c.hospital_id
            where c.status in ('pending_review','active')
  loop
    if r.status = 'pending_review' and r.sla_warned_at is null
       and r.submitted_at < now() - make_interval(mins => r.warn_minutes) then
      update public.consults set sla_warned_at = now() where id = r.id;
      insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
      values (r.id, r.hospital_id, 'sla_escalated', 'system', jsonb_build_object('after_minutes', r.warn_minutes));
      v_warned := v_warned + 1;
    end if;

    if r.status = 'pending_review' and r.submitted_at < now() - make_interval(hours => r.expire_hours) then
      update public.consults set status = 'expired', closed_at = now() where id = r.id;
      v_expired := v_expired + 1;
    elsif r.status = 'active' and coalesce(r.last_patient_turn_at, now())
          < now() - make_interval(mins => r.abandon_minutes) then
      update public.consults set status = 'abandoned', closed_at = now() where id = r.id;
      v_abandoned := v_abandoned + 1;
    end if;
  end loop;

  return jsonb_build_object('warned', v_warned, 'expired', v_expired, 'abandoned', v_abandoned);
end $$;

-- ------------------------------------------------------------------- execute ACL
revoke execute on all functions in schema public from public, anon;

grant execute on function public.start_consult(uuid)                                    to authenticated;
grant execute on function public.open_consult(uuid)                                     to authenticated;
grant execute on function public.revise_draft(uuid, uuid, jsonb)                        to authenticated;
grant execute on function public.approve_consult(uuid, uuid, text, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.reject_consult(uuid, uuid, text, text, text, text)     to authenticated;
grant execute on function public.escalate_consult(uuid, uuid, text, text, jsonb, text)  to authenticated;
grant execute on function public.create_media_upload(uuid, text, bigint, text)          to authenticated;
grant execute on function public.create_lab_upload(uuid, text, text, bigint, text, timestamptz) to authenticated;
grant execute on function public.sign_prescription_pdf(uuid)                            to authenticated;
grant execute on function public.search_consults(text, uuid, public.consult_status, public.urgency, timestamptz, timestamptz, int, timestamptz) to authenticated;
grant execute on function public.export_consult_trace(uuid)                             to authenticated;
grant execute on function public.check_drug_safety(uuid, jsonb)                         to service_role;
grant execute on function public.run_consult_timers()                                   to service_role;
grant execute on function public.my_hospital_ids()        to authenticated, service_role;
grant execute on function public.is_hospital_member(uuid) to authenticated, service_role;
grant execute on function public.has_hospital_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function public.shares_consult_with(uuid) to authenticated, service_role;
grant execute on function public.current_actor()          to authenticated, service_role;
grant execute on function public.current_actor_id()       to authenticated, service_role;
