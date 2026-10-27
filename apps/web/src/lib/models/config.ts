// ── THE provider switch ─────────────────────────────────────────────────────
// Every model Mira uses is chosen here, and only here. Engines
// (llm.ts, stt.ts, voice/kokoro.ts) read this file and nothing else decides
// where a turn runs.
//
// Switch to frontier models: set a provider to 'api', fill its model name,
// and put the key in apps/web/.env.local (VITE_BRAIN_API_KEY /
// VITE_STT_API_KEY). No other file changes. Keys are read from env, never
// written into this file.
//
// 'local' sizes, first-download only (browser-cached after):
//   brain  SmolLM2-360M-Instruct q4   ~230 MB
//   stt    distil-small.en q8         ~180 MB
//   tts    Kokoro-82M q8              ~92 MB (+21 MB ONNX WASM, shared)

export const modelConfig = {
  brain: {
    provider: 'local' as 'local' | 'api',
    local: {
      modelId: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
      dtype: 'q4' as const,
      device: 'wasm' as const,
      maxNewTokens: 220,
    },
    // Any OpenAI-compatible chat endpoint (OpenAI, Anthropic proxy, local gateway).
    api: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5-mini',
      apiKey: (import.meta.env.VITE_BRAIN_API_KEY as string | undefined) || '',
    },
  },
  stt: {
    provider: 'local' as 'local' | 'api',
    local: {
      modelId: 'onnx-community/distil-small.en',
      dtype: 'q8' as const,
      device: 'wasm' as const,
    },
    // OpenAI-compatible audio transcription endpoint.
    api: {
      baseUrl: 'https://api.openai.com/v1',
      model: 'whisper-1',
      apiKey: (import.meta.env.VITE_STT_API_KEY as string | undefined) || '',
    },
  },
  tts: {
    // Kokoro only — there is no OS-voice fallback behind it.
    provider: 'local' as 'local',
    local: {
      modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
      dtype: 'q8' as const,
      device: 'wasm' as const,
      voice: 'af_heart',
      speed: 1,
    },
  },
};
