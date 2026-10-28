// Patient consult session: voice turns, AI turns, draft completion.
// Owns the live conversation only; lifecycle + persistence live in the clinic store.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Confidence, Recommendation } from '../../lib/core';
import type { MiraTurn, Suggestion } from '../../lib/ui';
import {
  addConsultNote, aiComplete, aiConsult, getConsult, hasSupabase, mintVoiceToken, persistLocal, resolveHospitalId,
  startConsult, type ChatMessage,
} from '../../lib/api';
import { listenOnce, onVoiceHealth, speak, stopAllVoice, voiceDegraded, type ListenHandle, type SpeakHandle } from '../../lib/voice';
import { checkRedFlag, freshSlots, narrationGuidance, nextQuestion, recordAnswer, type ConsultSlots } from '../../lib/models/narration';
import { warmLlm } from '../../lib/models/llm';
import { warmStt } from '../../lib/models/stt';
import { kokoroReady, kokoroWhenReady, warmKokoro } from '../../lib/voice/kokoro';

export type Turn = MiraTurn;

// Openers while the conversation is young; follow-ups once it is running.
// Tone tracks how the patient is doing, not what the button does.
const OPENERS: Suggestion[] = [
  { label: 'I have a fever', tone: 'bad' },
  { label: 'Bad headache', tone: 'warn' },
  { label: 'Stomach pain', tone: 'warn' },
  { label: 'Feeling better', tone: 'ok' },
];
// Spoken back when the plan is already with a doctor: what the patient just
// said is on the record, and nothing about the plan has changed.
const URGENT_REPLY =
  "What you're describing could be serious, and I don't want to take chances with you. Please get to urgent in-person care or call emergency services now. I've flagged this for Dr. Whitfield right away.";
const URGENT_REC = {
  type: 'investigation', title: 'Urgent in-person assessment',
  summary: 'Red-flag symptoms reported; immediate in-person evaluation advised.',
  items: [{ name: 'Emergency department visit', dosage: '', timing: 'Immediately', notes: 'Do not drive yourself if unwell.', why: 'These symptoms need hands-on assessment right away.', detail: 'Immediate in-person evaluation.' }],
  advice: 'Call emergency services now if symptoms are worsening.', urgency: 'urgent',
};
const NOTE_ACK = 'Got it, I’ve added that for Dr. Whitfield to see.';
const NOTE_FAILED = 'Sorry, I couldn’t save that just now. Tell me again in a moment.';

// A reply is spoken as it is written. Collecting every token first and only
// then starting to speak makes time-to-first-sound the latency of the whole
// answer — seconds of silence over something already decided.
const BREAK = /[.!?]["'’)\]]*\s+/g;
// Under this a "sentence" is a fragment — a numbered item, a stray initial —
// and is better carried into the next one than spoken on its own.
const MIN_LINE = 24;
// Boundaries that only look like sentence ends. Splitting here would have her
// say "Dr." and stop.
const ABBR = /(?:^|\s)(?:dr|mr|mrs|ms|prof|st|approx|e\.g|i\.e|vs|etc|no|fig|mg|ml|hr|hrs)\.$/i;

/** Splits off every complete sentence, returning them and the unfinished tail. */
function cut(buf: string): [string[], string] {
  const out: string[] = [];
  let start = 0;
  BREAK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BREAK.exec(buf))) {
    const end = m.index + m[0].length;
    const line = buf.slice(start, end).trim();
    if (line.length < MIN_LINE || ABBR.test(line)) continue;
    out.push(line);
    start = end;
  }
  return [out, buf.slice(start)];
}

type Stream = {
  q: string[];
  buf: string;
  /** No more tokens are coming; the queue draining is the end of the reply. */
  end: boolean;
  busy: boolean;
  after?: () => void;
  force: boolean;
};

const FOLLOWUPS: Suggestion[] = [
  { label: 'Since yesterday' },
  { label: 'About a week' },
  { label: 'It comes and goes' },
  { label: 'It\u2019s getting worse', tone: 'bad' },
  { label: 'That\u2019s all', tone: 'ok' },
];

