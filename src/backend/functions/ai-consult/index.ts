// §4.1 row 7 — POST /functions/v1/ai-consult
// Request:  { consult_id, text?, audio_ref?, channel }
// Response: SSE `token` events, then a `done` event carrying
//           { message_id, slots_changed[], draft_id?, status }
// Errors:   402 quota, 409 consult not active, 503 model unavailable.
//
// On a model failure the consult stays `active` and the patient is told the truth.
// There is no scripted clinical fallback (AGENT-EXPERIENCE §5.6).

import { ApiError, cors, errorResponse, fromPostgrest, requireUser, serviceClient, sse, tokenize } from '../_shared/http.ts';
import { getProvider } from '../_shared/ai.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();
    const consultId: string = body.consult_id;
    const channel: 'voice' | 'text' = body.channel === 'voice' ? 'voice' : 'text';
    const text: string = (body.text ?? '').toString();
    if (!consultId) throw new ApiError(400, 'consult_id_required', 'consult_id is required');

    // Read as the caller: RLS decides whether this consult is theirs at all.
    const { data: consult, error: readErr } = await supabase
      .from('consults').select('id, status, patient_id, hospital_id').eq('id', consultId).maybeSingle();
    if (readErr) throw fromPostgrest(readErr);
    if (!consult) throw new ApiError(403, 'forbidden', 'not your consult');
    if (consult.patient_id !== user.id) throw new ApiError(403, 'forbidden', 'not your consult');
    if (consult.status !== 'active') {
      throw new ApiError(409, 'consult_not_active', `consult is ${consult.status}`);
    }

    const admin = serviceClient();

    const { error: quotaErr } = await admin.rpc('check_quota', { p_consult_id: consultId });
    if (quotaErr) throw fromPostgrest(quotaErr);

    const [{ data: slots }, { data: msgs }, { data: details }] = await Promise.all([
      admin.from('consult_slots').select('slot_id, status').eq('consult_id', consultId),
      admin.from('consult_messages').select('id').eq('consult_id', consultId),
      admin.from('patient_details').select('allergies').eq('profile_id', consult.patient_id).maybeSingle(),
    ]);

    const provider = getProvider();
    let turn;
    try {
      turn = await provider.consultTurn({
        consultId,
        patientText: text,
        filledSlots: (slots ?? []).filter((s) => s.status === 'filled').map((s) => s.slot_id),
        turnIndex: (msgs ?? []).length,
        // Injected server-side. The client cannot alter it (PRD A-3).
        allergies: (details?.allergies ?? []) as { substance: string; class: string }[],
      });
    } catch (_e) {
      throw new ApiError(503, 'model_unavailable', 'the assistant is unreachable; your consult is saved', undefined, true);
    }

    return sse(async (send) => {
      for (const token of tokenize(turn.reply)) send('token', { token });

      if (turn.stopReason === 'refusal') {
        const { error } = await admin.rpc('ai_escalate_to_human', {
          p_consult_id: consultId, p_reason: 'model_refusal',
        });
        if (error) throw fromPostgrest(error);
        send('done', { message_id: null, slots_changed: [], status: 'needs_human' });
        return;
      }

      const { data: recorded, error: turnErr } = await admin.rpc('ai_record_turn', {
        p_consult_id: consultId,
        p_patient_text: text,
        p_ai_text: turn.reply,
        p_channel: channel,
        p_slots: turn.slots,
      });
      if (turnErr) throw fromPostgrest(turnErr);

      let draftId: string | null = null;
      let status = 'active';

      if (turn.draft) {
        const { data: submitted, error: draftErr } = await admin.rpc('ai_submit_draft', {
          p_consult_id: consultId,
          p_recommendation: turn.draft.recommendation,
          p_note: turn.draft.note,
          p_confidence: turn.draft.confidence,
          p_unanswered: turn.draft.unanswered,
          p_raw: turn as unknown as Record<string, unknown>,
          p_model: provider.model,
          p_prompt_version: 'mira-patient-v4',
        });
        if (draftErr) throw fromPostgrest(draftErr);
        draftId = submitted?.draft_id ?? null;
        status = submitted?.status ?? 'active';
      }

      await admin.rpc('ai_log_invocation', {
        p_consult_id: consultId, p_agent_id: 'doctor_agent', p_mode: 'patient',
        p_model: provider.model, p_input_tokens: turn.usage.inputTokens,
        p_cached_input_tokens: turn.usage.cachedInputTokens, p_output_tokens: turn.usage.outputTokens,
        p_audio_seconds: 0, p_latency_ms: turn.usage.latencyMs,
        p_stop_reason: turn.stopReason, p_cost_usd: turn.usage.costUsd,
      });

      send('done', {
        message_id: recorded?.message_id ?? null,
        slots_changed: recorded?.slots_changed ?? [],
        draft_id: draftId,
        status,
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
});
