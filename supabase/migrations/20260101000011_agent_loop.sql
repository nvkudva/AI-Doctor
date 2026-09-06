-- 0011 — the server-authoritative agent loop: the protocol registry, the red-flag
-- escalation path, and a safety validator with teeth (AGENT-EXPERIENCE §3.3, §3.7,
-- §5.2, §5.7).
--
-- Forward-only. 0007 and 0010 are not edited; the two functions whose contracts had
-- to change (`ai_record_turn`, `ai_submit_draft`) are dropped and recreated here so
-- there is exactly one path, not a strong one beside a weak one.
--
-- CLINICAL CONTENT IN THIS FILE IS NOT SIGNED OFF. The red-flag scripts, the drug
-- class map, the interaction pairs and the dose limits are seeds with a named
-- version and `approved_at IS NULL`. Every check records the version it ran under,
-- and an unapproved ruleset forces a draft to `low` confidence and carries a
-- validator flag onto the doctor's screen. See AGENT-EXPERIENCE §7.2/§7.3.

alter type public.notification_kind add value if not exists 'red_flag';

-- The per-flag screen: which red flags were asked, and what the answer was. Written
-- only by `ai_record_turn`, and the negatives matter as much as the positives (§5.7).
alter table public.consults
  add column if not exists red_flag_screen jsonb not null default '{}'::jsonb;