export interface PatientProfile {
  name: string;
  /** Only what the record actually holds. Empty when nothing is on file — the
   *  prompt must never invent a demographic or an allergy (TODO P1). */
  facts?: string;
}

function systemPrompt(p: PatientProfile): string {
  const onFile = p.facts
    ? `Patient on file: ${p.name}. ${p.facts}`
    : `Patient on file: ${p.name}. No demographics, allergies or history are on file — do not assume any. Ask before prescribing anything allergy-sensitive.`;
  return `You are Dr. Mira, a warm, emotionally intelligent virtual general physician in the AI Doctor app. You speak, so your words are heard aloud — sound like a caring human clinician, never like a form.
${onFile}
CONVERSATION STYLE:
- FIRST, briefly acknowledge how the patient feels before your clinical question. Empathy first, then the question.
- Ask only ONE question per turn. 1-2 short, plain, spoken-sounding sentences. No lists, no jargon.
- Vary your wording naturally across turns — never sound scripted or repeat the same phrasings.
CLINICAL:
- Gather: main symptom, duration, severity, associated symptoms, relevant history.
- After enough (usually 4-6 patient replies), decide next steps: lab tests/investigations OR a prescription. Never prescribe a drug the patient is recorded as allergic to, and never assume an allergy that is not on file.
- If anything sounds like an emergency (chest pain, breathing difficulty, stroke signs, severe bleeding), set urgency "urgent" and clearly tell them to seek in-person emergency care now.
Respond with ONLY a JSON object, no prose, no code fences:
{"reply": string, "note": string, "confidence": "high"|"medium"|"low", "flags": string[], "done": boolean, "recommendation": null | {"type":"prescription"|"investigation","title":string,"summary":string,"items":[{"name":string,"dosage":string,"timing":string,"notes":string,"why":string,"detail":string}],"advice":string,"urgency":"routine"|"soon"|"urgent"}}
flags: only concerns you actually identified in this conversation — never a routine attestation for a check you did not perform.
Set done=true and fill recommendation only when complete; otherwise done=false, recommendation=null.`;
}

function parseAi(raw: string): any {
  if (!raw) return { reply: '', done: false };
  let t = String(raw).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    return { reply: String(raw), done: false };
  }
}

