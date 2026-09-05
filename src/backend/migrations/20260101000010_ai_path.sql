-- 0010 — the narrow, service_role-only surface the Edge Functions write through.
--
-- The (E) rows of §4 hold the provider key; they must not also hold free rein over
-- the schema. Every write the AI path makes goes through one of these functions, so
-- the actor channel (§3.2), the safety gate (§5.2 line 3) and the validator-only
-- flag rule (§5.7) are enforced in the database and not in Deno.

create or replace function public.ai_record_turn(
  p_consult_id uuid, p_patient_text text, p_ai_text text,
  p_channel public.message_channel default 'text', p_slots jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; v_patient_msg uuid; v_ai_msg uuid; s jsonb;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if c.status <> 'active' then
    raise exception 'consult_not_active' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;

  if coalesce(p_patient_text, '') <> '' then
    insert into public.consult_messages (consult_id, sender, channel, content)
    values (p_consult_id, 'patient', p_channel, p_patient_text) returning id into v_patient_msg;
  end if;

  if coalesce(p_ai_text, '') <> '' then
    insert into public.consult_messages (consult_id, sender, agent_id, channel, content)
    values (p_consult_id, 'ai', 'doctor_agent', p_channel, p_ai_text) returning id into v_ai_msg;
  end if;

  for s in select * from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) loop
    insert into public.consult_slots (consult_id, slot_id, status, value, confidence, source,
                                      evidence_message_id, evidence_span, attempts, updated_at)
    values (p_consult_id, (s->>'slot_id')::public.slot_id,
            coalesce((s->>'status')::public.slot_status, 'filled'), s->>'value',
            (s->>'confidence')::numeric, coalesce((s->>'source')::public.slot_source, 'patient'),
            coalesce(nullif(s->>'evidence_message_id','')::uuid, v_patient_msg),
            case when s ? 'evidence_span'
                 then array(select jsonb_array_elements_text(s->'evidence_span'))::int[] end,
            coalesce((s->>'attempts')::int, 1), now())
    on conflict (consult_id, slot_id) do update
      set status = excluded.status, value = excluded.value, confidence = excluded.confidence,
          source = excluded.source, evidence_message_id = excluded.evidence_message_id,
          evidence_span = excluded.evidence_span,
          attempts = least(consult_slots.attempts + 1, 2), updated_at = now();

    insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
    values (p_consult_id, c.hospital_id, 'slot_filled', 'ai',
            jsonb_build_object('slot_id', s->>'slot_id', 'status', coalesce(s->>'status','filled')));
  end loop;

  update public.consults
     set last_patient_turn_at = now(),
         chief_complaint = coalesce(chief_complaint, nullif(p_patient_text, '')),
         channel_mix = jsonb_set(coalesce(channel_mix, '{}'::jsonb),
                                 array[p_channel::text || '_turns'],
                                 to_jsonb(coalesce((channel_mix->>(p_channel::text || '_turns'))::int, 0) + 1))
   where id = p_consult_id;

  return jsonb_build_object('message_id', coalesce(v_ai_msg, v_patient_msg),
                            'patient_message_id', v_patient_msg,
                            'slots_changed', (select coalesce(jsonb_agg(x->>'slot_id'), '[]'::jsonb)
                                                from jsonb_array_elements(coalesce(p_slots,'[]'::jsonb)) x));
end $$;