-- ------------------------------------------------- the protocol registry (§3.3)
-- A protocol is a data file in functions/_shared/protocols/. This registers the
-- exact bytes that governed a consult, so the draft a doctor signs names its policy.
create or replace function public.register_protocol_version(
  p_complaint_key text, p_version text, p_content_hash text,
  p_clinician_owner text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare v public.protocol_versions%rowtype;
begin
  select * into v from public.protocol_versions
   where complaint_key = p_complaint_key and version = p_version;

  if found then
    -- Editing a protocol without bumping its version would silently change clinical
    -- policy under an unchanged label. It fails instead.
    if v.content_hash is distinct from p_content_hash then
      raise exception 'protocol_content_drift' using errcode = 'PT409',
        detail = format('%s %s is registered with a different content hash; bump the version',
                        p_complaint_key, p_version);
    end if;
    return v.id;
  end if;

  insert into public.protocol_versions (complaint_key, version, content_hash, clinician_owner, active)
  values (p_complaint_key, p_version, p_content_hash, p_clinician_owner, true)
  returning * into v;
  return v.id;
end $fn$;

-- --------------------------------------------- the red-flag scripts (§3.7)
-- Fixed, per code. The model is told what was said; it does not choose the words,
-- because a generated emergency instruction can be wrong.
create table public.red_flag_scripts (
  code            text primary key,
  action          text not null check (action in ('emergency','urgent_same_day')),
  script          text not null,
  urgency         public.urgency not null default 'urgent',
  ruleset_version text not null,
  clinician_owner text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.red_flag_scripts enable row level security;
alter table public.red_flag_scripts force  row level security;
create policy red_flag_scripts_read on public.red_flag_scripts for select to authenticated using (true);
revoke insert, update, delete on public.red_flag_scripts from anon, authenticated;

insert into public.red_flag_scripts (code, action, script, ruleset_version) values
  ('unspecified_emergency','emergency','From what you have told me, this needs to be seen in person now, not by me. Please call the emergency number or go to your nearest emergency department straight away. I am flagging this to the on-call doctor as we speak. If you get worse before you are seen, call for an ambulance.','redflag-scripts-2026.09'),
  ('acs_chest_pain','emergency','Chest pain like that needs to be checked urgently. Please stop what you are doing, call the emergency number now, and do not drive yourself. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('acs_radiation','emergency','Pain spreading to your arm or jaw needs urgent assessment. Please call the emergency number now and do not drive yourself. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('airway_breathing','emergency','Struggling to breathe is an emergency. Please call the emergency number now and stay on the line with them. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('anaphylaxis','emergency','Swelling of the throat, tongue or lips can close the airway. Call the emergency number now. If you have an adrenaline pen prescribed for you, use it. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('stroke_focal','emergency','Weakness, numbness or trouble speaking can be a stroke, and time matters. Call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('headache_thunderclap','emergency','A headache that arrives at full force in an instant needs to be looked at in an emergency department today. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('headache_focal_deficit','emergency','Weakness, numbness or changes to your speech or vision alongside a headache need urgent assessment. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('meningism','emergency','A stiff neck or a rash that does not fade needs urgent assessment. Please go to the emergency department now, or call the emergency number. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('headache_meningism','emergency','A fever with a stiff neck needs urgent assessment. Please go to the emergency department now, or call the emergency number. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('headache_raised_icp','urgent_same_day','A headache that is worse in the morning or on straining should be seen today. Please contact your practice for a same-day appointment. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('fever_sepsis','emergency','Shaking chills or confusion with a fever can mean a serious infection. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('fever_non_blanching_rash','emergency','A rash that does not fade under a glass is an emergency. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('fever_meningism','emergency','A stiff neck or light hurting your eyes with a fever needs emergency assessment. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('fever_breathing','urgent_same_day','Breathlessness with a fever should be assessed today. Please contact your practice for a same-day appointment, or go to an urgent care centre. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('fever_immunocompromise','urgent_same_day','A fever while your immune system is suppressed is treated as urgent. Please contact your specialist team or your practice today. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('sepsis','emergency','Shaking chills or confusion with a fever can mean a serious infection. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('cough_breathing','emergency','Being short of breath at rest is an emergency. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('cough_chest_pain','emergency','Chest pain with a cough needs urgent assessment. Please call the emergency number now and do not drive yourself. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('cough_haemoptysis','urgent_same_day','Coughing up blood needs to be assessed today. Please contact your practice for a same-day appointment. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('haemoptysis','urgent_same_day','Coughing up blood needs to be assessed today. Please contact your practice for a same-day appointment. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('cough_systemic','urgent_same_day','Night sweats or losing weight without trying should be looked into promptly. Please contact your practice today. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('haematemesis','emergency','Vomiting blood is an emergency. Please call the emergency number now and do not eat or drink anything. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('melaena','emergency','Black or tarry stools can mean bleeding inside. Please go to the emergency department now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('abdo_peritonism','emergency','A tummy that is tender to touch or hurts to move needs emergency assessment. Please go to the emergency department now and do not eat or drink. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('abdo_gi_bleed','emergency','Blood when you are sick, or black stools, is an emergency. Please go to the emergency department now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('abdo_sudden_severe','emergency','Pain that arrives suddenly at full strength needs emergency assessment. Please go to the emergency department now, or call the emergency number. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('abdo_obstruction','urgent_same_day','Not passing wind, or being unable to keep fluids down, needs to be assessed today. Please contact your practice or go to an urgent care centre. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('abdo_pregnancy','emergency','Tummy pain when you could be pregnant is treated as an emergency until it is ruled out. Please go to the emergency department now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('obstetric_bleed','emergency','Bleeding in pregnancy needs to be seen now. Please go to your maternity unit or the emergency department straight away. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('unresponsive','emergency','Passing out or having a fit needs emergency assessment. Please call the emergency number now, and if you are alone, ask someone to stay with you. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('cyanosis','emergency','Lips turning blue is an emergency. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('self_harm','emergency','I am glad you told me. You deserve help with this right now, not later. Please call the emergency number or a crisis line now, and stay with someone if you can. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('testicular_torsion','emergency','Sudden severe pain there can cut off the blood supply and is time-critical. Please go to the emergency department now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('cauda_equina','emergency','Numbness between your legs or losing control of your bladder or bowels is a time-critical emergency. Please go to the emergency department now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('general_chest_pain','emergency','Chest pain or pressure needs urgent assessment. Please call the emergency number now and do not drive yourself. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('general_breathing','emergency','Trouble breathing at rest is an emergency. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('general_neuro','emergency','Weakness, numbness or trouble with speech or vision needs emergency assessment. Please call the emergency number now. I am flagging this to the on-call doctor immediately.','redflag-scripts-2026.09'),
  ('general_bleeding','urgent_same_day','Bleeding like that needs to be assessed today. Please contact your practice for a same-day appointment, or go to an urgent care centre. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09'),
  ('general_systemic','urgent_same_day','A fever or unintended weight loss should be looked into promptly. Please contact your practice today. I am flagging this to the on-call doctor now.','redflag-scripts-2026.09');

-- ------------------------------------------------ raise_red_flag (§3.7)
-- detect → escalate → speak → notify. Only the detection involves judgement, and it
-- happens in three independent places (regex, protocol question, model pre-screen).
-- Everything below this line is deterministic and runs even if the model is down.
create or replace function public.raise_red_flag(
  p_consult_id uuid, p_code text, p_detector text, p_evidence text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare c public.consults%rowtype; s public.red_flag_scripts%rowtype; v_known boolean;
begin
  select * into c from public.consults where id = p_consult_id for update;
  if not found then raise exception 'consult_not_found' using errcode = 'PT404'; end if;

  select * into s from public.red_flag_scripts where code = p_code;
  v_known := found;
  if not v_known then
    -- An unknown code must never mean "no escalation". It means the generic script.
    select * into s from public.red_flag_scripts where code = 'unspecified_emergency';
  end if;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'red_flag_raised', 'system',
          jsonb_build_object('code', p_code, 'known_code', v_known, 'detector', p_detector,
                             'action', s.action, 'evidence', left(coalesce(p_evidence,''), 500),
                             'ruleset_version', s.ruleset_version, 'script_code', s.code));

  -- Urgency is not a status transition, so no actor channel is needed; it is also
  -- one-way — a later turn cannot walk it back down.
  update public.consults
     set urgency = case when s.urgency = 'urgent' or urgency = 'urgent' then 'urgent'
                        else greatest(urgency::text, s.urgency::text)::public.urgency end,
         red_flag_screen = jsonb_set(coalesce(red_flag_screen, '{}'::jsonb), array[p_code],
                                     jsonb_build_object('verdict','positive','asked',true,
                                                        'detector', p_detector), true)
   where id = p_consult_id;

  -- The on-call queue hears about it immediately, independent of review latency and
  -- independent of whether a draft is ever produced (§3.7, PRD §7).
  insert into public.notifications (hospital_id, recipient_id, consult_id, kind, title, body, deep_link)
  select c.hospital_id, m.profile_id, c.id, 'red_flag',
         'Red flag raised on an active consult',
         format('%s (%s). The patient has been given the emergency script.', s.code, s.action),
         '/doctor/case/' || c.id::text
    from public.memberships m
   where m.hospital_id = c.hospital_id and m.status = 'active' and m.role in ('doctor','admin');

  return jsonb_build_object('code', s.code, 'requested_code', p_code, 'known_code', v_known,
                            'action', s.action, 'script', s.script,
                            'ruleset_version', s.ruleset_version,
                            'clinician_approved', s.approved_at is not null);
end $fn$;

-- ------------------------------------------- the safety ruleset (§5.2, §7.3)
create table public.safety_rulesets (
  version         text primary key,
  description     text not null,
  clinician_owner text,
  approved_at     timestamptz,
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table public.safety_rulesets enable row level security;
alter table public.safety_rulesets force  row level security;
create policy safety_rulesets_read on public.safety_rulesets for select to authenticated using (true);
revoke insert, update, delete on public.safety_rulesets from anon, authenticated;
create unique index safety_rulesets_one_active on public.safety_rulesets (active) where active;

insert into public.safety_rulesets (version, description, clinician_owner, approved_at, active) values
  ('allergy-map-2026.08','Superseded by 2026.09.', null, null, false),
  ('safety-2026.09','SEED ONLY — NOT CLINICALLY REVIEWED. Common drug classes, a small interaction table and coarse dose ceilings, assembled to make the validator real. Requires a named pharmacist/clinician owner and full review before any real patient use.', null, null, true);

create or replace function public.active_safety_ruleset()
returns text language sql stable set search_path = public, pg_temp as $fn$
  select version from public.safety_rulesets where active limit 1;
$fn$;

-- Free text arrives from a model and from a doctor's dictation. "Amoxicillin 500mg
-- caps" and "amoxicillin" must resolve to the same row or the map catches nothing.
create or replace function public.normalize_drug_name(p_name text)
returns text language sql immutable set search_path = public, extensions, pg_temp as $fn$
  select nullif(trim(regexp_replace(regexp_replace(regexp_replace(
           lower(coalesce(p_name, '')),
           '\((.*?)\)', ' ', 'g'),
           '\y[0-9]+(\.[0-9]+)?\s*(mg|mcg|ug|g|ml|iu|units?|%)\y', ' ', 'g'),
           '\y(tablet|tablets|tabs?|capsules?|caps?|syrup|suspension|cream|ointment|gel|drops?|inhaler|spray|injection|solution|sachets?|oral|topical|po|im|iv|bd|tds|qds|od|prn|daily|nocte|mane)\y', ' ', 'g')), '')
$fn$;

insert into public.drug_class_map (drug_name, drug_class) values
  ('acetaminophen','paracetamol'), ('paracetamol','paracetamol'),
  ('naproxen','nsaid'), ('diclofenac','nsaid'), ('celecoxib','nsaid'), ('indomethacin','nsaid'),
  ('warfarin','anticoagulant'), ('apixaban','anticoagulant'), ('rivaroxaban','anticoagulant'),
  ('dabigatran','anticoagulant'), ('edoxaban','anticoagulant'), ('enoxaparin','anticoagulant'),
  ('clopidogrel','antiplatelet'), ('ticagrelor','antiplatelet'),
  ('sertraline','ssri'), ('fluoxetine','ssri'), ('citalopram','ssri'), ('escitalopram','ssri'),
  ('paroxetine','ssri'), ('venlafaxine','snri'), ('duloxetine','snri'),
  ('atorvastatin','statin'), ('simvastatin','statin'), ('rosuvastatin','statin'),
  ('clarithromycin','macrolide'), ('erythromycin','macrolide'), ('azithromycin','macrolide'),
  ('ramipril','ace_inhibitor'), ('lisinopril','ace_inhibitor'), ('enalapril','ace_inhibitor'),
  ('losartan','arb'), ('candesartan','arb'),
  ('spironolactone','potassium_sparing'), ('amiloride','potassium_sparing'),
  ('omeprazole','ppi'), ('lansoprazole','ppi'), ('pantoprazole','ppi'),
  ('codeine','opioid'), ('tramadol','opioid'), ('morphine','opioid'), ('oxycodone','opioid'),
  ('dihydrocodeine','opioid'),
  ('diazepam','benzodiazepine'), ('lorazepam','benzodiazepine'), ('temazepam','benzodiazepine'),
  ('zopiclone','z_drug'),
  ('doxycycline','tetracycline'), ('lymecycline','tetracycline'),
  ('ciprofloxacin','quinolone'), ('levofloxacin','quinolone'),
  ('nitrofurantoin','nitrofuran'), ('metronidazole','nitroimidazole'),
  ('trimethoprim','antifolate'), ('co-trimoxazole','antifolate'),
  ('clindamycin','lincosamide'), ('vancomycin','glycopeptide'), ('gentamicin','aminoglycoside'),
  ('prednisolone','corticosteroid'), ('dexamethasone','corticosteroid'),
  ('beclometasone','inhaled_corticosteroid'), ('budesonide','inhaled_corticosteroid'),
  ('salbutamol','beta_agonist'), ('salmeterol','beta_agonist'),
  ('chlorphenamine','antihistamine'), ('fexofenadine','antihistamine'),
  ('rizatriptan','triptan'), ('zolmitriptan','triptan'),
  ('metformin','biguanide'), ('gliclazide','sulfonylurea'),
  ('amitriptyline','tca'), ('nortriptyline','tca'),
  ('carbamazepine','anticonvulsant'), ('sodium valproate','anticonvulsant'),
  ('levothyroxine','thyroid_hormone'), ('ferrous sulfate','iron'),
  ('cefaclor','cephalosporin'), ('cefixime','cephalosporin'),
  ('meropenem','carbapenem'), ('ertapenem','carbapenem'),
  ('oseltamivir','antiviral'), ('aciclovir','antiviral'),
  ('ondansetron','antiemetic'), ('metoclopramide','antiemetic'), ('domperidone','antiemetic'),
  ('ranitidine','h2_blocker'), ('famotidine','h2_blocker'),
  ('hydrocortisone','topical_corticosteroid'), ('betamethasone','topical_corticosteroid')
on conflict (drug_name) do nothing;

update public.drug_class_map set ruleset_version = 'safety-2026.09';

-- Class-level interaction pairs. Unordered: the check compares least/greatest.
create table public.drug_interactions (
  class_a         text not null,
  class_b         text not null,
  verdict         public.safety_verdict not null,
  detail          text not null,
  ruleset_version text not null,
  primary key (class_a, class_b),
  check (class_a <= class_b)
);
alter table public.drug_interactions enable row level security;
alter table public.drug_interactions force  row level security;
create policy drug_interactions_read on public.drug_interactions for select to authenticated using (true);
revoke insert, update, delete on public.drug_interactions from anon, authenticated;

insert into public.drug_interactions (class_a, class_b, verdict, detail, ruleset_version) values
  ('anticoagulant','nsaid','block','NSAID with an anticoagulant: major bleeding risk.','safety-2026.09'),
  ('antiplatelet','nsaid','caution','NSAID with an antiplatelet increases bleeding risk.','safety-2026.09'),
  ('nsaid','nsaid','block','Two NSAIDs together is duplicate therapy with no added benefit.','safety-2026.09'),
  ('ace_inhibitor','nsaid','caution','NSAID with an ACE inhibitor: renal impairment risk.','safety-2026.09'),
  ('nsaid','ssri','caution','SSRI with an NSAID increases gastrointestinal bleeding risk.','safety-2026.09'),
  ('ssri','ssri','block','Two SSRIs together: serotonin toxicity risk.','safety-2026.09'),
  ('snri','ssri','block','SSRI with an SNRI: serotonin toxicity risk.','safety-2026.09'),
  ('ssri','triptan','caution','Triptan with an SSRI: serotonin syndrome has been reported.','safety-2026.09'),
  ('macrolide','statin','caution','Macrolide with a statin raises statin levels and myopathy risk.','safety-2026.09'),
  ('ace_inhibitor','potassium_sparing','caution','ACE inhibitor with a potassium-sparing diuretic: hyperkalaemia risk.','safety-2026.09'),
  ('arb','potassium_sparing','caution','ARB with a potassium-sparing diuretic: hyperkalaemia risk.','safety-2026.09'),
  ('benzodiazepine','opioid','block','Opioid with a benzodiazepine: respiratory depression risk.','safety-2026.09'),
  ('opioid','z_drug','caution','Opioid with a hypnotic: additive sedation.','safety-2026.09'),
  ('anticoagulant','antifolate','caution','Trimethoprim raises the INR on warfarin.','safety-2026.09'),
  ('anticoagulant','macrolide','caution','Macrolide with an anticoagulant raises bleeding risk.','safety-2026.09'),
  ('nsaid','quinolone','caution','Quinolone with an NSAID lowers the seizure threshold.','safety-2026.09'),
  ('opioid','opioid','block','Two opioids together is duplicate therapy.','safety-2026.09'),
  ('paracetamol','paracetamol','block','Two paracetamol-containing products risk exceeding the daily maximum.','safety-2026.09');

-- Coarse ceilings for dose sanity. Absent a row, no dose verdict is claimed.
create table public.dose_limits (
  drug_name       extensions.citext primary key,
  max_single_mg   numeric,
  max_daily_mg    numeric,
  ruleset_version text not null
);
alter table public.dose_limits enable row level security;
alter table public.dose_limits force  row level security;
create policy dose_limits_read on public.dose_limits for select to authenticated using (true);
revoke insert, update, delete on public.dose_limits from anon, authenticated;

insert into public.dose_limits (drug_name, max_single_mg, max_daily_mg, ruleset_version) values
  ('paracetamol', 1000, 4000, 'safety-2026.09'),
  ('ibuprofen', 600, 2400, 'safety-2026.09'),
  ('naproxen', 500, 1000, 'safety-2026.09'),
  ('amoxicillin', 1000, 3000, 'safety-2026.09'),
  ('co-amoxiclav', 875, 2625, 'safety-2026.09'),
  ('flucloxacillin', 1000, 4000, 'safety-2026.09'),
  ('doxycycline', 200, 200, 'safety-2026.09'),
  ('clarithromycin', 500, 1000, 'safety-2026.09'),
  ('azithromycin', 500, 500, 'safety-2026.09'),
  ('ciprofloxacin', 750, 1500, 'safety-2026.09'),
  ('nitrofurantoin', 100, 400, 'safety-2026.09'),
  ('trimethoprim', 200, 400, 'safety-2026.09'),
  ('metronidazole', 400, 1200, 'safety-2026.09'),
  ('prednisolone', 60, 60, 'safety-2026.09'),
  ('omeprazole', 40, 40, 'safety-2026.09'),
  ('cetirizine', 10, 10, 'safety-2026.09'),
  ('loratadine', 10, 10, 'safety-2026.09'),
  ('sumatriptan', 100, 300, 'safety-2026.09'),
  ('codeine', 60, 240, 'safety-2026.09'),
  ('sertraline', 200, 200, 'safety-2026.09');

-- ------------------------------------------- the validator (§5.2 lines 2 and 3)
-- Server-authoritative and conversation-blind: it re-resolves every item against the
-- map whatever the transcript said, which is why prompt injection cannot reach it.
create or replace function public.check_drug_safety(p_consult_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_patient uuid;
  v_ruleset text := coalesce(public.active_safety_ruleset(), 'unversioned');
  v_allergy_classes text[] := '{}';
  v_allergy_names   text[] := '{}';
  v_med_classes     text[] := '{}';
  v_meds_text       text := '';
  v_item jsonb; v_other jsonb;
  v_name text; v_norm text; v_class text; v_other_class text;
  v_verdict public.safety_verdict; v_detail text; v_kind public.safety_check_kind;
  v_qty numeric; v_unit text; v_mg numeric; v_freq numeric; v_limit record;
  v_out jsonb := '[]'::jsonb;
  v_pair record;
begin
  select c.patient_id into v_patient from public.consults c where c.id = p_consult_id;
  if v_patient is null then
    raise exception 'consult_not_found' using errcode = 'PT404', detail = 'unknown consult';
  end if;

  -- Allergies: both the recorded class and the recorded substance resolved through
  -- the map. A record that only says "Penicillin" must still block amoxicillin.
  select coalesce(array_agg(distinct x), '{}') into v_allergy_classes
    from (
      select a->>'class' as x from public.patient_details pd,
             lateral jsonb_array_elements(coalesce(pd.allergies,'[]'::jsonb)) a
       where pd.profile_id = v_patient and coalesce(a->>'class','') <> ''
      union
      select m.drug_class from public.patient_details pd,
             lateral jsonb_array_elements(coalesce(pd.allergies,'[]'::jsonb)) a
        join public.drug_class_map m on m.drug_name = public.normalize_drug_name(a->>'substance')
       where pd.profile_id = v_patient
    ) s where x is not null;

  select coalesce(array_agg(distinct public.normalize_drug_name(a->>'substance')), '{}')
    into v_allergy_names
    from public.patient_details pd,
         lateral jsonb_array_elements(coalesce(pd.allergies,'[]'::jsonb)) a
   where pd.profile_id = v_patient and public.normalize_drug_name(a->>'substance') is not null;

  -- What the patient is already on: the record, plus the medications slot the
  -- consult filled. Interaction checking against nothing is not checking.
  select coalesce(string_agg(t, ' '), '') into v_meds_text from (
    select coalesce(pd.medications::text, '') as t
      from public.patient_details pd where pd.profile_id = v_patient
    union all
    select coalesce(s.value, '') from public.consult_slots s
     where s.consult_id = p_consult_id and s.slot_id = 'current_medications' and s.status = 'filled'
  ) x;

  select coalesce(array_agg(distinct m.drug_class), '{}') into v_med_classes
    from public.drug_class_map m
   where length(m.drug_name) >= 4 and v_meds_text ilike '%' || m.drug_name || '%';

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_name := coalesce(v_item->>'name', '');
    v_norm := public.normalize_drug_name(v_name);
    select m.drug_class into v_class from public.drug_class_map m where m.drug_name = v_norm;

    -- 1. Allergy class.
    v_kind := 'allergy_class';
    if v_norm is not null and v_norm = any(v_allergy_names) then
      v_verdict := 'block';
      v_detail := v_name || ' is itself a recorded allergy for this patient.';
    elsif v_class is not null and v_class = any(v_allergy_classes) then
      v_verdict := 'block';
      v_detail := v_name || ' is ' || v_class || '; the record carries an allergy in that class.';
    elsif v_class in ('cephalosporin','carbapenem') and 'beta_lactam' = any(v_allergy_classes) then
      v_verdict := 'caution';
      v_detail := v_name || ' is a ' || v_class || ' with a recorded beta-lactam allergy: cross-reactivity possible.';
    elsif v_class is null and coalesce(v_item->>'dosage', '') <> '' then
      -- A dosed item the map does not know is not "clear"; it is unchecked, and the
      -- doctor is told so rather than shown a green tick nobody earned.
      v_verdict := 'caution';
      v_detail := v_name || ' is not in ruleset ' || v_ruleset || '; no allergy or interaction check could be made against it.';
    else
      v_verdict := 'clear';
      v_detail := 'No class match against ' || coalesce(array_length(v_allergy_classes,1), 0) || ' recorded allergy classes.';
    end if;

    insert into public.safety_checks (consult_id, item_name, check_kind, verdict, detail, ruleset_version)
    values (p_consult_id, v_name, v_kind, v_verdict, v_detail, v_ruleset);
    v_out := v_out || jsonb_build_object('item', v_name, 'kind', v_kind, 'verdict', v_verdict,
                                         'reason', v_detail, 'ruleset_version', v_ruleset);

    if v_class is null then continue; end if;

    -- 2. Interactions: against the rest of this draft, and against what the patient
    --    is already taking.
    for v_other in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      if v_other->>'name' = v_name then continue; end if;
      select m.drug_class into v_other_class from public.drug_class_map m
       where m.drug_name = public.normalize_drug_name(v_other->>'name');
      if v_other_class is null then continue; end if;
      select * into v_pair from public.drug_interactions i
       where i.class_a = least(v_class, v_other_class) and i.class_b = greatest(v_class, v_other_class);
      if found then
        insert into public.safety_checks (consult_id, item_name, check_kind, verdict, detail, ruleset_version)
        values (p_consult_id, v_name, 'interaction', v_pair.verdict,
                v_name || ' with ' || (v_other->>'name') || ': ' || v_pair.detail, v_ruleset);
        v_out := v_out || jsonb_build_object('item', v_name, 'kind', 'interaction',
                   'verdict', v_pair.verdict,
                   'reason', v_name || ' with ' || (v_other->>'name') || ': ' || v_pair.detail,
                   'ruleset_version', v_ruleset);
      end if;
    end loop;

    foreach v_other_class in array v_med_classes loop
      select * into v_pair from public.drug_interactions i
       where i.class_a = least(v_class, v_other_class) and i.class_b = greatest(v_class, v_other_class);
      if found then
        insert into public.safety_checks (consult_id, item_name, check_kind, verdict, detail, ruleset_version)
        values (p_consult_id, v_name, 'interaction', v_pair.verdict,
                v_name || ' against the patient''s current ' || v_other_class || ': ' || v_pair.detail, v_ruleset);
        v_out := v_out || jsonb_build_object('item', v_name, 'kind', 'interaction',
                   'verdict', v_pair.verdict,
                   'reason', v_name || ' against the patient''s current ' || v_other_class || ': ' || v_pair.detail,
                   'ruleset_version', v_ruleset);
      end if;
    end loop;

    -- 3. Dose sanity. Silent when the ruleset has no ceiling for the drug: an
    --    invented limit is worse than an absent one.
    select * into v_limit from public.dose_limits d where d.drug_name = v_norm;
    if found then
      v_qty  := nullif(substring(lower(coalesce(v_item->>'dosage','')) from '([0-9]+(?:\.[0-9]+)?)'), '')::numeric;
      v_unit := substring(lower(coalesce(v_item->>'dosage','')) from '(mg|mcg|ug|g)\y');
      if v_qty is not null then
        v_mg := case when v_unit = 'g' then v_qty * 1000
                     when v_unit in ('mcg','ug') then v_qty / 1000
                     else v_qty end;
        v_freq := case
          when lower(coalesce(v_item->>'timing','')) ~ '(four times|qds|every 6 hours)' then 4
          when lower(coalesce(v_item->>'timing','')) ~ '(three times|tds|every 8 hours)' then 3
          when lower(coalesce(v_item->>'timing','')) ~ '(twice|two times|bd|every 12 hours)' then 2
          when lower(coalesce(v_item->>'timing','')) ~ '(every 4 hours)' then 6
          else 1 end;
        if v_limit.max_single_mg is not null and v_mg > v_limit.max_single_mg then
          v_detail := v_name || ': ' || v_mg || ' mg exceeds the single-dose ceiling of '
                      || v_limit.max_single_mg || ' mg in ruleset ' || v_ruleset || '.';
          v_verdict := 'block';
        elsif v_limit.max_daily_mg is not null and v_mg * v_freq > v_limit.max_daily_mg then
          v_detail := v_name || ': ' || (v_mg * v_freq) || ' mg per day exceeds the daily ceiling of '
                      || v_limit.max_daily_mg || ' mg in ruleset ' || v_ruleset || '.';
          v_verdict := 'block';
        else
          v_detail := v_name || ': within the ruleset ceiling.';
          v_verdict := 'clear';
        end if;
        insert into public.safety_checks (consult_id, item_name, check_kind, verdict, detail, ruleset_version)
        values (p_consult_id, v_name, 'dose_sanity', v_verdict, v_detail, v_ruleset);
        v_out := v_out || jsonb_build_object('item', v_name, 'kind', 'dose_sanity', 'verdict', v_verdict,
                                             'reason', v_detail, 'ruleset_version', v_ruleset);
      end if;
    end if;
  end loop;

  return v_out;
end $fn$;

-- ------------------------------------------------------------ the turn write
-- Replaces the 0010 contract: the same row writes, plus the red-flag screen, the
-- working differential and the protocol pin. Dropped rather than overloaded so
-- there is one path and not a weaker one beside it.
drop function if exists public.ai_record_turn(uuid, text, text, public.message_channel, jsonb);

create or replace function public.ai_record_turn(
  p_consult_id uuid, p_patient_text text, p_ai_text text,
  p_channel public.message_channel default 'text', p_slots jsonb default '[]'::jsonb,
  p_screen jsonb default '{}'::jsonb, p_working_dx jsonb default null,
  p_protocol_version_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare c public.consults%rowtype; v_patient_msg uuid; v_ai_msg uuid; s jsonb; v_complaint text;
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
      set status = excluded.status, value = coalesce(excluded.value, consult_slots.value),
          confidence = excluded.confidence, source = excluded.source,
          evidence_message_id = coalesce(excluded.evidence_message_id, consult_slots.evidence_message_id),
          evidence_span = coalesce(excluded.evidence_span, consult_slots.evidence_span),
          attempts = least(consult_slots.attempts + 1, 2), updated_at = now();

    insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
    values (p_consult_id, c.hospital_id, 'slot_filled', 'ai',
            jsonb_build_object('slot_id', s->>'slot_id', 'status', coalesce(s->>'status','filled'),
                               'confidence', s->>'confidence', 'source', coalesce(s->>'source','patient')));
  end loop;

  select value into v_complaint from public.consult_slots
   where consult_id = p_consult_id and slot_id = 'presenting_complaint' and status = 'filled';

  update public.consults
     set last_patient_turn_at = now(),
         chief_complaint = coalesce(v_complaint, chief_complaint, nullif(p_patient_text, '')),
         protocol_version_id = coalesce(p_protocol_version_id, protocol_version_id),
         working_dx = coalesce(p_working_dx, working_dx),
         -- The screen merges forward: a positive verdict already recorded by
         -- raise_red_flag is never overwritten by a later turn.
         red_flag_screen = (
           select coalesce(jsonb_object_agg(keys.k, v.val), '{}'::jsonb)
             from jsonb_object_keys(coalesce(consults.red_flag_screen,'{}'::jsonb)
                                    || coalesce(p_screen,'{}'::jsonb)) as keys(k),
             lateral (select case
                        when coalesce(consults.red_flag_screen -> keys.k ->> 'verdict','') = 'positive'
                          then consults.red_flag_screen -> keys.k
                        else coalesce(p_screen -> keys.k, consults.red_flag_screen -> keys.k)
                      end as val) v),
         channel_mix = jsonb_set(coalesce(channel_mix, '{}'::jsonb),
                                 array[p_channel::text || '_turns'],
                                 to_jsonb(coalesce((channel_mix->>(p_channel::text || '_turns'))::int, 0) + 1))
   where id = p_consult_id;

  return jsonb_build_object('message_id', coalesce(v_ai_msg, v_patient_msg),
                            'patient_message_id', v_patient_msg,
                            'ai_message_id', v_ai_msg,
                            'slots_changed', (select coalesce(jsonb_agg(x->>'slot_id'), '[]'::jsonb)
                                                from jsonb_array_elements(coalesce(p_slots,'[]'::jsonb)) x));
end $fn$;

-- ---------------------------------------------- every tool call is auditable
create or replace function public.ai_record_tool_call(
  p_consult_id uuid, p_mode public.agent_mode, p_tool text, p_args jsonb,
  p_outcome text, p_detail jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare v_h uuid; v_id uuid;
begin
  select hospital_id into v_h from public.consults where id = p_consult_id;
  if v_h is null then raise exception 'consult_not_found' using errcode = 'PT404'; end if;
  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, v_h, 'tool_call', 'ai',
          jsonb_build_object('mode', p_mode, 'tool', p_tool, 'args', p_args,
                             'outcome', p_outcome, 'detail', p_detail))
  returning id into v_id;
  return v_id;
end $fn$;

-- --------------------------------------------------------- the conclude write
-- Replaces the 0010 body, same signature. Three things are added, all of them the
-- kind of rule a prompt cannot keep:
--   line 2 (§5.2) — an item the session never put through check_drug_safety is
--                   refused, so skipping the tool costs the draft;
--   line 3 (§5.2) — the validator re-resolves everything anyway, and a block means
--                   no draft row at all and a `needs_human` consult;
--   §5.7        — flags are the validator's, unapproved clinical content is named
--                   on the doctor's screen, and confidence is clamped, not claimed.
create or replace function public.ai_submit_draft(
  p_consult_id uuid, p_recommendation jsonb, p_note text,
  p_confidence public.confidence, p_unanswered text[] default '{}',
  p_raw jsonb default '{}'::jsonb, p_model text default 'unset',
  p_prompt_version text default 'mira-patient-v4')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare c public.consults%rowtype; v_safety jsonb; v_flags jsonb; v_draft public.ai_drafts%rowtype;
        v_next int; v_uncleared text[]; v_ruleset text := coalesce(public.active_safety_ruleset(), 'unversioned');
        v_protocol public.protocol_versions%rowtype; v_confidence public.confidence := p_confidence;
        v_positive text[]; v_ruleset_approved boolean; v_urgency public.urgency;
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

  -- §5.2 line 2. Every drug-shaped item must already carry a check from this
  -- session. The model cannot skip check_drug_safety, because skipping it means the
  -- draft is not created.
  select coalesce(array_agg(i->>'name'), '{}') into v_uncleared
    from jsonb_array_elements(coalesce(p_recommendation->'items','[]'::jsonb)) i
   where (coalesce(i->>'dosage','') <> ''
          or exists (select 1 from public.drug_class_map m
                      where m.drug_name = public.normalize_drug_name(i->>'name')))
     and not exists (select 1 from public.safety_checks sc
                      where sc.consult_id = p_consult_id
                        and public.normalize_drug_name(sc.item_name)
                            is not distinct from public.normalize_drug_name(i->>'name'));
  if array_length(v_uncleared, 1) > 0 then
    raise exception 'safety_not_cleared' using errcode = 'PT422',
      detail = 'these items were never put through check_drug_safety: ' || array_to_string(v_uncleared, ', ');
  end if;

  -- §5.2 line 3. Independent of anything the conversation contained.
  v_safety := public.check_drug_safety(p_consult_id, coalesce(p_recommendation->'items', '[]'::jsonb));

  if exists (select 1 from jsonb_array_elements(v_safety) s where s->>'verdict' = 'block') then
    perform set_config('vd.actor', 'ai', true);
    perform set_config('vd.actor_id', '', true);
    update public.consults set status = 'needs_human' where id = p_consult_id;
    insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
    values (p_consult_id, c.hospital_id, 'safety_check', 'system',
            jsonb_build_object('outcome','blocked','ruleset_version', v_ruleset, 'checks', v_safety));
    return jsonb_build_object('draft_id', null, 'status', 'needs_human', 'safety', v_safety);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', 'safety_' || (s->>'verdict') || '_' || coalesce(s->>'kind','allergy_class'),
           'severity', case when s->>'verdict' = 'caution' then 'warn' else 'info' end,
           'text', s->>'reason', 'source', 'validator')), '[]'::jsonb)
    into v_flags from jsonb_array_elements(v_safety) s;

  -- §5.7 — what the doctor must always see, computed here and not claimed by a model.
  select coalesce(array_agg(k), '{}') into v_positive
    from jsonb_each(coalesce(c.red_flag_screen, '{}'::jsonb)) e(k, val)
   where val->>'verdict' = 'positive';
  if array_length(v_positive, 1) > 0 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code','red_flag_positive','severity','critical','source','validator',
      'text','Red flag positive during history: ' || array_to_string(v_positive, ', ')
             || '. The emergency script was delivered to the patient.'));
    v_confidence := 'low';
  end if;

  if array_length(p_unanswered, 1) > 0 then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code','slots_unanswered','severity','warn','source','validator',
      'text','Not established during the consult: ' || array_to_string(p_unanswered, ', ')));
  end if;

  select * into v_protocol from public.protocol_versions where id = c.protocol_version_id;
  if c.protocol_version_id is null then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code','protocol_unregistered','severity','warn','source','validator',
      'text','No complaint protocol was registered for this consult.'));
    v_confidence := 'low';
  elsif v_protocol.approved_at is null then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code','protocol_unapproved','severity','warn','source','validator',
      'text','Protocol ' || v_protocol.complaint_key || ' ' || v_protocol.version
             || ' has no clinician sign-off.'));
    v_confidence := 'low';
  end if;

  select (approved_at is not null) into v_ruleset_approved
    from public.safety_rulesets where version = v_ruleset;
  if not coalesce(v_ruleset_approved, false) then
    v_flags := v_flags || jsonb_build_array(jsonb_build_object(
      'code','ruleset_unapproved','severity','warn','source','validator',
      'text','Safety ruleset ' || v_ruleset || ' has no clinician sign-off; treat every item as unchecked.'));
    v_confidence := 'low';
  end if;

  select coalesce(max(version), 0) + 1 into v_next from public.ai_drafts where consult_id = p_consult_id;
  update public.ai_drafts set superseded_at = now()
   where consult_id = p_consult_id and superseded_at is null;

  insert into public.ai_drafts (consult_id, hospital_id, version, created_by, recommendation, note,
                                confidence, flags, unanswered_slots, raw_response, model,
                                protocol_version_id, prompt_version)
  values (p_consult_id, c.hospital_id, v_next, 'doctor_agent', p_recommendation, p_note,
          v_confidence, v_flags, coalesce(p_unanswered, '{}'), p_raw, p_model,
          c.protocol_version_id, p_prompt_version)
  returning * into v_draft;

  update public.safety_checks set draft_id = v_draft.id
   where consult_id = p_consult_id and draft_id is null;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'draft_created', 'ai',
          jsonb_build_object('draft_id', v_draft.id, 'version', v_draft.version,
                             'content_hash', v_draft.content_hash,
                             'protocol_version_id', c.protocol_version_id,
                             'ruleset_version', v_ruleset));

  v_urgency := case when array_length(v_positive, 1) > 0 then 'urgent'::public.urgency
                    else coalesce((p_recommendation->>'urgency')::public.urgency, c.urgency) end;

  perform set_config('vd.actor', 'ai', true);
  perform set_config('vd.actor_id', '', true);
  update public.consults
     set status = 'pending_review', submitted_at = now(), urgency = v_urgency
   where id = p_consult_id;

  insert into public.consult_events (consult_id, hospital_id, event_type, actor, payload)
  values (p_consult_id, c.hospital_id, 'queued', 'ai', jsonb_build_object('draft_id', v_draft.id));

  return jsonb_build_object('draft_id', v_draft.id, 'version', v_draft.version,
                            'content_hash', v_draft.content_hash, 'status', 'pending_review',
                            'confidence', v_confidence, 'flags', v_flags, 'safety', v_safety);
end $fn$;

-- ------------------------------------------------------------------- execute ACL
revoke execute on function public.register_protocol_version(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.raise_red_flag(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.ai_record_turn(uuid, text, text, public.message_channel, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.ai_record_tool_call(uuid, public.agent_mode, text, jsonb, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ai_submit_draft(uuid, jsonb, text, public.confidence, text[], jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.check_drug_safety(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.normalize_drug_name(text) from public;
revoke execute on function public.active_safety_ruleset() from public;

grant execute on function public.register_protocol_version(text, text, text, text) to service_role;
grant execute on function public.raise_red_flag(uuid, text, text, text) to service_role;
grant execute on function public.ai_record_turn(uuid, text, text, public.message_channel, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.ai_record_tool_call(uuid, public.agent_mode, text, jsonb, text, jsonb) to service_role;
grant execute on function public.ai_submit_draft(uuid, jsonb, text, public.confidence, text[], jsonb, text, text) to service_role;
grant execute on function public.check_drug_safety(uuid, jsonb) to service_role;
grant execute on function public.normalize_drug_name(text) to authenticated, service_role;
grant execute on function public.active_safety_ruleset() to authenticated, service_role;
