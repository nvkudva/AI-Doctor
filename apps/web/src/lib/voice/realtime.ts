// Voice transport over an OpenAI-Realtime-compatible server (VITE_VOICE_WS_URL).
//
// This is a MICROPHONE AND SPEAKER, not a doctor: the clinical brain stays in
// the ai-consult Edge Function. The server is used for two things only —
// streaming STT of the patient's turn, and speaking Mira's reply text back.
// Its own session.instructions are left alone and its own answers are thrown
// away; every response we play is one we asked for verbatim.
//
// Verified against huggingface/speech-to-speech, which is GA-shaped but does
// not implement the whole surface:
//   - the language model refuses to generate unless the request carries a user
//     turn ("No user query found in messages"), so the line to speak rides in
//     response.input as a user message rather than in `instructions`, with
//     conversation:'none' so this priming turn stays out of the history the
//     patient's own turns accumulate in.
//   - turn_detection.create_response:false is ignored — the server answers on
//     its own after every user turn — so we send response.cancel as soon as a
//     turn lands and never enqueue audio we did not ask for.

import type { ListenHandle, SpeakHandle } from './index';

const WS_URL = (import.meta.env.VITE_VOICE_WS_URL as string | undefined) || '';

// The server's PCM is signed 16-bit mono; 24 kHz both ways keeps the mic path
// free of a hand-written resampler (the AudioContext does it for us).
const RATE = 24000;

// The server's Silero VAD closes a turn after this much silence, and each close
// transcribes the whole buffer so far. At the 300 ms default a mid-sentence
// breath split one utterance into two turns with different item_ids, the second
// transcript containing the first — which is where the duplicated sentence came
// from. 1200 ms rides over a natural pause and yields one transcript per turn.
const SILENCE_MS = 1200;

/** Residual guard: how long a transcript must stop growing before the turn is submitted. */
const SETTLE_MS = 250;

const REPEAT =
  'Repeat the following text exactly, word for word. Output only that text, nothing else.\n';

export function realtimeConfigured(): boolean {
  return !!WS_URL;
}

// Whether the server is currently reachable. A dead server is not an error the
// patient has to act on — the browser's own voice takes over — but it is worth
// saying once, because the voice changes and nothing else would explain it.
let down = false;
const health = new Set<(down: boolean) => void>();

export function voiceDegraded(): boolean {
  return down;
}

export function onVoiceHealth(cb: (down: boolean) => void): () => void {
  health.add(cb);
  return () => { health.delete(cb); };
}

function setDown(v: boolean) {
  if (down === v) return;
  down = v;
  for (const cb of Array.from(health)) cb(v);
}

type Listener = (ev: any) => void;

let socket: WebSocket | null = null;
let opening: Promise<WebSocket> | null = null;
let reconnectAt = 0;
const listeners = new Set<Listener>();

function sessionUpdate() {
  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      output_modalities: ['audio'],
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: RATE },
          transcription: { model: 'whisper-1' },
          turn_detection: { type: 'server_vad', create_response: false, interrupt_response: true, silence_duration_ms: SILENCE_MS },
        },
        output: { format: { type: 'audio/pcm', rate: RATE } },
      },
    },
  };
}

function connect(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (opening) return opening;
  opening = new Promise<WebSocket>((resolve, reject) => {
    let s: WebSocket;
    try {
      s = new WebSocket(WS_URL);
    } catch (err) {
      opening = null;
      reject(err);
      return;
    }
    const fail = () => {
      opening = null;
      if (socket === s) socket = null;
      setDown(true);
      reject(new Error('voice socket closed'));
    };
    s.onerror = fail;
    s.onclose = () => {
      if (socket === s) socket = null;
      if (opening) fail();
      // Lazily warm the link back up: a consult mid-turn should not have to
      // pay the handshake again when the next utterance arrives.
      const now = Date.now();
      if (now > reconnectAt) {
        reconnectAt = now + 2000;
        setTimeout(() => { connect().catch(() => { /* offline; next use retries */ }); }, 1500);
      }
    };
    s.onmessage = (raw: MessageEvent) => {
      let ev: any;
      try {
        ev = JSON.parse(String(raw.data));
      } catch {
        return;
      }
      if (ev.type === 'session.created') {
        s.send(JSON.stringify(sessionUpdate()));
        socket = s;
        opening = null;
        setDown(false);
        resolve(s);
      }
      for (const l of Array.from(listeners)) l(ev);
    };
  });
  return opening;
}