-- The conclude pass. A blocked item means the draft is never written and the case
-- reaches the doctor as needs_human (AGENT-EXPERIENCE §5.2 line 3).
create or replace function public.ai_submit_draft(
  p_consult_id uuid, p_recommendation jsonb, p_note text,
  p_confidence public.confidence, p_unanswered text[] default '{}',
  p_raw jsonb default '{}'::jsonb, p_model text default 'claude-opus-5',
  p_prompt_version text default 'mira-patient-v4')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; v_safety jsonb; v_flags jsonb; v_draft public.ai_drafts%rowtype;
        v_next int;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  if c.status <> 'active' then
    raise exception 'consult_not_active' using errcode = 'PT409', detail = 'consult is ' || c.status;
  end if;

  -- Required slots must be answered before a consult may conclude (§3.2).
  if exists (
    select 1 from unnest(array['presenting_complaint','duration_course','severity','red_flag_screen']) req(slot)
     where not exists (select 1 from public.consult_slots s
                        where s.consult_id = p_consult_id
                          and s.slot_id::text = req.slot
                          and s.status = 'filled')) then
    raise exception 'required_slots_unfilled' using errcode = 'PT422',
      detail = 'presenting_complaint, duration_course, severity and red_flag_screen are required';
  end if;

  v_safety := public.check_drug_safety(p_consult_id, coalesce(p_recommendation->'items', '[]'::jsonb));

  if exists (select 1 from jsonb_array_elements(v_safety) s where s->>'verdict' = 'block') then
    perform set_config('vd.actor', 'ai', true);
    perform set_config('vd.actor_id', '', true);
    update public.consults set status = 'needs_human' where id = p_consult_id;
    insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
    values (p_consult_id, c.hospital_id, 'safety_check', 'system',
            jsonb_build_object('outcome','blocked','checks', v_safety));
    return jsonb_build_object('draft_id', null, 'status', 'needs_human', 'safety', v_safety);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', 'safety_' || (s->>'verdict'),
           'severity', case when s->>'verdict' = 'caution' then 'warn' else 'info' end,
           'text', s->>'reason', 'source', 'validator')), '[]'::jsonb)
    into v_flags from jsonb_array_elements(v_safety) s;

  select coalesce(max(version), 0) + 1 into v_next from public.ai_drafts where consult_id = p_consult_id;
  update public.ai_drafts set superseded_at = now()
   where consult_id = p_consult_id and superseded_at is null;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, unanswered_slots, raw_response, model,
                                protocol_version_id, prompt_version)
  values (p_consult_id, c.hospital_id, v_next, 'doctor_agent', p_recommendation, p_note,
          p_confidence, v_flags, coalesce(p_unanswered, '{}'), p_raw, p_model,
          c.protocol_version_id, p_prompt_version)
  returning * into v_draft;

  update public.safety_checks set draft_id = v_draft.id
   where consult_id = p_consult_id and draft_id is null;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'draft_created', 'ai',
          jsonb_build_object('draft_id', v_draft.id, 'version', v_draft.version));

  perform set_config('vd.actor', 'ai', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults
     set status = 'pending_review', submitted_at = now(),
         urgency = coalesce((p_recommendation->>'urgency')::public.urgency, urgency)
   where id = p_consult_id;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'queued', 'ai', jsonb_build_object('draft_id', v_draft.id));

  return jsonb_build_object('draft_id', v_draft.id, 'version', v_draft.version,
                            'content_hash', v_draft.content_hash, 'status', 'pending_review',
                            'safety', v_safety);
end $$;

