// Voice engine: turn-taking states over the browser's WebSpeech adapter.
// A hosted voice session is a Gemini Live session whose credential is minted by
// the voice-token Edge Function (§4.1 #8 / §4.2 #27) — never a provider key in
// this bundle, which is why the direct Google Cloud STT/TTS adapter is gone.

import { realtimeConfigured, remoteListenOnce, remoteSpeak, remoteStopAll } from './realtime';

export { onVoiceHealth, voiceDegraded } from './realtime';

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

// Web Speech API is not in TS's DOM lib — minimal structural declarations.
interface SpeechRecognition extends EventTarget {
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

export interface SpeakHandle {
  cancel(): void;
}

export interface ListenHandle {
  abort(): void;
}

export function voiceBackend(): 'browser' | 'remote' {
  return realtimeConfigured() ? 'remote' : 'browser';
}

export function pickVoice(voices: SpeechSynthesisVoice[] | undefined): SpeechSynthesisVoice | undefined {
  const vs = voices || [];
  return (
    vs.find(x => /en/i.test(x.lang) && /female|samantha|karen|victoria|zira|google uk english female/i.test(x.name)) ||
    vs.find(x => /en/i.test(x.lang))
  );
}

function recognitionCtor(): (new () => SpeechRecognition) | null {
  try {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  } catch {
    return null;
  }
}

export function speak(text: string, opts: { onDone?: () => void } = {}): SpeakHandle {
  // onDone submits the consult, so it must fire at most once per utterance:
  // Chromium fires both `end` and `error` when speechSynthesis.cancel()
  // interrupts, which used to file the same consult twice (UX-01).
  let fired = false;
  const once = { onDone: () => { if (fired) return; fired = true; opts.onDone && opts.onDone(); } };
  // The remote server will not generate until the conversation holds a patient
  // turn, so Mira's opening line is still spoken by the browser.
  if (realtimeConfigured()) {
    // The remote voice hands the line back if the server strays from it.
    let fell: SpeakHandle | null = null;
    const remote = remoteSpeak(text, { ...once, onFallback: () => { fell = browserSpeak(text, once); } });
    return { cancel: () => { remote.cancel(); fell && fell.cancel(); once.onDone(); } };
  }
  return browserSpeak(text, once);
}

function browserSpeak(text: string, opts: { onDone?: () => void } = {}): SpeakHandle {
  const done = () => opts.onDone && opts.onDone();
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(window.speechSynthesis.getVoices());
    if (v) u.voice = v;
    u.rate = 0.98;
    u.pitch = 1.05;
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    // Cancelling resolves here too, so the fallback voice takes turns by the
    // same contract as the server's: cancel(), then the caller's continuation
    // listens. `once` upstream absorbs the `end` the cancel itself fires.
    return {
      cancel: () => {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        done();
      },
    };
  } catch {
    done();
    return { cancel: () => {} };
  }
}

export function listenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
}): ListenHandle | null {
  if (!realtimeConfigured()) return browserListenOnce(opts);
  // The remote listener may only discover the server is gone after the mic is
  // already open, so the handle it returns is a stand-in: if it hands back, the
  // browser's own recogniser takes the same turn and the caller never knows.
  let inner: ListenHandle | null = null;
  let aborted = false;
  inner = remoteListenOnce({
    ...opts,
    onUnavailable: () => {
      if (aborted) return;
      inner = browserListenOnce(opts);
      if (!inner) opts.onError && opts.onError('other');
    },
  });
  if (!inner) return null;
  return { abort: () => { aborted = true; inner && inner.abort(); } };
}

function browserListenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
}): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    opts.onError && opts.onError('other');
    return null;
  }
  try {
    const r: SpeechRecognition = new Ctor();
    r.lang = 'en-US';
    (r as any).interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (ev: any) => opts.onText(ev.results[0][0].transcript);
    r.onerror = (ev: any) =>
      opts.onError && opts.onError(ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') ? 'denied' : 'other');
    r.onend = () => opts.onEnd && opts.onEnd();
    r.start();
    return {
      abort: () => {
        try {
          r.onend = null;
          r.onresult = null;
          r.abort();
        } catch { /* noop */ }
      },
    };
  } catch {
    opts.onError && opts.onError('other');
    return null;
  }
}

export function stopAllVoice(): void {
  if (realtimeConfigured()) remoteStopAll();
  try {
    window.speechSynthesis.cancel();
  } catch { /* noop */ }
}
