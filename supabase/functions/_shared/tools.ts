// The tool registry and the per-mode allowlist (AGENT-EXPERIENCE §4.3).
//
// THERE IS NO APPROVE TOOL, IN EITHER MODE. The absence is the design (§5.4 layer 1):
// there is no schema a model could emit that means "approve". `assertNoApprovalTool`
// below turns that from a convention into a load-time failure, and the database
// refuses the write regardless (`prescriptions` has no service_role insert grant).
//
// Everything the agent knows or does is one of these calls, executed HERE — on the
// server, with the patient resolved from the session and never from an argument a
// model supplied.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { matchProtocol, protocolContentHash, type Protocol } from './protocols/index.ts';

export type AgentMode = 'patient' | 'coordinator';

export const PATIENT_TOOL_NAMES = [
  'get_patient_record',
  'load_protocol',
  'record_slot',
  'raise_red_flag',
  'check_drug_safety',
  'propose_recommendation',
  'end_consult',
] as const;

export const COORDINATOR_TOOL_NAMES = [
  'get_consult_trace',
  'get_patient_record',
  'quote_transcript',
  'check_drug_safety',
  'propose_draft_revision',
  'record_doctor_feedback',
] as const;

export type ToolName = (typeof PATIENT_TOOL_NAMES)[number] | (typeof COORDINATOR_TOOL_NAMES)[number];

export const TOOL_ALLOWLIST: Record<AgentMode, readonly string[]> = {
  patient: PATIENT_TOOL_NAMES,
  coordinator: COORDINATOR_TOOL_NAMES,
};

/** Any name that could stand for signing off clinical content. */
const FORBIDDEN = /approv|sign|issue|dispense|authori[sz]|countersign|finali[sz]e|commit_prescription/i;

/**
 * Runs at module load. If anyone ever adds an approval-shaped tool to an allowlist,
 * every function that imports this file fails to start rather than exposing it.
 */
export function assertNoApprovalTool(): void {
  for (const [mode, names] of Object.entries(TOOL_ALLOWLIST)) {
    for (const name of names) {
      if (FORBIDDEN.test(name)) {
        throw new Error(
          `tool "${name}" in the ${mode} allowlist looks like an approval path. Approval is a doctor-authenticated endpoint (approve_consult), never a tool.`,
        );
      }
    }
  }
}
assertNoApprovalTool();

/** The Live session declares its own tools; this keeps the two from drifting. */
export function assertAllowlistMatches(mode: AgentMode, declared: readonly string[]): void {
  const allowed = [...TOOL_ALLOWLIST[mode]].sort();
  const given = [...declared].sort();
  if (allowed.length !== given.length || allowed.some((n, i) => n !== given[i])) {
    throw new Error(
      `voice session tool declarations for mode "${mode}" do not match the server allowlist: [${given}] vs [${allowed}]`,
    );
  }
}

export type ToolContext = {
  admin: SupabaseClient;
  consultId: string;
  hospitalId: string;
  patientId: string;
  /** Set in coordinator mode only. */
  doctorId?: string;
  mode: AgentMode;
};

export type ToolResult = { ok: boolean; [key: string]: unknown };

type Args = Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : String((v as Args)?.name ?? ''))).filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

/** The Live declaration passes items as strings; the validator wants objects. */
function asItems(value: unknown): { name: string; dosage: string; timing: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === 'string') return { name: entry, dosage: '', timing: '' };
    const o = entry as Args;
    return {
      name: String(o.name ?? ''),
      dosage: String(o.dosage ?? ''),
      timing: String(o.timing ?? ''),
    };
  }).filter((i) => i.name);
}

async function rpc(ctx: ToolContext, fn: string, params: Args): Promise<ToolResult> {
  const { data, error } = await ctx.admin.rpc(fn, params);
  if (error) return { ok: false, error: error.message, detail: error.details ?? null };
  return { ok: true, result: data };
}

/** Registers the protocol's exact content and pins it to the consult. */
export async function registerProtocol(ctx: ToolContext, protocol: Protocol): Promise<string | null> {
  const hash = await protocolContentHash(protocol);
  const { data, error } = await ctx.admin.rpc('register_protocol_version', {
    p_complaint_key: protocol.id,
    p_version: protocol.version,
    p_content_hash: hash,
    p_clinician_owner: protocol.clinicianOwner,
  });
  if (error) return null;
  return (data as string) ?? null;
}

