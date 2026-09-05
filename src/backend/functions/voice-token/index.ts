// §4.1 row 8 and §4.2 row 27 — POST /functions/v1/voice-token
// Request:  { consult_id, mode?: "coordinator" }
// Response: { token, expires_at, session_config_hash }
// Errors:   402 quota, 409 wrong status.
//
// DATA-MODEL §7 assumption 8: the voice provider is unsettled, so no provider
// session is minted here. This function does the half that is provider-independent
// — authorize the caller, enforce the quota, pin the session config and hash it —
// and refuses with `voice_provider_unconfigured` until VOICE_PROVIDER names an
// implementation whose credentials live in the function environment.

import { ApiError, cors, errorResponse, fromPostgrest, requireUser, serviceClient } from '../_shared/http.ts';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();
    const consultId: string = body.consult_id;
    const mode: 'patient' | 'coordinator' = body.mode === 'coordinator' ? 'coordinator' : 'patient';
    if (!consultId) throw new ApiError(400, 'consult_id_required', 'consult_id is required');

    const { data: consult, error } = await supabase
      .from('consults').select('id, status, patient_id, hospital_id').eq('id', consultId).maybeSingle();
    if (error) throw fromPostgrest(error);
    if (!consult) throw new ApiError(403, 'forbidden', 'not your consult');

    if (mode === 'patient') {
      if (consult.patient_id !== user.id) throw new ApiError(403, 'forbidden', 'not your consult');
      if (consult.status !== 'active') {
        throw new ApiError(409, 'consult_not_active', `consult is ${consult.status}`);
      }
    } else if (!['pending_review', 'needs_human'].includes(consult.status)) {
      throw new ApiError(409, 'consult_not_reviewable', `consult is ${consult.status}`);
    }

    const admin = serviceClient();
    const { data: quota, error: quotaErr } = await admin.rpc('check_quota', { p_consult_id: consultId });
    if (quotaErr) throw fromPostgrest(quotaErr);

    const { data: hospital } = await admin
      .from('hospitals').select('ai_config').eq('id', consult.hospital_id).maybeSingle();

    const sessionConfig = {
      mode,
      model: hospital?.ai_config?.model ?? 'claude-opus-5',
      persona: hospital?.ai_config?.voice_persona_id ?? 'mira-warm-in',
      session_minutes: quota?.session_minutes ?? 12,
      audio_retention_days: hospital?.ai_config?.audio_retention_days ?? 0,
    };
    const configHash = await sha256(JSON.stringify(sessionConfig));

    const providerName = Deno.env.get('VOICE_PROVIDER');
    if (!providerName) {
      throw new ApiError(
        501,
        'voice_provider_unconfigured',
        'no voice provider is configured; the text path is the same server path',
        { session_config_hash: configHash },
      );
    }

    throw new ApiError(
      501,
      'voice_provider_unimplemented',
      `VOICE_PROVIDER='${providerName}' has no implementation in this repo`,
      { session_config_hash: configHash },
    );
  } catch (e) {
    return errorResponse(e);
  }
});