-- A refusal or a repeated validation failure is a clinical escalation, not an error
-- (AGENT-EXPERIENCE §5.6).
create or replace function public.ai_escalate_to_human(p_consult_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'refusal', 'ai', jsonb_build_object('reason', p_reason));

  perform set_config('vd.actor', 'ai', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults set status = 'needs_human', submitted_at = coalesce(submitted_at, now())
   where id = p_consult_id;

  return jsonb_build_object('status', 'needs_human');
end $$;

-- §4.2 #20: an `ai` row making a factual claim with no citation is not persisted.
create or replace function public.ai_record_review_message(
  p_consult_id uuid, p_doctor_id uuid, p_sender public.review_sender,
  p_content text, p_citations jsonb default '[]'::jsonb,
  p_channel public.message_channel default 'text')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_seq bigint; v_id uuid;
begin
  if p_sender = 'ai' and jsonb_array_length(coalesce(p_citations, '[]'::jsonb)) = 0 then
    raise exception 'uncited_claim' using errcode = 'PT422',
      detail = 'a coordinator claim about the patient must quote the transcript';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.review_messages
   where consult_id = p_consult_id and doctor_id = p_doctor_id;

  insert into public.review_messages (consult_id, doctor_id, seq, sender, channel, content, citations)
  values (p_consult_id, p_doctor_id, v_seq, p_sender, p_channel, p_content, coalesce(p_citations, '[]'::jsonb))
  returning id into v_id;

  return jsonb_build_object('review_message_id', v_id, 'seq', v_seq);
end $$;

create or replace function public.ai_log_invocation(
  p_consult_id uuid, p_agent_id text, p_mode public.agent_mode, p_model text,
  p_input_tokens int, p_cached_input_tokens int, p_output_tokens int,
  p_audio_seconds numeric, p_latency_ms int, p_stop_reason text, p_cost_usd numeric)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare v_h uuid; v_id uuid;
begin
  select hospital_id into v_h from public.consults where id = p_consult_id;
  insert into public.agent_invocations (consult_id, hospital_id, agent_id, mode, model,
    input_tokens, cached_input_tokens, output_tokens, audio_seconds, latency_ms, stop_reason, cost_usd)
  values (p_consult_id, v_h, p_agent_id, p_mode, p_model, p_input_tokens, p_cached_input_tokens,
          p_output_tokens, p_audio_seconds, p_latency_ms, p_stop_reason, p_cost_usd)
  returning id into v_id;
  return v_id;
end $$;

-- PRD A-5: quotas are decided against measured spend, never a browser counter.
create or replace function public.check_quota(p_consult_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare c public.consults%rowtype; q jsonb; v_today int; v_turns int;
begin
  select * into c from public.consults where id = p_consult_id;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  select coalesce(ai_config->'quotas', '{}'::jsonb) into q from public.hospitals where id = c.hospital_id;

  select count(*) into v_today from public.consults
   where hospital_id = c.hospital_id and created_at >= date_trunc('day', now());
  select count(*) into v_turns from public.consult_messages
   where consult_id = p_consult_id and sender = 'patient';

  if v_today > coalesce((q->>'daily_consults')::int, 1000000) then
    raise exception 'quota_exhausted' using errcode = 'PT402', detail = 'daily consult quota reached';
  end if;
  if v_turns >= coalesce((q->>'max_patient_turns')::int, 1000000) then
    raise exception 'quota_exhausted' using errcode = 'PT402', detail = 'turn limit for this consult reached';
  end if;

  return jsonb_build_object('ok', true, 'turns_used', v_turns,
                            'turns_allowed', coalesce((q->>'max_patient_turns')::int, null),
                            'session_minutes', coalesce((q->>'session_minutes_per_consult')::int, 12));
end $$;

revoke execute on function public.ai_record_turn(uuid, text, text, public.message_channel, jsonb) from public, anon, authenticated;
revoke execute on function public.ai_submit_draft(uuid, jsonb, text, public.confidence, text[], jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.ai_escalate_to_human(uuid, text) from public, anon, authenticated;
revoke execute on function public.ai_record_review_message(uuid, uuid, public.review_sender, text, jsonb, public.message_channel) from public, anon, authenticated;
revoke execute on function public.ai_log_invocation(uuid, text, public.agent_mode, text, int, int, int, numeric, int, text, numeric) from public, anon, authenticated;
revoke execute on function public.check_quota(uuid) from public, anon;

grant execute on function public.ai_record_turn(uuid, text, text, public.message_channel, jsonb) to service_role;
grant execute on function public.ai_submit_draft(uuid, jsonb, text, public.confidence, text[], jsonb, text, text) to service_role;
grant execute on function public.ai_escalate_to_human(uuid, text) to service_role;
grant execute on function public.ai_record_review_message(uuid, uuid, public.review_sender, text, jsonb, public.message_channel) to service_role;
grant execute on function public.ai_log_invocation(uuid, text, public.agent_mode, text, int, int, int, numeric, int, text, numeric) to service_role;
grant execute on function public.check_quota(uuid) to service_role, authenticated;