function send(s: WebSocket, msg: unknown): void {
  try {
    if (s.readyState === WebSocket.OPEN) s.send(JSON.stringify(msg));
  } catch { /* noop */ }
}

function on(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------- playback

let out: AudioContext | null = null;
let playAt = 0;
const playing = new Set<AudioBufferSourceNode>();

function outCtx(): AudioContext {
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!out || out.state === 'closed') {
    out = new Ctor();
    playAt = 0;
  }
  if (out!.state === 'suspended') out!.resume().catch(() => { /* noop */ });
  return out!;
}

function enqueue(b64: string): number {
  const ctx = outCtx();
  const bin = atob(b64);
  const n = bin.length >> 1;
  const buf = ctx.createBuffer(1, n, RATE);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    const v = (hi << 8) | lo;
    ch[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  playAt = Math.max(playAt, ctx.currentTime + 0.06);
  src.start(playAt);
  playAt += buf.duration;
  playing.add(src);
  src.onended = () => playing.delete(src);
  return playAt - ctx.currentTime;
}

function stopPlayback(): void {
  for (const s of Array.from(playing)) {
    try {
      s.onended = null;
      s.stop();
    } catch { /* noop */ }
  }
  playing.clear();
  playAt = 0;
}

// ------------------------------------------------------------------ speak

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function remoteSpeak(
  text: string,
  opts: { onDone?: () => void; onFallback?: () => void } = {},
): SpeakHandle {
  let cancelled = false;
  let off = () => {};
  let timer: number | undefined;
  const finish = () => {
    off();
    if (timer) window.clearTimeout(timer);
    opts.onDone && opts.onDone();
  };
  // The server's model does not always obey "repeat this verbatim" — it will
  // sometimes answer the patient in its own words instead. Mira's words are
  // the Edge Function's, so nothing is played until the response's own
  // transcript proves it is reading the line it was given; anything else is
  // dropped and spoken by the browser.
  const want = norm(text);
  let verdict: 'pending' | 'ok' | 'bad' = 'pending';
  let heard = '';
  const held: string[] = [];
  const bail = () => {
    verdict = 'bad';
    held.length = 0;
    off();
    if (timer) window.clearTimeout(timer);
    if (socket) send(socket, { type: 'response.cancel' });
    if (opts.onFallback) opts.onFallback();
    else finish();
  };
  const judge = (chunk: string) => {
    heard += chunk;
    const got = norm(heard);
    if (!got) return;
    if (!want.startsWith(got.slice(0, want.length))) {
      bail();
      return;
    }
    if (got.length < 18 && got.length < want.length) return;
    verdict = 'ok';
    for (const b of held.splice(0)) enqueue(b);
  };
  // The transcript can also arrive in one piece at the end of the response
  // instead of as deltas; judging only deltas leaves the verdict pending, and
  // the audio.done branch below then cancels a line the server read correctly.
  const judgeFull = (full: string) => {
    heard = '';
    judge(full);
  };
  connect()
    .then(s => {
      if (cancelled) return;
      off = on(ev => {
        if (ev.type === 'response.output_audio_transcript.delta' && typeof ev.delta === 'string') {
          if (verdict === 'pending') judge(ev.delta);
        } else if (ev.type === 'response.output_audio_transcript.done' && typeof ev.transcript === 'string') {
          if (verdict === 'pending') judgeFull(ev.transcript);
        } else if (ev.type === 'response.output_audio.delta' && typeof ev.delta === 'string') {
          if (verdict === 'ok') enqueue(ev.delta);
          else if (verdict === 'pending') held.push(ev.delta);
        } else if (ev.type === 'response.output_audio.done' || ev.type === 'response.done') {
          if (verdict === 'pending') {
            // Audio finished without a transcript worth trusting.
            bail();
            return;
          }
          // Let the queued audio finish before the consult moves on.
          const ctx = out;
          const left = ctx ? Math.max(0, playAt - ctx.currentTime) : 0;
          if (timer) window.clearTimeout(timer);
          timer = window.setTimeout(finish, left * 1000 + 60);
        } else if (ev.type === 'error') {
          if (verdict === 'ok') finish();
          else bail();
        }
      });
      // Whatever the server started saying on its own is not Mira.
      send(s, { type: 'response.cancel' });
      send(s, {
        type: 'response.create',
        response: {
          conversation: 'none',
          output_modalities: ['audio'],
          input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: REPEAT + text }] }],
        },
      });
    })
    // The server is unreachable: hand the line to the browser's own voice
    // rather than letting Mira go silent mid-consult.
    .catch(() => { if (opts.onFallback) opts.onFallback(); else finish(); });
  return {
    cancel: () => {
      cancelled = true;
      stopPlayback();
      if (socket) send(socket, { type: 'response.cancel' });
      off();
      if (timer) window.clearTimeout(timer);
    },
  };
}

