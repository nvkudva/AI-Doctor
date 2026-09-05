// Shared plumbing for the (E) rows: CORS, the §4 error envelope, the two clients,
// and the SSE writer.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type ErrorBody = { code: string; message: string; detail?: unknown; retryable: boolean };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  const err = e instanceof ApiError
    ? e
    : new ApiError(500, 'internal_error', e instanceof Error ? e.message : String(e), undefined, true);
  const body: ErrorBody = { code: err.code, message: err.message, detail: err.detail, retryable: err.retryable };
  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

/** Maps a PostgREST error (PTnnn SQLSTATEs from the RPCs) onto the same envelope. */
export function fromPostgrest(e: { code?: string; message?: string; details?: string; hint?: string }): ApiError {
  const sqlstate = e.code ?? '';
  const status = /^PT\d{3}$/.test(sqlstate) ? Number(sqlstate.slice(2)) : 400;
  return new ApiError(status, e.message ?? 'request_failed', e.details ?? e.message ?? '', e.hint, status >= 500);
}

/** Runs as the caller: their JWT, their policies. Use this for anything readable. */
export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization) throw new ApiError(401, 'unauthenticated', 'missing Authorization header');
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
}

/** Runs as service_role — which has no insert grant on `prescriptions` (§3.4). */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(req: Request) {
  const supabase = userClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'unauthenticated', 'invalid or expired session');
  return { supabase, user: data.user };
}

export function sse(handler: (send: (event: string, data: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await handler(send);
      } catch (e) {
        const err = e instanceof ApiError
          ? { code: e.code, message: e.message, detail: e.detail, retryable: e.retryable }
          : { code: 'internal_error', message: String(e), retryable: true };
        send('error', err);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  });
}

/** Streams a reply as `token` events so the client renders it as it arrives. */
export function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}
