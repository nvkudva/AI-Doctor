// §4.1 row 7 — POST /functions/v1/ai-consult
// Request:  { consult_id, text?, audio_ref?, channel }
// Response: SSE `token` events, then a `done` event carrying
//           { message_id, slots_changed[], draft_id?, status }
// Errors:   402 quota, 409 consult not active, 503 model unavailable.
//
// Orchestration only. Every clinical decision — which question comes next, what
// counts as a red flag, whether a draft may exist — lives in _shared/agent.ts
// and the modules it calls, so it is testable without an HTTP layer and cannot
// be talked out of by a prompt (AGENT-EXPERIENCE §4.2).
//
// On a model failure the consult stays `active` and the patient is told the
// truth. There is no scripted clinical fallback (AGENT-EXPERIENCE §5.6).

import { ApiError, cors, errorResponse, fromPostgrest, requireUser, serviceClient, sse, tokenize } from '../_shared/http.ts';
import { getProvider } from '../_shared/ai.ts';
import { concludeStep, loadState, readBackText, runConclude, runPatientTurn } from '../_shared/agent.ts';

/** Wrap-up caps. A consult that runs past these is closed out, not abandoned. */
const CAPS = { maxTurns: 12, maxMinutes: 8 };

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

    // Quota does not abort a live consult — it forces the wrap-up gate, so the
    // patient still gets a read-back and a draft rather than a dead session.
    let quotaExhausted = false;
    const { error: quotaErr } = await admin.rpc('check_quota', { p_consult_id: consultId });
    if (quotaErr) {
      if (String(quotaErr.code) === 'PT402') quotaExhausted = true;
      else throw fromPostgrest(quotaErr);
    }

    const provider = getProvider();
    const state = await loadState(admin, consultId);

    let outcome;
    try {
      outcome = await runPatientTurn(admin, provider, {
        state, text, channel, caps: { ...CAPS, quotaExhausted },
      });
    } catch (_e) {
      throw new ApiError(503, 'model_unavailable', 'the assistant is unreachable; your consult is saved', undefined, true);
    }

    return sse(async (send) => {
      for (const token of tokenize(outcome.reply)) send('token', { token });

      // An emergency or a refusal has already moved the consult; nothing further
      // may be generated for it on this turn.
      if (outcome.status !== 'active') {
        send('done', {
          message_id: outcome.messageId,
          slots_changed: outcome.slotsChanged,
          draft_id: outcome.draftId,
          status: outcome.status,
          emergency: outcome.emergency,
          gate: outcome.gate,
        });
        return;
      }

      // The close is two beats: read the history back for correction, and only
      // on the following turn produce the draft (AGENT-EXPERIENCE §1.8).
      const step = concludeStep(state, CAPS);

      if (step === 'read_back') {
        const readBack = readBackText(state);
        for (const token of tokenize(' ' + readBack)) send('token', { token });
        const { error } = await admin.rpc('ai_record_turn', {
          p_consult_id: consultId, p_patient_text: null, p_ai_text: readBack,
          p_channel: channel, p_slots: [], p_screen: {},
          p_working_dx: { ...state.workingDx, read_back: true },
          p_protocol_version_id: state.protocolVersionId,
        });
        if (error) throw fromPostgrest(error);
        send('done', {
          message_id: outcome.messageId, slots_changed: outcome.slotsChanged,
          draft_id: null, status: 'active', gate: 'read_back',
        });
        return;
      }

      if (step === 'conclude') {
        let concluded;
        try {
          concluded = await runConclude(admin, provider, state);
        } catch (_e) {
          // The history is safe; the draft simply is not made this turn.
          send('done', {
            message_id: outcome.messageId, slots_changed: outcome.slotsChanged,
            draft_id: null, status: 'active', gate: 'conclude_failed',
          });
          return;
        }
        for (const token of tokenize(' ' + concluded.reply)) send('token', { token });
        send('done', {
          message_id: outcome.messageId, slots_changed: outcome.slotsChanged,
          draft_id: concluded.draftId, status: concluded.status,
          safety: concluded.safety, gate: 'conclude',
        });
        return;
      }

      send('done', {
        message_id: outcome.messageId,
        slots_changed: outcome.slotsChanged,
        draft_id: outcome.draftId,
        status: outcome.status,
        gate: outcome.gate,
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
});
