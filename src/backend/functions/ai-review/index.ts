// §4.2 row 20 — POST /functions/v1/ai-review
// Request:  { consult_id, text, mode: "qa" | "revise" }
// Response: SSE `token` events, then
//           { review_message_id, citations[], proposed_draft? }
// Errors:   422 uncited factual claim (regenerated once, then surfaced), 402 quota.
//
// There is no approve path here, and no tool that could stand for one: a coordinator
// turn produces a *proposed* revision object and persists nothing clinical.

import { ApiError, cors, errorResponse, fromPostgrest, requireUser, serviceClient, sse, tokenize } from '../_shared/http.ts';
import { getProvider } from '../_shared/ai.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();
    const consultId: string = body.consult_id;
    const mode: 'qa' | 'revise' = body.mode === 'revise' ? 'revise' : 'qa';
    const text: string = (body.text ?? '').toString();
    if (!consultId) throw new ApiError(400, 'consult_id_required', 'consult_id is required');

    // Read as the doctor: a consult outside their hospital simply is not there.
    const { data: consult, error: readErr } = await supabase
      .from('consults').select('id, hospital_id, status').eq('id', consultId).maybeSingle();
    if (readErr) throw fromPostgrest(readErr);
    if (!consult) throw new ApiError(403, 'forbidden', 'not a consult in your hospital');

    const { data: transcript, error: tErr } = await supabase
      .from('consult_messages').select('id, sender, content').eq('consult_id', consultId).order('seq');
    if (tErr) throw fromPostgrest(tErr);

    const { data: draft } = await supabase
      .from('ai_drafts').select('id, recommendation').eq('consult_id', consultId).is('superseded_at', null).maybeSingle();

    const admin = serviceClient();
    const provider = getProvider();

    const run = () => provider.reviewTurn({
      consultId, doctorText: text, mode,
      transcript: (transcript ?? []) as { id: string; sender: string; content: string }[],
      draft: draft?.recommendation ?? undefined,
    });

    let turn;
    try {
      turn = await run();
    } catch (_e) {
      throw new ApiError(503, 'model_unavailable', 'the assistant is unreachable', undefined, true);
    }

    return sse(async (send) => {
      for (const token of tokenize(turn.reply)) send('token', { token });

      // AGENT-EXPERIENCE §4.6 rule 3: an uncited factual claim is regenerated once,
      // then surfaced. It is never persisted.
      let persisted = await admin.rpc('ai_record_review_message', {
        p_consult_id: consultId, p_doctor_id: user.id, p_sender: 'ai',
        p_content: turn.reply, p_citations: turn.citations, p_channel: 'text',
      });

      if (persisted.error && persisted.error.code === 'PT422') {
        turn = await run();
        persisted = await admin.rpc('ai_record_review_message', {
          p_consult_id: consultId, p_doctor_id: user.id, p_sender: 'ai',
          p_content: turn.reply, p_citations: turn.citations, p_channel: 'text',
        });
      }
      if (persisted.error) throw fromPostgrest(persisted.error);

      await admin.rpc('ai_log_invocation', {
        p_consult_id: consultId, p_agent_id: 'coordinator_agent', p_mode: 'coordinator',
        p_model: provider.model, p_input_tokens: turn.usage.inputTokens,
        p_cached_input_tokens: turn.usage.cachedInputTokens, p_output_tokens: turn.usage.outputTokens,
        p_audio_seconds: 0, p_latency_ms: turn.usage.latencyMs,
        p_stop_reason: turn.stopReason, p_cost_usd: turn.usage.costUsd,
      });

      send('done', {
        review_message_id: persisted.data?.review_message_id ?? null,
        citations: turn.citations,
        // Rendered on screen; persisting it is a separate, deliberate call to
        // revise_draft (§4.2 row 21).
        proposed_draft: turn.proposedDraft ?? null,
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
});