const HANDLERS: Record<string, (ctx: ToolContext, args: Args) => Promise<ToolResult>> = {
  // The server resolves the patient from the session. An id in `args` is ignored,
  // not honoured (§4.3).
  async get_patient_record(ctx, args) {
    const sections = new Set(asStringArray(args.sections).map((s) => s.toLowerCase()));
    const want = (s: string) => sections.size === 0 || sections.has(s);
    const out: Record<string, unknown> = { patient_resolved_from: 'session' };

    if (want('allergies') || want('medications') || want('conditions') || want('profile')) {
      const { data } = await ctx.admin.from('patient_details')
        .select('date_of_birth, sex_at_birth, blood_group, allergies, medications, conditions')
        .eq('profile_id', ctx.patientId).maybeSingle();
      if (data) {
        if (want('profile')) out.profile = { sex_at_birth: data.sex_at_birth, blood_group: data.blood_group };
        if (want('allergies')) out.allergies = data.allergies ?? [];
        if (want('medications')) out.medications = data.medications ?? [];
        if (want('conditions')) out.conditions = data.conditions ?? [];
      }
    }
    if (want('prior_consults')) {
      const { data } = await ctx.admin.from('consults')
        .select('id, chief_complaint, status, created_at')
        .eq('patient_id', ctx.patientId).eq('hospital_id', ctx.hospitalId)
        .neq('id', ctx.consultId).order('created_at', { ascending: false }).limit(5);
      out.prior_consults = data ?? [];
    }
    if (want('labs')) {
      const { data } = await ctx.admin.from('lab_results')
        .select('analyte, value_text, abnormal_flag, observed_at')
        .eq('patient_id', ctx.patientId).order('observed_at', { ascending: false }).limit(10);
      out.labs = data ?? [];
    }
    return { ok: true, ...out };
  },

  async load_protocol(ctx, args) {
    const protocol = matchProtocol(String(args.complaint ?? ''));
    const id = await registerProtocol(ctx, protocol);
    return {
      ok: true,
      protocol_id: protocol.id,
      protocol_version: protocol.version,
      protocol_version_id: id,
      clinician_approved: false,
      red_flag_questions: protocol.redFlags.map((f) => ({ code: f.code, ask: f.ask, action: f.action })),
      required_slots: protocol.sufficientWhen.required,
      associated: protocol.associated,
    };
  },

  // The only way consult state changes. Written through the RPC so the event row and
  // the attempt counter are written with it.
  record_slot(ctx, args) {
    const slot = {
      slot_id: String(args.slot ?? args.slot_id ?? ''),
      status: 'filled',
      value: String(args.value ?? ''),
      confidence: Number(args.confidence ?? 0.6),
      source: 'patient',
    };
    if (!slot.slot_id || !slot.value) return Promise.resolve({ ok: false, error: 'slot and value are required' });
    return rpc(ctx, 'ai_record_turn', {
      p_consult_id: ctx.consultId,
      p_patient_text: '',
      p_ai_text: '',
      p_channel: 'voice',
      p_slots: [slot],
    });
  },

  // Deterministic escalation. Returns the verbatim script; the model does not choose
  // the words, and an unknown code still escalates.
  raise_red_flag(ctx, args) {
    return rpc(ctx, 'raise_red_flag', {
      p_consult_id: ctx.consultId,
      p_code: String(args.code ?? 'unspecified_emergency'),
      p_detector: 'model_tool',
      p_evidence: String(args.evidence ?? ''),
    });
  },

  // Server-authoritative. The verdict may not be overridden, and the row it writes is
  // what `ai_submit_draft` later demands as proof the check happened.
  check_drug_safety(ctx, args) {
    return rpc(ctx, 'check_drug_safety', {
      p_consult_id: ctx.consultId,
      p_items: asItems(args.items),
    });
  },

  // Creates the draft. Rejected by the database if any item was never checked, and
  // again if the validator blocks it — in which case no draft row exists at all.
  propose_recommendation(ctx, args) {
    const recommendation = {
      type: args.type === 'prescription' ? 'prescription' : 'investigation',
      title: String(args.title ?? 'Clinical review'),
      summary: String(args.summary ?? ''),
      items: asItems(args.items),
      advice: String(args.advice ?? ''),
      urgency: ['routine', 'soon', 'urgent'].includes(String(args.urgency)) ? String(args.urgency) : 'routine',
    };
    return rpc(ctx, 'ai_submit_draft', {
      p_consult_id: ctx.consultId,
      p_recommendation: recommendation,
      p_note: String(args.note ?? ''),
      p_confidence: 'low',
      p_unanswered: asStringArray(args.unanswered),
      p_raw: { source: 'voice_session_tool_call' },
      p_model: 'voice_session',
      p_prompt_version: 'mira-patient-v5',
    });
  },

  end_consult(ctx, args) {
    const reason = String(args.reason ?? 'patient_request');
    if (reason === 'sufficient') {
      // The clinical draft is never taken from the audio session: the conclude pass
      // runs server-side from the persisted transcript.
      return Promise.resolve({ ok: true, next: 'server_conclude_pass', reason });
    }
    return rpc(ctx, 'ai_escalate_to_human', { p_consult_id: ctx.consultId, p_reason: reason });
  },

  async get_consult_trace(ctx) {
    const { data, error } = await ctx.admin.from('consult_trace')
      .select('*').eq('consult_id', ctx.consultId).order('at');
    if (error) return { ok: false, error: error.message };
    return { ok: true, trace: data ?? [] };
  },

  // Literal spans with their message ids. Every factual claim must come from here.
  async quote_transcript(ctx, args) {
    const query = String(args.query ?? '').trim();
    let builder = ctx.admin.from('consult_messages')
      .select('id, sender, content, seq').eq('consult_id', ctx.consultId).order('seq');
    if (query) builder = builder.ilike('content', `%${query}%`);
    const { data, error } = await builder.limit(20);
    if (error) return { ok: false, error: error.message };
    const spans = (data ?? []).map((m) => {
      const at = query ? m.content.toLowerCase().indexOf(query.toLowerCase()) : 0;
      const start = Math.max(0, at);
      return { message_id: m.id, sender: m.sender, span: [start, start + (query.length || m.content.length)], quote: m.content.slice(start, start + Math.max(query.length, 160)) };
    });
    return { ok: true, matches: spans };
  },

  // Renders on screen; persists nothing. Persisting a revision is a separate,
  // doctor-authenticated call to revise_draft.
  propose_draft_revision(_ctx, args) {
    return Promise.resolve({ ok: true, persisted: false, proposed: args.patch ?? args });
  },

  async record_doctor_feedback(ctx, args) {
    if (!ctx.doctorId) return { ok: false, error: 'no doctor in this session' };
    const { error } = await ctx.admin.from('mira_feedback').insert({
      hospital_id: ctx.hospitalId,
      doctor_id: ctx.doctorId,
      consult_id: ctx.consultId,
      category: ['correction', 'style', 'protocol'].includes(String(args.category)) ? String(args.category) : 'correction',
      feedback: String(args.note ?? ''),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },
};

/**
 * The single entry point for a tool call, whether it came from the Live session or
 * from a server-side pass. The allowlist is checked here — a name outside the mode's
 * list is refused and audited, never executed.
 */
export async function executeTool(ctx: ToolContext, name: string, args: Args): Promise<ToolResult> {
  const allowed = TOOL_ALLOWLIST[ctx.mode].includes(name);
  const handler = HANDLERS[name];
  let result: ToolResult;

  if (!allowed || !handler) {
    result = { ok: false, error: 'tool_not_allowed', detail: `${name} is not in the ${ctx.mode} allowlist` };
  } else {
    try {
      result = await handler(ctx, args);
    } catch (e) {
      result = { ok: false, error: 'tool_failed', detail: e instanceof Error ? e.message : String(e) };
    }
  }

  await ctx.admin.rpc('ai_record_tool_call', {
    p_consult_id: ctx.consultId,
    p_mode: ctx.mode,
    p_tool: name,
    p_args: args,
    p_outcome: result.ok ? 'ok' : String(result.error ?? 'error'),
    p_detail: result.ok ? {} : result,
  });

  return result;
}
