// Voice engine: turn-taking states over the local models (Kokoro out,
// Whisper in, providers in lib/models/config.ts). No OS-voice fallback:
// a line waits for Kokoro, and listening waits for Whisper.
// A hosted voice session is a Gemini Live session whose credential is minted by
// the voice-token Edge Function (§4.1 #8 / §4.2 #27) — never a provider key in
// this bundle, which is why the direct Google Cloud STT/TTS adapter is gone.

import { realtimeConfigured, remoteListenOnce, remoteSpeak, remoteStopAll } from './realtime';
import { kokoroSpeak, kokoroWhenReady, stopKokoro } from './kokoro';
import { sttWhenReady, whisperListenOnce } from '../models/stt';

export { onVoiceHealth, voiceDegraded } from './realtime';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface SpeakHandle {
  cancel(): void;
}

export interface ListenHandle {
  abort(): void;
}

export function voiceBackend(): 'local' | 'remote' {
  return realtimeConfigured() ? 'remote' : 'local';
}

export function speak(
  text: string,
  opts: {
    onDone?: () => void;
    /** The patient talked over her. Only the server transport can detect this;
     *  the browser's synthesiser hears nothing, so this simply never fires
     *  there and the tap-to-interrupt control remains the way in. */
    onBarge?: () => void;
  } = {},
): SpeakHandle {
  // onDone submits the consult, so it must fire at most once per utterance:
  // a cancel and a natural end can race, which used to file the same
  // consult twice (UX-01).
  let fired = false;
  const once = { onDone: () => { if (fired) return; fired = true; opts.onDone && opts.onDone(); } };
  // The remote server will not generate until the conversation holds a patient
  // turn, so Mira's opening line is spoken by Kokoro.
  if (realtimeConfigured()) {
    // The remote voice hands the line back if the server strays from it.
    let fell: SpeakHandle | null = null;
    const remote = remoteSpeak(text, {
      ...once,
      onBarge: opts.onBarge,
      onFallback: () => { fell = kokoroLine(text, once); },
    });
    return { cancel: () => { remote.cancel(); fell && fell.cancel(); once.onDone(); } };
  }
  return kokoroLine(text, once);
}

// How long a line may wait for Kokoro's first download. The panel warms the
// model on mount, so this is usually already spent. There is no OS voice
// behind this: if Kokoro cannot load, the line resolves unsaid (it is on
// screen as text) rather than coming out robotic.
const KOKORO_WAIT_MS = 120000;

function kokoroLine(text: string, opts: { onDone?: () => void }): SpeakHandle {
  let inner: SpeakHandle | null = null;
  let cancelled = false;
  const resolveUnsaid = () => {
    if (cancelled || inner) return;
    inner = { cancel: () => {} };
    opts.onDone && opts.onDone();
  };
  const startKokoro = (): boolean => {
    if (cancelled || inner) return true;
    const kokoro = kokoroSpeak(text, { onDone: opts.onDone, onFallback: resolveUnsaid });
    if (!kokoro) return false;
    inner = kokoro;
    return true;
  };
  if (!startKokoro()) {
    void kokoroWhenReady(KOKORO_WAIT_MS).then(ready => {
      if (cancelled || inner) return;
      if (!ready || !startKokoro()) resolveUnsaid();
    });
  }
  return {
    cancel: () => {
      cancelled = true;
      if (inner) inner.cancel();
      else opts.onDone && opts.onDone();
    },
  };
}

export function listenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
  onStart?: () => void;
}): ListenHandle | null {
  if (!realtimeConfigured()) return whisperLine(opts);
  // The remote listener may only discover the server is gone after the mic is
  // already open, so the handle it returns is a stand-in: if it hands back,
  // local Whisper takes the same turn and the caller never knows.
  let inner: ListenHandle | null = null;
  let aborted = false;
  opts.onStart && opts.onStart();
  inner = remoteListenOnce({
    ...opts,
    onUnavailable: () => {
      if (aborted) return;
      inner = whisperLine(opts);
    },
  });
  if (!inner) return null;
  return { abort: () => { aborted = true; inner && inner.abort(); } };
}

// How long listening may wait for Whisper's first download before giving
// the turn back as an error. Panel mount warms it, so this is rarely spent.
const STT_WAIT_MS = 120000;

// Whisper only. While it loads, the returned handle stands in and starts
// capture when the model lands; there is no browser recogniser behind it.
function whisperLine(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
  onStart?: () => void;
}): ListenHandle {
  const direct = whisperListenOnce(opts);
  if (direct) return direct;
  let inner: ListenHandle | null = null;
  let aborted = false;
  void sttWhenReady(STT_WAIT_MS).then(ready => {
    if (aborted) return;
    inner = ready ? whisperListenOnce(opts) : null;
    if (!inner) {
      opts.onError && opts.onError('other');
      opts.onEnd && opts.onEnd();
    }
  });
  return { abort: () => { aborted = true; inner && inner.abort(); } };
}

export function stopAllVoice(): void {
  stopKokoro();
  if (realtimeConfigured()) remoteStopAll();
}