// ----------------------------------------------------------------- listen

export function remoteListenOnce(opts: {
  onText: (text: string) => void;
  onError?: (kind: 'denied' | 'other') => void;
  onEnd?: () => void;
  /** The mic is ours but the server is not reachable — listen some other way. */
  onUnavailable?: () => void;
}): ListenHandle | null {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    opts.onError && opts.onError('other');
    return null;
  }
  let closed = false;
  let off = () => {};
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  let heard = '';
  let settleAt: number | undefined;

  // One utterance can still arrive as several transcription.completed events if
  // the patient pauses for longer than SILENCE_MS: each is a fresh turn whose
  // transcript restates everything heard so far, so taking the first one filed
  // the sentence truncated. Each event restarts a short timer; only when the
  // transcript stops growing is the turn submitted.
  const settle = (text: string) => {
    if (closed) return;
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '');
    // A transcript that extends what we have is a revision of the same turn;
    // anything else is genuinely new speech and is appended.
    if (!heard || norm(text).startsWith(norm(heard))) heard = text;
    else heard = `${heard} ${text}`;
    if (settleAt) window.clearTimeout(settleAt);
    settleAt = window.setTimeout(() => {
      const final = heard.trim();
      heard = '';
      close(true);
      if (final) opts.onText(final);
    }, SETTLE_MS);
  };

  const close = (ended: boolean) => {
    if (closed) return;
    closed = true;
    if (settleAt) window.clearTimeout(settleAt);
    off();
    try {
      node && node.disconnect();
    } catch { /* noop */ }
    try {
      stream && stream.getTracks().forEach(t => t.stop());
    } catch { /* noop */ }
    try {
      ctx && ctx.close();
    } catch { /* noop */ }
    if (ended) opts.onEnd && opts.onEnd();
  };

  (async () => {
    // The mic is asked for first and the socket second. Awaiting the socket
    // first means a server that is down — or busy, since it serves one session
    // at a time — swallows the permission prompt entirely: the patient is never
    // asked for the mic and cannot tell why nothing is listening.
    const media = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    let s: WebSocket;
    try {
      s = await connect();
    } catch {
      // Mic granted but no server: the caller falls back to the browser's own
      // recogniser, so this is degradation, not a failure the patient sees.
      media.getTracks().forEach(t => t.stop());
      close(false);
      opts.onUnavailable ? opts.onUnavailable() : opts.onError && opts.onError('other');
      return;
    }
    if (closed) {
      media.getTracks().forEach(t => t.stop());
      return;
    }
    stream = media;
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor({ sampleRate: RATE }) as AudioContext;
    const src = ctx.createMediaStreamSource(media);
    node = ctx.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = (e: AudioProcessingEvent) => {
      if (closed) return;
      const f = e.inputBuffer.getChannelData(0);
      const bytes = new Uint8Array(f.length * 2);
      for (let i = 0; i < f.length; i++) {
        const c = Math.max(-1, Math.min(1, f[i]));
        const v = (c < 0 ? c * 0x8000 : c * 0x7fff) | 0;
        bytes[i * 2] = v & 0xff;
        bytes[i * 2 + 1] = (v >> 8) & 0xff;
      }
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      send(s, { type: 'input_audio_buffer.append', audio: btoa(bin) });
    };
    // A muted sink keeps the processor pulling without feeding the mic back
    // into the speaker.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);

    off = on(ev => {
      if (ev.type === 'conversation.item.input_audio_transcription.completed') {
        // The server answers every turn whether we asked or not; silence it
        // before it starts speaking over the Edge Function's reply.
        send(s, { type: 'response.cancel' });
        const text = typeof ev.transcript === 'string' ? ev.transcript.trim() : '';
        if (text) settle(text);
      }
    });
  })().catch(err => {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    close(false);
    opts.onError && opts.onError(denied ? 'denied' : 'other');
  });

  return { abort: () => close(false) };
}

export function remoteStopAll(): void {
  stopPlayback();
  if (socket) send(socket, { type: 'response.cancel' });
}
