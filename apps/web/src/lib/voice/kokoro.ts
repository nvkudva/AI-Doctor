// Kokoro-82M in the browser: natural local TTS, no server, no key.
// Model (~92 MB, q8/WASM) downloads once from Hugging Face on first use and
// stays in the browser cache. There is no OS-voice fallback: callers wait
// for this model (kokoroWhenReady) and resolve unsaid if it cannot load.

import type { SpeakHandle } from './index';
import { modelConfig } from '../models/config';

const MODEL_ID = modelConfig.tts.local.modelId;
const VOICE = modelConfig.tts.local.voice;

interface KokoroAudio {
  audio: Float32Array;
  sampling_rate: number;
}

interface KokoroModel {
  generate(text: string, opts: { voice: string; speed: number }): Promise<KokoroAudio>;
}

let model: KokoroModel | null = null;
let loading: Promise<KokoroModel | null> | null = null;
let loadFailed = false;

function loadKokoro(): Promise<KokoroModel | null> {
  if (model) return Promise.resolve(model);
  if (loading) return loading;
  loading = (async () => {
    try {
      const kokoro = await import('kokoro-js');
      const tts = await kokoro.KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: modelConfig.tts.local.dtype,
        device: modelConfig.tts.local.device,
      });
      model = tts as unknown as KokoroModel;
      return model;
    } catch {
      loadFailed = true;
      return null;
    }
  })();
  return loading;
}

export function kokoroReady(): boolean {
  return !!model;
}

export function warmKokoro(): void {
  if (!loadFailed) void loadKokoro();
}

/** True when the model is usable within timeoutMs; false on failure/timeout. */
export function kokoroWhenReady(timeoutMs: number): Promise<boolean> {
  if (modelConfig.tts.provider !== 'local' || loadFailed) return Promise.resolve(false);
  if (model) return Promise.resolve(true);
  return Promise.race([
    loadKokoro().then(loaded => !!loaded),
    new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

let audioCtx: AudioContext | null = null;
let playingSource: AudioBufferSourceNode | null = null;
let playToken = 0;

function stopPlayback(): void {
  playToken += 1;
  if (!playingSource) return;
  try {
    playingSource.onended = null;
    playingSource.stop();
  } catch { /* noop */ }
  playingSource = null;
}

export function stopKokoro(): void {
  stopPlayback();
}

export function kokoroSpeak(
  text: string,
  opts: { onDone?: () => void; onFallback?: () => void } = {},
): SpeakHandle | null {
  if (modelConfig.tts.provider !== 'local' || loadFailed || !text.trim()) return null;
  if (!model) {
    warmKokoro();
    return null;
  }
  const readyModel = model;
  stopPlayback();
  const token = playToken;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    opts.onDone && opts.onDone();
  };
  const fallback = () => {
    if (finished) return;
    finished = true;
    if (opts.onFallback) opts.onFallback();
    else opts.onDone && opts.onDone();
  };

  readyModel
    .generate(text, { voice: VOICE, speed: modelConfig.tts.local.speed })
    .then((rawAudio) => {
      if (finished) return;
      // Superseded by a newer line while generating: resolve this line's
      // continuation instead of dropping it (QA P2).
      if (token !== playToken) { finish(); return; }
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) {
        fallback();
        return;
      }
      if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctor() as AudioContext;
      const ctx = audioCtx!;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* noop */ });
      const buffer = ctx.createBuffer(1, rawAudio.audio.length, rawAudio.sampling_rate);
      buffer.getChannelData(0).set(rawAudio.audio);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      playingSource = source;
      source.onended = () => {
        if (playingSource === source) playingSource = null;
        finish();
      };
      source.start();
    })
    .catch(() => {
      if (token === playToken) fallback();
      else finish();
    });

  return {
    cancel: () => {
      stopPlayback();
      finish();
    },
  };
}
