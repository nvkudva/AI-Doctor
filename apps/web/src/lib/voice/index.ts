// Voice engine: turn-taking states plus the WebSpeech dev adapter.
// Google Cloud adapters (./google) activate when vd_google_key or
// VITE_GOOGLE_CLOUD_KEY is set; vd_voice_endpoint forces remote too.

import { googleKey, googleListenOnce, googleSpeak, stopGoogleAudio } from './google';

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
  try {
    if (localStorage.getItem('vd_voice_endpoint') || googleKey()) return 'remote';
  } catch { /* storage unavailable */ }
  return 'browser';
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
  if (googleKey()) return googleSpeak(text, opts);
  return browserSpeak(text, opts);
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
    return { cancel: () => { try { window.speechSynthesis.cancel(); } catch { /* noop */ } } };
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
  if (googleKey()) {
    const g = googleListenOnce(opts);
    if (g) return g;
  }
  return browserListenOnce(opts);
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
  try {
    window.speechSynthesis.cancel();
  } catch { /* noop */ }
  stopGoogleAudio();
}
