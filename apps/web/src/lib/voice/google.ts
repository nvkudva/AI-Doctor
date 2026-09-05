// Google Cloud voice adapters (STT v1 + TTS v1) behind the voice seam.
// Activated by lib/voice index when a key is present. Key source:
// localStorage vd_google_key (runtime) or VITE_GOOGLE_CLOUD_KEY (build).
// Free tiers: STT v1 ~60 min/mo, TTS Standard 4M / Neural2 1M chars/mo.

import type { ListenHandle, SpeakHandle } from './index';

const STT_URL = 'https://speech.googleapis.com/v1/speech:recognize';
const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const LANG = 'en-IN';
// Chirp 3 HD is the most natural family and shares the 1M chars/mo free
// tier. Override at runtime via localStorage vd_google_voice, e.g.
// en-US-Chirp3-HD-Kore. Locale is derived from the voice name prefix.
const DEFAULT_TTS_VOICE = 'en-US-Chirp3-HD-Aoede';

function ttsVoice(): { languageCode: string; name: string } {
  let name = DEFAULT_TTS_VOICE;
  try {
    const override = localStorage.getItem('vd_google_voice');
    if (override) name = override;
  } catch { /* storage unavailable */ }
  return { languageCode: name.split('-').slice(0, 2).join('-'), name };
}

export function googleKey(): string {
  try {
    const ls = localStorage.getItem('vd_google_key');
    if (ls) return ls;
  } catch { /* storage unavailable */ }
  try {
    return (import.meta as any)?.env?.VITE_GOOGLE_CLOUD_KEY || '';
  } catch {
    return '';
  }
}

let currentAudio: HTMLAudioElement | null = null;

export function stopGoogleAudio(): void {
  try {
    currentAudio?.pause();
  } catch { /* noop */ }
  currentAudio = null;
}

export function googleSpeak(text: string, opts: { onDone?: () => void } = {}): SpeakHandle {
  const done = () => opts.onDone && opts.onDone();
  const ctrl = new AbortController();
  let settled = false;
  const settle = (fn: () => void) => {
    if (!settled) {
      settled = true;
      fn();
    }
  };
  (async () => {
    const res = await fetch(`${TTS_URL}?key=${encodeURIComponent(googleKey())}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        input: { text },
        voice: ttsVoice(),
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1 },
      }),
    });
    if (!res.ok) throw new Error('TTS error ' + res.status);
    const data = await res.json();
    if (!data.audioContent) throw new Error('TTS empty response');
    const audio = new Audio('data:audio/mp3;base64,' + data.audioContent);
    currentAudio = audio;
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      settle(done);
    };
    audio.onerror = () => settle(done);
    await audio.play();
  })().catch(() => settle(done));
  return {
    cancel: () => {
      ctrl.abort();
      stopGoogleAudio();
      settled = true;
    },
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const b64 = String(r.result || '').split(',')[1];
      if (b64) resolve(b64);
      else reject(new Error('empty audio'));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function googleListenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
}): ListenHandle | null {
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return null;
  } catch {
    return null;
  }
  let stopped = false;
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let ctx: AudioContext | null = null;
  let silenceTimer: ReturnType<typeof setInterval> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (silenceTimer) clearInterval(silenceTimer);
    if (capTimer) clearTimeout(capTimer);
    silenceTimer = capTimer = null;
    try {
      rec?.state !== 'inactive' && rec?.stop();
    } catch { /* noop */ }
    try {
      stream?.getTracks().forEach(t => t.stop());
    } catch { /* noop */ }
    try {
      ctx?.close();
    } catch { /* noop */ }
    rec = stream = ctx = null;
  };

  const fail = (kind: 'denied' | 'other') => {
    if (stopped) return;
    stopped = true;
    cleanup();
    opts.onError && opts.onError(kind);
  };

  const transcribe = async (blob: Blob) => {
    try {
      const content = await blobToBase64(blob);
      const res = await fetch(`${STT_URL}?key=${encodeURIComponent(googleKey())}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          config: { encoding: 'WEBM_OPUS', languageCode: LANG },
          audio: { content },
        }),
      });
      if (!res.ok) throw new Error('STT error ' + res.status);
      const data = await res.json();
      const text = data.results?.[0]?.alternatives?.[0]?.transcript || '';
      if (stopped) return;
      stopped = true;
      if (text.trim()) opts.onText(text);
      opts.onEnd && opts.onEnd();
    } catch {
      fail('other');
    }
  };

  const finishRecording = () => {
    if (stopped || !rec) return;
    let chunks: Blob[] = [];
    try {
      if (Array.isArray((rec as any)._chunks)) chunks = [...(rec as any)._chunks];
    } catch { /* noop */ }
    stopped = true;
    cleanup();
    transcribe(new Blob(chunks, { type: 'audio/webm' }));
  };

  navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
    if (stopped) {
      s.getTracks().forEach(t => t.stop());
      return;
    }
    stream = s;
    const chunks: Blob[] = [];
    rec = new MediaRecorder(s, { mimeType: 'audio/webm;codecs=opus' });
    (rec as any)._chunks = chunks;
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.start(250);
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(s);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let quietSince = Date.now();
      const startedAt = Date.now();
      silenceTimer = setInterval(() => {
        if (stopped) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (rms > 0.02) quietSince = Date.now();
        if (Date.now() - startedAt > 1200 && Date.now() - quietSince > 1500) finishRecording();
      }, 200);
    } catch { /* without silence detection the cap timer still ends recording */ }
    capTimer = setTimeout(finishRecording, 45000);
  }).catch((e: any) => {
    fail(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'other');
  });

  return {
    abort: () => {
      if (stopped) return;
      stopped = true;
      cleanup();
    },
  };
}
