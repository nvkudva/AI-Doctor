// The brain seam — the offline half of the app. One provider, chosen in
// lib/models/config.ts (SmolLM2 local or a frontier API), and no fallback:
// if the brain cannot answer, aiComplete throws and the caller says so.
// With Supabase configured, a real model turn instead goes through
// ai-consult / ai-review, which hold the key server-side (§4 #7, #20).

import { brainComplete, llmReady } from '../models/llm';
import { modelConfig } from '../models/config';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function aiComplete(args: { system: string; messages: ChatMessage[]; max_tokens?: number }): Promise<string> {
  const brain = await brainComplete(args);
  if (brain) return brain;
  throw new Error('Brain unavailable: configured model did not answer');
}

export function aiBackendName(): string {
  if (modelConfig.brain.provider === 'api') return `api:${modelConfig.brain.api.model}`;
  return llmReady() ? 'smollm2-local' : 'smollm2-loading';
}
