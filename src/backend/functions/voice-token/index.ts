// §4.1 row 8 and §4.2 row 27 — POST /functions/v1/voice-token
// Request:  { consult_id, mode?: "coordinator" }
// Response: { token, expires_at, session_config_hash, ... }
// Errors:   402 quota, 409 wrong status (plus 400/401/403, 501 unconfigured,
//           503 provider unavailable — all in the §4 envelope).
//
// The provider is Gemini Live (PRD A-2/A-6, ARCHITECTURE §5, AGENT-EXPERIENCE §2).
// This function is in the control path, not the audio path: it authorizes the caller,
// enforces the quota, assembles the session config, pins that config to a single-use
// ephemeral token, and hands the browser the token alone. `GEMINI_API_KEY` is read
// here and stays here — the browser never sees a provider key, which is the whole
// reason this endpoint exists (AP-3).

import { ApiError, cors, errorResponse, fromPostgrest, requireUser, serviceClient } from '../_shared/http.ts';
import {
  buildLiveConfig,
  DEFAULT_LIVE_MODEL,
  DEFAULT_LIVE_VOICE,
  LIVE_WS_URL,
  MAX_SESSION_MINUTES,
  mintEphemeralToken,
  ProviderError,
  START_WINDOW_SECONDS,
  type VoiceMode,
} from './gemini-live.ts';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Key order must not decide the hash, or the pin means nothing. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>).sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { supabase, user } = await requireUser(req);
    const body = await req.json();
    const consultId: string = body.consult_id;
    const mode: VoiceMode = body.mode === 'coordinator' ? 'coordinator' : 'patient';
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
    const aiConfig = hospital?.ai_config ?? {};

    // Voice minutes are the dominant cost line (PRD A-5), so a session is capped
    // twice: by the per-consult minute budget below, and by the hospital's daily
    // audio budget when it declares one. No number is invented — absent config,
    // there is no daily cap.
    const dailyAudioMinutes = Number(aiConfig?.quotas?.audio_minutes_per_day ?? 0);
    if (dailyAudioMinutes > 0) {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const { data: spent, error: spentErr } = await admin
        .from('agent_invocations').select('audio_seconds')
        .eq('hospital_id', consult.hospital_id).gte('created_at', since.toISOString());
      if (spentErr) throw fromPostgrest(spentErr);
      const usedMinutes = (spent ?? []).reduce((n, r) => n + Number(r.audio_seconds ?? 0), 0) / 60;
      if (usedMinutes >= dailyAudioMinutes) {
        throw new ApiError(
          402,
          'quota_exhausted',
          'the daily voice budget for this hospital is spent; the consult continues on the text channel',
          { used_minutes: Math.round(usedMinutes), allowed_minutes: dailyAudioMinutes },
        );
      }
    }

    // An audio-only Live session is capped at 15 min by the provider, and the token's
    // own expiry is what actually bounds it, so never mint one longer than that.
    const sessionMinutes = Math.max(
      1,
      Math.min(MAX_SESSION_MINUTES, Number(quota?.session_minutes ?? 12)),
    );

    const model = String(aiConfig?.voice_model ?? Deno.env.get('GEMINI_LIVE_MODEL') ?? DEFAULT_LIVE_MODEL);
    const voiceName = String(aiConfig?.voice_name ?? Deno.env.get('GEMINI_LIVE_VOICE') ?? DEFAULT_LIVE_VOICE);
    const personaId = String(aiConfig?.voice_persona_id ?? 'mira-warm-in');

    const liveConfig = buildLiveConfig({ mode, voiceName, personaId });

    // The pin covers everything the client must not be able to move: the model, the
    // whole locked config (persona text, tool allowlist, voice, modalities) and the
    // session bounds. The client can echo this hash back; it cannot forge the session,
    // because the same config is what the token itself is constrained to.
    const pinned = {
      mode,
      model,
      persona_id: personaId,
      session_minutes: sessionMinutes,
      audio_retention_days: Number(aiConfig?.audio_retention_days ?? 0),
      config: liveConfig,
    };
    const configHash = await sha256(JSON.stringify(canonical(pinned)));

    const provider = Deno.env.get('VOICE_PROVIDER') ?? 'gemini';
    if (provider !== 'gemini') {
      throw new ApiError(
        501,
        'voice_provider_unimplemented',
        `VOICE_PROVIDER='${provider}' has no implementation in this repo`,
        { session_config_hash: configHash },
      );
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ApiError(
        501,
        'voice_provider_unconfigured',
        'GEMINI_API_KEY is not set on this deployment; the text path is the same server path',
        { session_config_hash: configHash },
      );
    }

    const startedAt = Date.now();
    let minted;
    try {
      minted = await mintEphemeralToken({ apiKey, model, config: liveConfig, sessionMinutes });
    } catch (e) {
      if (e instanceof ProviderError) {
        // Never a scripted fallback and never a key in the browser: the consult
        // degrades to the text channel (PRD P-3a) and the client may retry.
        throw new ApiError(
          503,
          'voice_provider_unavailable',
          'the voice provider refused to mint a session',
          { provider_status: e.status, provider_detail: e.detail },
          true,
        );
      }
      throw e;
    }
    const latencyMs = Date.now() - startedAt;

    // §2.13. Nothing else in the system can observe audio seconds — the audio never
    // touches our servers — so what is recorded here is the ceiling this token
    // authorizes, bounded by the token's own expiry. It is an authorization, not a
    // measurement, which is what `session_authorized` says.
    const { error: logErr } = await admin.rpc('ai_log_invocation', {
      p_consult_id: consultId,
      p_agent_id: 'voice_session',
      p_mode: mode,
      p_model: model,
      p_input_tokens: 0,
      p_cached_input_tokens: 0,
      p_output_tokens: 0,
      p_audio_seconds: sessionMinutes * 60,
      p_latency_ms: latencyMs,
      p_stop_reason: 'session_authorized',
      p_cost_usd: 0,
    });
    if (logErr) throw fromPostgrest(logErr);

    return new Response(
      JSON.stringify({
        token: minted.token,
        expires_at: minted.expiresAt,
        session_config_hash: configHash,
        // Additive, so the client needs no build-time knowledge of the provider.
        ws_url: LIVE_WS_URL,
        model,
        mode,
        start_by: minted.startBy,
        start_window_seconds: START_WINDOW_SECONDS,
        session_minutes: sessionMinutes,
      }),
      { headers: { ...cors, 'content-type': 'application/json' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
});
