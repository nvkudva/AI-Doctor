// The brain engine. Provider chosen in config.ts only:
//   local — SmolLM2-360M-Instruct in the browser (Transformers.js, q4/WASM)
//   api   — any OpenAI-compatible chat endpoint (frontier switch)
//
// No fallback brain: a turn waits for the local model to load, and a load
// failure returns null so the caller surfaces an error instead of being
// answered by a script.

import { modelConfig } from './config';
import type { ChatMessage } from '../api/ai';

interface CompleteArgs {
  system: string;
  messages: ChatMessage[];
  max_tokens?: number;
}

type Generator = (messages: ChatMessage[], opts: Record<string, unknown>) => Promise<any>;

let generator: Generator | null = null;
let loading: Promise<Generator | null> | null = null;
let loadFailed = false;

async function loadLocal(): Promise<Generator | null> {
  if (generator) return generator;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const { local } = modelConfig.brain;
      const pipe: any = await pipeline('text-generation', local.modelId, {
        dtype: local.dtype,
        device: local.device,
      });
      generator = (messages, opts) => pipe(messages, opts);
      return generator;
    } catch {
      loadFailed = true;
      return null;
    }
  })();
  return loading;
}

export function llmReady(): boolean {
  return modelConfig.brain.provider === 'api' ? !!modelConfig.brain.api.model : !!generator;
}

export function warmLlm(): void {
  if (modelConfig.brain.provider === 'local' && !loadFailed) void loadLocal();
}

async function apiComplete(args: CompleteArgs): Promise<string | null> {
  const { api } = modelConfig.brain;
  try {
    const res = await fetch(`${api.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: api.model,
        messages: [{ role: 'system', content: args.system }, ...args.messages],
        max_tokens: args.max_tokens || 800,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function localComplete(args: CompleteArgs): Promise<string | null> {
  if (loadFailed) return null;
  // No scripted fallback: a turn waits for the model (the caller is already
  // showing "thinking") rather than being answered by something else.
  if (!generator) await loadLocal();
  if (!generator) return null;
  try {
    const { local } = modelConfig.brain;
    const out: any = await generator(
      [{ role: 'system', content: args.system }, ...args.messages] as ChatMessage[],
      { max_new_tokens: Math.min(local.maxNewTokens, args.max_tokens || local.maxNewTokens), do_sample: false },
    );
    const generated = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text;
    if (typeof generated === 'string') return generated;
    if (Array.isArray(generated)) {
      const last = generated[generated.length - 1];
      return typeof last?.content === 'string' ? last.content : null;
    }
    return null;
  } catch {
    return null;
  }
}

const BRAIN_TIMEOUT_MS = 120000;

function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>(resolve => window.setTimeout(() => resolve(null), BRAIN_TIMEOUT_MS)),
  ]);
}

export function brainComplete(args: CompleteArgs): Promise<string | null> {
  // A stalled model download or generation must surface as an error the
  // caller can retry, not wedge the consult on "thinking" (QA P2). The
  // underlying load keeps running, so a retry is usually warm.
  return withTimeout(modelConfig.brain.provider === 'api' ? apiComplete(args) : localComplete(args));
}