export function useConsult(opts: {
  patient: PatientProfile;
  onDone: (rec: Recommendation, ctx: { confidence: Confidence; flags: string[]; notes: string[]; users: string[] }) => void;
}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [notes, setNotes] = useState<{ who: string; t: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [thinking, setThinking] = useState(false);
  // Two separate switches: whether Mira speaks, and whether she listens.
  const [speakerOff, setSpeakerOffState] = useState(false);
  const [micOff, setMicOffState] = useState(false);
  const speakerOffRef = useRef(false);
  const micOffRef = useRef(false);
  const [micDenied, setMicDenied] = useState(false);
  // The voice server dropping out changes how Mira sounds but not what she can
  // do, so it is reported once and never blocks the consult.
  const [voiceOffline, setVoiceOffline] = useState(voiceDegraded());
  useEffect(() => onVoiceHealth(setVoiceOffline), []);
  // Warm Kokoro first: it is the voice the patient hears first, and three
  // ~500 MB downloads at once leave it last. Ears and brain follow once it
  // lands (or after 20 s if it cannot), so they never starve the greeting.
  const [voiceLoading, setVoiceLoading] = useState(true);
  useEffect(() => {
    warmKokoro();
    let live = true;
    const poll = window.setInterval(() => {
      if (kokoroReady()) { setVoiceLoading(false); window.clearInterval(poll); }
    }, 1000);
    const rest = window.setTimeout(() => { warmStt(); warmLlm(); }, 20000);
    void kokoroWhenReady(120000).then(() => { if (live) { warmStt(); warmLlm(); } });
    return () => { live = false; window.clearInterval(poll); window.clearTimeout(rest); };
  }, []);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [lastTurn, setLastTurn] = useState(0);
  const [confidence, setConfidence] = useState<Confidence>('high');
  const [flags, setFlags] = useState<string[]>([]);
  const listenRef = useRef<ListenHandle | null>(null);
  const speakRef = useRef<SpeakHandle | null>(null);
  // Narration slots for this visit (lib/models/narration): what the script
  // has gathered so far, persisted with the draft consult every turn.
  const slotsRef = useRef<ConsultSlots>(freshSlots());
  // Single-flight: two sends in the same thinking window used to race
  // ensureConsult into two server consults / two filed cases (QA P1).
  const inFlightRef = useRef(false);
  const onDoneRef = useRef(opts.onDone);
  onDoneRef.current = opts.onDone;
  const patientRef = useRef(opts.patient);
  patientRef.current = opts.patient;
  // One consult submits exactly once: neither a duplicate speech callback nor a
  // turn typed after the plan was produced may file a second case (UX-01).
  const finishedRef = useRef(false);
  // The panel opened on a consult a doctor already has: it listens and records,
  // but never runs a turn.
  const noteOnlyRef = useRef(false);
  // Set only when the turn is being abandoned rather than interrupted — closing
  // the panel, resetting the consult. Cancelling speech now always resolves, so
  // without this the continuation would re-open the mic on the way out.
  const abandonRef = useRef(false);
  // Which turn is being spoken, so that cutting her off can mark it. Both ways
  // of interrupting — talking over her, tapping — arrive with no idea which
  // message they stopped, and a streamed reply is spoken a sentence at a time,
  // so the sentence is not the thing to match on.
  const saidIdxRef = useRef(-1);
  // The turn being written into as tokens arrive, so the bubble can grow with
  // the voice instead of appearing whole at the end.
  const liveIdxRef = useRef(-1);
  const streamRef = useRef<Stream | null>(null);
  // The turn arrived by typing. A patient who is typing must not be handed a
  // permission prompt and a hot mic after every reply (foundation 1).
  const typedRef = useRef(false);

  // Silencing her cuts the current sentence off at once; the transcript keeps it.
  const setSpeakerOff = useCallback((v: boolean) => {
    speakerOffRef.current = v;
    setSpeakerOffState(v);
    if (v) {
      // Silencing her stops the sentence; it does not end the consult. The
      // cancel resolves, so the turn carries on into listening rather than
      // leaving Mira mute and deaf with nothing to restart her — and the
      // microphone is not handed back, because the consult is still running.
      speakRef.current?.cancel();
    }
  }, []);

  const setMicOff = useCallback((v: boolean) => {
    micOffRef.current = v;
    setMicOffState(v);
    if (v) {
      listenRef.current?.abort();
      listenRef.current = null;
      setStatus(s => (s === 'listening' ? 'idle' : s));
    }
  }, []);

  // The transcript is what the reviewing doctor reads, and it holds the whole
  // reply whether or not the patient heard it. An interruption four words in
  // would otherwise reach review as advice delivered in full.
  const markInterrupted = useCallback(() => {
    const i = saidIdxRef.current;
    saidIdxRef.current = -1;
    const msgs = messagesRef.current;
    const m = msgs[i];
    if (!m || m.role !== 'mira' || m.interrupted) return;
    const next = [...msgs];
    next[i] = { ...m, interrupted: true };
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const stopListening = useCallback(() => {
    listenRef.current?.abort();
    listenRef.current = null;
  }, []);

  const say = useCallback((text: string, after?: () => void, force = false) => {
    if (speakerOffRef.current && !force) {
      setStatus('idle');
      after && after();
      return;
    }
    setStatus('speaking');
    abandonRef.current = false;
    speakRef.current = speak(text, {
      onDone: () => {
        if (abandonRef.current) return;
        after && after();
      },
      // Talking over her is almost always a correction — the wrong symptom, the
      // wrong duration — so it is the highest-value thing the patient says.
      // Cancelling resolves the turn, which hands straight on to listening, and
      // the audio already in flight becomes that turn.
      // Not armed while the mic is switched off: barge-in turns capture back
      // on, and a patient who has silenced their microphone has said they do
      // not want it live.
      onBarge: micOffRef.current ? undefined : () => {
        markInterrupted();
        cutStreamRef.current();
        speakRef.current?.cancel();
      },
    });
  }, [markInterrupted]);

  // Speaks the queue one line at a time, in order. A sentence is handed to the
  // voice only when the one before it has finished, so a reply still being
  // written is never spoken out of sequence.
  const drain = useCallback(function d(): void {
    const st = streamRef.current;
    if (!st) return;
    const line = st.q.shift();
    if (line !== undefined) {
      st.busy = true;
      say(line, d, st.force);
      return;
    }
    st.busy = false;
    // The queue is empty but the model is still writing: the next token to
    // complete a sentence restarts the drain.
    if (!st.end) return;
    streamRef.current = null;
    st.after && st.after();
  }, [say]);

  const openStream = useCallback((force = false) => {
    streamRef.current = { q: [], buf: '', end: false, busy: false, force };
  }, []);

  const pushStream = useCallback((token: string) => {
    const st = streamRef.current;
    if (!st) return;
    const [lines, rest] = cut(st.buf + token);
    st.buf = rest;
    if (!lines.length) return;
    st.q.push(...lines);
    if (!st.busy) drain();
  }, [drain]);

  const endStream = useCallback((after?: () => void) => {
    const st = streamRef.current;
    if (!st) {
      after && after();
      return;
    }
    const tail = st.buf.trim();
    st.buf = '';
    if (tail) st.q.push(tail);
    st.end = true;
    st.after = after;
    if (!st.busy) drain();
  }, [drain]);

  // Interrupted: the rest of the reply is dropped rather than queued behind the
  // interruption, but the turn still ends the way a finished one would — the
  // patient is already talking, and something has to be listening.
  const cutStream = useCallback(() => {
    const st = streamRef.current;
    if (!st) return;
    st.q.length = 0;
    st.buf = '';
    st.end = true;
  }, []);
  const cutStreamRef = useRef(cutStream);
  cutStreamRef.current = cutStream;

  /** Abandons the stream outright: no remaining lines, no continuation. */
  const dropStream = useCallback(() => { streamRef.current = null; }, []);

  // The bubble grows with the voice. A patient reading rather than listening
  // must not be left on "Thinking…" while she is already several sentences in
  // (foundation 1).
  const live = useCallback((text: string) => {
    const msgs = messagesRef.current;
    let next: Turn[];
    if (liveIdxRef.current < 0) {
      liveIdxRef.current = msgs.length;
      next = [...msgs, { role: 'mira' as const, text, at: Date.now() }];
    } else {
      next = [...msgs];
      next[liveIdxRef.current] = { ...next[liveIdxRef.current], text };
    }
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const listen = useCallback(() => {
    if (micOffRef.current) {
      setStatus('idle');
      return;
    }
    const h = listenOnce({
      onText: (t) => handleUserRef.current(t),
      onError: (kind) => {
        if (kind === 'denied') setMicDenied(true);
        setStatus('idle');
      },
      onEnd: () => setStatus((s) => (s === 'listening' ? 'idle' : s)),
      // "Listening" only once capture is real: while Whisper downloads the
      // patient must not talk into a mic that is not open yet (QA P2).
      onStart: () => setStatus('listening'),
    });
    if (!h) {
      setStatus('idle');
      return;
    }
    listenRef.current = h;
  }, []);

  // The server-side consult this session writes into (§4.1 row 4). Null in
  // demo mode, where the whole visit lives in memory and localStorage.
  const consultIdRef = useRef<string | null>(null);
  const ensureConsult = useCallback(async (): Promise<string> => {
    if (consultIdRef.current) return consultIdRef.current;
    const hospital = await resolveHospitalId();
    const started = await startConsult(hospital);
    consultIdRef.current = started.consult_id;
    // Pre-warm the voice credential (ARCHITECTURE §10.4): one ephemeral token,
    // minted server-side, never a provider key in this bundle.
    mintVoiceToken(started.consult_id).catch(() => { /* text channel still works */ });
    return started.consult_id;
  }, []);

  const handleUser = useCallback(async (text: string, typed = false) => {
    text = (text || '').trim();
    if (!text || finishedRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    typedRef.current = typed;
    liveIdxRef.current = -1;
    // Spoken to, she answers and listens again; typed to, the composer already
    // has the patient's attention and the turn simply ends.
    const then = typed ? () => setStatus('idle') : () => listenRef2.current();
    stopListening();
    setFailed(false);
    setLastTurn(Date.now());
    setThinking(true);
    setStatus('thinking');
    const image = pendingImage.current;
    pendingImage.current = undefined;
    const msgs: Turn[] = [...messagesRef.current, { role: 'user', text, at: Date.now(), image }];
    messagesRef.current = msgs;
    setMessages(msgs);
    // Narration: this turn fills the slot Mira's last question asked about;
    // the next unfilled slot is what her reply must ask.
    recordAnswer(slotsRef.current, text);
    slotsRef.current.pendingSlot = nextQuestion(slotsRef.current)?.slot ?? null;
    // Written every turn so a reload or a closed tab still leaves a trace of
    // the visit that was started (UX-15).
    persistLocal({ draftConsult: { messages: msgs, at: Date.now(), slots: slotsRef.current } });
    // The plan is already a doctor's to move: what the patient says now is
    // recorded against the consult, not run as a turn. Mira acknowledges and
    // keeps listening, so the conversation continues without anything
    // clinical changing under the reviewer.
    if (noteOnlyRef.current) {
      try {
        if (hasSupabase() && consultIdRef.current) await addConsultNote(consultIdRef.current, text, 'voice');
        const ack = [...messagesRef.current, { role: 'mira' as const, text: NOTE_ACK, at: Date.now() }];
        messagesRef.current = ack;
        setMessages(ack);
        saidIdxRef.current = ack.length - 1;
        setThinking(false);
        say(NOTE_ACK, then);
      } catch {
        setThinking(false);
        setFailed(true);
        say(NOTE_FAILED, then);
      }
      inFlightRef.current = false;
      return;
    }
    try {
      const api: ChatMessage[] = msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      let data: any;
      if (hasSupabase()) {
        // §4.1 row 7. The model turn happens inside the Edge Function, which
        // holds the provider key; the browser only streams tokens back.
        // No silent fallback anywhere: a scripted engine's fixed real-drug
        // drafts must never reach a doctor's queue as this patient's AI
        // recommendation (TODO P1 SAFETY).
        const consultId = await ensureConsult();
        let streamed = '';
        // Spoken and shown as it is written. The draft lookup below is a second
        // round trip; making the first word wait on it put the whole reply
        // behind two full latencies.
        openStream();
        const turn = await aiConsult({ consultId, text, channel: 'text' }, (tok) => {
          streamed += tok;
          setThinking(false);
          live(streamed);
          pushStream(tok);
        });
        let recommendation: any = null;
        let confidence = 'high';
        let flags: string[] = [];
        if (turn.draft_id) {
          const { draft } = await getConsult(consultId);
          if (draft) {
            recommendation = draft.recommendation;
            confidence = draft.confidence;
            flags = (draft.flags || []).map(f => f.text || f.code).filter(Boolean);
          }
        }
        data = {
          reply: streamed.trim(),
          note: text.slice(0, 48),
          confidence, flags,
          done: !!recommendation,
          recommendation,
        };
      } else {
        const system = `${systemPrompt(patientRef.current)}\n${narrationGuidance(slotsRef.current)}`;
        const raw = await aiComplete({ system, messages: api, max_tokens: 800 });
        data = parseAi(raw);
      }
      // Deterministic red-flag gate: the model's own urgency judgement is
      // advisory only. A script red flag forces the urgent path and files
      // the case for the doctor whatever the model answered (QA P1).
      const redFlag = checkRedFlag(slotsRef.current, text);
      if (redFlag) {
        data = {
          ...data,
          reply: URGENT_REPLY,
          confidence: 'low',
          flags: [...(Array.isArray(data.flags) ? data.flags : []), redFlag],
          done: true,
          recommendation: data.recommendation?.urgency === 'urgent' ? data.recommendation : URGENT_REC,
        };
      }
      const reply = data.reply || 'Let me think about that for a moment.';
      // A streamed reply already has a turn on screen; the final text replaces
      // the partial one rather than arriving underneath it.
      const next = liveIdxRef.current >= 0
        ? messagesRef.current.map((m, i) => (i === liveIdxRef.current ? { ...m, text: reply } : m))
        : [...msgs, { role: 'mira' as const, text: reply, at: Date.now() }];
      messagesRef.current = next;
      setMessages(next);
      saidIdxRef.current = next.length - 1;
      setNotes(n => [...n, { who: 'You', t: (data.note as string) || text.slice(0, 48) }, { who: 'Dr. Mira', t: reply.slice(0, 64) }]);
      if (data.confidence) setConfidence(data.confidence);
      if (Array.isArray(data.flags)) setFlags(data.flags);
      setThinking(false);
      const done = data.done && data.recommendation;
      if (done) {
        // Submit as soon as the plan exists. Waiting for text-to-speech to
        // report the closing line finished means a device with no working
        // speech never files the consult at all.
        finishedRef.current = true;
        persistLocal({ draftConsult: null });
        onDoneRef.current(data.recommendation, {
          confidence: data.confidence || 'high',
          flags: Array.isArray(data.flags) ? data.flags : [],
          notes: notesRef.current.filter(n => n.who === 'You').map(n => n.t),
          users: next.filter(m => m.role === 'user').map(m => m.text),
        });
        // An emergency instruction is spoken even with the speaker muted —
        // "delivered" silently is not delivered. A muted stream said nothing as
        // it arrived, so the whole line is spoken now rather than resumed.
        if (data.recommendation?.urgency === 'urgent' && speakerOffRef.current) {
          dropStream();
          say(reply, undefined, true);
        } else {
          endStream();
        }
        inFlightRef.current = false;
        return;
      }
      endStream(then);
    } catch {
      // Whatever she had started saying is not the answer; it stops here rather
      // than finishing over the apology.
      dropStream();
      speakRef.current?.cancel();
      const err = "Sorry — I couldn't reach my clinical service just then, so nothing has been sent. Could you tell me that again?";
      const next = [...msgs];
      messagesRef.current = next;
      setMessages(next);
      setThinking(false);
      setStatus('idle');
      setFailed(true);
      saidIdxRef.current = -1;
      say(err, then);
    }
    inFlightRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesRef = useRef<Turn[]>([]);
  const notesRef = useRef<{ who: string; t: string }[]>([]);
  const handleUserRef = useRef(handleUser);
  handleUserRef.current = handleUser;
  const listenRef2 = useRef(listen);
  listenRef2.current = listen;
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const start = useCallback((resumeId?: string) => {
    const first = (patientRef.current.name || '').trim().split(/\s+/)[0];
    const greeting =
      `Hi${first ? ' ' + first : ''}, I'm Dr. Mira, your AI doctor. Everything here is private, and a licensed doctor reviews my advice before it reaches you. So — how are you feeling today?`;
    const init = [{ role: 'mira' as const, text: greeting, at: Date.now() }];
    messagesRef.current = init;
    setMessages(init);
    setNotes([]);
    setMicDenied(false);
    setFailed(false);
    setStarted(true);
    setLastTurn(Date.now());
    finishedRef.current = false;
    noteOnlyRef.current = false;
    slotsRef.current = freshSlots();
    // Ears/brain warm-up is staggered behind Kokoro at mount (see above),
    // so it never competes with the greeting the patient is waiting for.
    // Resuming a consult that is still open server-side: turns append to it
    // instead of opening a second visit for the same patient.
    consultIdRef.current = resumeId ?? null;
    saidIdxRef.current = 0;
    say(greeting, () => listenRef2.current());
  }, [say]);

  // Restore a consult interrupted by a reload/closed tab: transcript and
  // narration slots come back, and the next orb tap listens (QA P2). The
  // visit is not spoken over until the patient reopens the panel.
  const resume = useCallback((draftMessages: Turn[], draftSlots?: ConsultSlots) => {
    if (!draftMessages?.length) return;
    messagesRef.current = draftMessages;
    setMessages(draftMessages);
    if (draftSlots) slotsRef.current = draftSlots;
    finishedRef.current = false;
    noteOnlyRef.current = false;
    setStarted(true);
    setLastTurn(Date.now());
  }, []);

  // A Mira line with no model call — used when the panel opens on a state that
  // has no consult to run (e.g. a plan already awaiting review, UX-11).
  // `consultId` is the visit this note is about: the panel then listens, and a
  // spoken follow-up appends to that consult instead of starting a second one
  // behind the first — which is what the line itself promises.
  const note = useCallback((text: string, consultId?: string) => {
    const init = [{ role: 'mira' as const, text, at: Date.now() }];
    messagesRef.current = init;
    setMessages(init);
    if (consultId) consultIdRef.current = consultId;
    noteOnlyRef.current = true;
    finishedRef.current = false;
    setStarted(true);
    saidIdxRef.current = 0;
    say(text, () => listenRef2.current());
  }, [say]);

  // Stop talking and stop listening, but keep the conversation: closing the
  // panel must not silently end a consult the patient is part-way through.
  const silence = useCallback(() => {
    abandonRef.current = true;
    dropStream();
    stopListening();
    speakRef.current?.cancel();
    stopAllVoice();
    setStatus('idle');
  }, [stopListening, dropStream]);

  const reset = useCallback(() => {
    abandonRef.current = true;
    dropStream();
    stopListening();
    speakRef.current?.cancel();
    stopAllVoice();
    finishedRef.current = false;
    slotsRef.current = freshSlots();
    consultIdRef.current = null;
    persistLocal({ draftConsult: null });
    messagesRef.current = [];
    setMessages([]);
    setNotes([]);
    setFailed(false);
    setStarted(false);
    setThinking(false);
    setStatus('idle');
    setLastTurn(0);
  }, [stopListening, dropStream]);

  const orbTap = useCallback(() => {
    if (status === 'speaking') {
      // The cancel resolves into the same continuation a finished sentence
      // would, so listening is not started a second time here — doing both ran
      // two capture streams at once and leaked the first.
      markInterrupted();
      cutStream();
      speakRef.current?.cancel();
    } else if (status === 'idle') {
      listenRef2.current();
    } else if (status === 'listening') {
      stopListening();
      setStatus('idle');
    }
  }, [status, stopListening, markInterrupted, cutStream]);

  useEffect(() => () => {
    stopListening();
    stopAllVoice();
  }, [stopListening]);

  // A photo is one turn, not two: it rides on the same user message as the
  // sentence Mira actually reads. The model cannot see the pixels — sending the
  // image itself waits on consult_media (patient-todo).
  const pendingImage = useRef<string | undefined>(undefined);
  const attach = useCallback((image: string) => {
    pendingImage.current = image;
    handleUserRef.current('I have attached a photo of the affected area.', true);
  }, []);

  const retry = useCallback(() => {
    // Resend without duplicating: the failed turn is already in the
    // transcript and its narration slot is already filled (QA P2). Pull
    // both back out so the resend lands exactly once.
    const msgs = [...messagesRef.current];
    const idx = msgs.map(m => m.role).lastIndexOf('user');
    if (idx < 0) return;
    const last = msgs[idx];
    const trimmed = msgs.filter((_, i) => i !== idx);
    messagesRef.current = trimmed;
    setMessages(trimmed);
    const slots = slotsRef.current;
    for (const [slot, answer] of Object.entries(slots.answers)) {
      if (answer === last.text) {
        delete slots.answers[slot as keyof typeof slots.answers];
        slots.pendingSlot = slot as typeof slots.pendingSlot;
      }
    }
    handleUserRef.current(last.text, typedRef.current);
  }, []);

  return {
    messages, notes, status: (thinking ? 'thinking' : status) as 'idle' | 'listening' | 'thinking' | 'speaking',
    thinking, speakerOff, setSpeakerOff, micOff, setMicOff,
    micDenied, clearMicDenied: () => setMicDenied(false), voiceOffline, failed, retry, started, lastTurn,
    confidence, flags, voiceLoading, start, note, resume, reset, orbTap, attach, silence, send: (t: string) => handleUserRef.current(t, true),
    suggestions: messages.length <= 2 ? OPENERS : FOLLOWUPS,
  };
}
