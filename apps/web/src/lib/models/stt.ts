// The ear engine. Provider chosen in config.ts only:
//   local — distil-small.en in the browser (Transformers.js, q8/WASM)
//   api   — any OpenAI-compatible transcription endpoint
//
// Until the local model is ready, listenOnce returns null and the caller
// waits for it (sttWhenReady) — there is no browser recogniser behind it.

import { modelConfig } from './config';
import type { ListenHandle } from '../voice/index';

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<any>;

let transcriber: Transcriber | null = null;
let loading: Promise<Transcriber | null> | null = null;
let loadFailed = false;

async function loadLocal(): Promise<Transcriber | null> {
  if (transcriber) return transcriber;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const { local } = modelConfig.stt;
      const pipe: any = await pipeline('automatic-speech-recognition', local.modelId, {
        dtype: local.dtype,
        device: local.device,
      });
      transcriber = (audio, opts) => pipe(audio, opts);
      return transcriber;
    } catch {
      loadFailed = true;
      return null;
    }
  })();
  return loading;
}

export function sttReady(): boolean {
  return !!transcriber;
}

export function warmStt(): void {
  if (modelConfig.stt.provider === 'local' && !loadFailed) void loadLocal();
}

/** True when the transcriber is usable within timeoutMs (API: immediate). */
export function sttWhenReady(timeoutMs: number): Promise<boolean> {
  if (modelConfig.stt.provider === 'api') return Promise.resolve(true);
  if (loadFailed) return Promise.resolve(false);
  if (transcriber) return Promise.resolve(true);
  return Promise.race([
    loadLocal().then(loaded => !!loaded),
    new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

/** Transcribes 16 kHz mono samples. Used by the mic listener and tests. */
export async function transcribeAudio(samples16k: Float32Array): Promise<string | null> {
  if (modelConfig.stt.provider === 'api') return null; // API path takes a blob; see whisperListenOnce note
  const ready = transcriber || (await loadLocal());
  if (!ready) return null;
  try {
    const out: any = await ready(samples16k, { sampling_rate: 16000 });
    return typeof out?.text === 'string' ? out.text.trim() || null : null;
  } catch {
    return null;
  }
}

function downsampleTo16k(samples: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return samples;
  const ratio = fromRate / 16000;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

const SILENCE_MS = 1400;
const NO_SPEECH_MS = 8000;
const MAX_TURN_MS = 20000;
const SPEECH_RMS = 0.015;

async function apiTranscribe(blob: Blob): Promise<string | null> {
  const { api } = modelConfig.stt;
  try {
    const form = new FormData();
    form.append('file', blob, 'turn.webm');
    form.append('model', api.model);
    const res = await fetch(`${api.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {},
      body: form,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return typeof data?.text === 'string' ? data.text.trim() || null : null;
  } catch {
    return null;
  }
}

export function whisperListenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
  /** Capture has actually started (mic stream live), not merely requested. */
  onStart?: () => void;
}): ListenHandle | null {
  const useApi = modelConfig.stt.provider === 'api';
  if (!useApi) {
    if (loadFailed) return null;
    if (!transcriber) {
      warmStt();
      return null;
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    opts.onError && opts.onError('other');
    return null;
  }

  let closed = false;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let recorder: MediaRecorder | null = null;
  const recorded: Blob[] = [];
  const chunks: Float32Array[] = [];
  let heardSpeech = false;
  let silenceFor = 0;
  let waitedFor = 0;
  const startedAt = Date.now();

  const cleanup = () => {
    try { node && node.disconnect(); } catch { /* noop */ }
    try { stream && stream.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    try { ctx && ctx.close(); } catch { /* noop */ }
    node = null; stream = null; ctx = null;
  };

  const finish = async () => {
    if (closed) return;
    closed = true;
    const rate = ctx?.sampleRate || 16000;
    const activeRecorder = recorder;
    recorder = null;
    cleanup();
    let text: string | null = null;
    if (heardSpeech && useApi && activeRecorder) {
      const blob = await new Promise<Blob | null>((resolve) => {
        activeRecorder.ondataavailable = (event) => { if (event.data.size) recorded.push(event.data); };
        activeRecorder.onstop = () => resolve(recorded.length ? new Blob(recorded, { type: activeRecorder.mimeType }) : null);
        try { activeRecorder.stop(); } catch { resolve(null); }
      });
      text = blob ? await apiTranscribe(blob) : null;
    } else if (heardSpeech) {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const all = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
      text = await transcribeAudio(downsampleTo16k(all, rate));
    }
    if (text) opts.onText(text);
    else opts.onError && opts.onError('other');
    opts.onEnd && opts.onEnd();
  };

  navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  }).then((media) => {
    if (closed) { media.getTracks().forEach(t => t.stop()); return; }
    stream = media;
    opts.onStart && opts.onStart();
    if (useApi && typeof MediaRecorder !== 'undefined') {
      try {
        recorder = new MediaRecorder(media);
        recorder.start(250);
      } catch { recorder = null; }
    }
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor() as AudioContext;
    const source = ctx.createMediaStreamSource(media);
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (event: AudioProcessingEvent) => {
      if (closed) return;
      const frame = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(frame));
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      const frameMs = (frame.length / (ctx?.sampleRate || 16000)) * 1000;
      if (rms > SPEECH_RMS) { heardSpeech = true; silenceFor = 0; }
      else if (heardSpeech) silenceFor += frameMs;
      else waitedFor += frameMs;
      if ((heardSpeech && silenceFor >= SILENCE_MS) || waitedFor >= NO_SPEECH_MS || Date.now() - startedAt >= MAX_TURN_MS) {
        void finish();
      }
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  }).catch(() => {
    if (closed) return;
    closed = true;
    opts.onError && opts.onError('denied');
    opts.onEnd && opts.onEnd();
  });

  return {
    abort: () => {
      if (closed) return;
      closed = true;
      try { recorder && recorder.stop(); } catch { /* noop */ }
      recorder = null;
      cleanup();
    },
  };
}
