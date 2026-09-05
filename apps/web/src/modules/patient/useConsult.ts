// Patient consult session: voice turns, AI turns, draft completion.
// Owns the live conversation only; lifecycle + persistence live in the clinic store.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Confidence, Recommendation } from '../../lib/core';
import type { MiraTurn, Suggestion } from '../../lib/ui';
import { aiComplete, concludeConsult, consultTurn, hasGemini, persistLocal, type ChatMessage, type SymptomSlots } from '../../lib/api';
import { listenOnce, speak, stopAllVoice, type ListenHandle, type SpeakHandle } from '../../lib/voice';

export type Turn = MiraTurn;

// Openers while the conversation is young; follow-ups once it is running.
// Tone tracks how the patient is doing, not what the button does.
const OPENERS: Suggestion[] = [
  { label: 'I have a fever', tone: 'bad' },
  { label: 'Bad headache', tone: 'warn' },
  { label: 'Stomach pain', tone: 'warn' },
  { label: 'Feeling better', tone: 'ok' },
];
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
  return `You are Dr. Mira, a warm, emotionally intelligent virtual general physician in the Virtual Doctor app. You speak, so your words are heard aloud — sound like a caring human clinician, never like a form.
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
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [lastTurn, setLastTurn] = useState(0);
  const [confidence, setConfidence] = useState<Confidence>('high');
  const [flags, setFlags] = useState<string[]>([]);
  const listenRef = useRef<ListenHandle | null>(null);
  const speakRef = useRef<SpeakHandle | null>(null);
  const onDoneRef = useRef(opts.onDone);
  onDoneRef.current = opts.onDone;
  const patientRef = useRef(opts.patient);
  patientRef.current = opts.patient;
  // One consult submits exactly once: neither a duplicate speech callback nor a
  // turn typed after the plan was produced may file a second case (UX-01).
  const finishedRef = useRef(false);

  // Silencing her cuts the current sentence off at once; the transcript keeps it.
  const setSpeakerOff = useCallback((v: boolean) => {
    speakerOffRef.current = v;
    setSpeakerOffState(v);
    if (v) {
      stopAllVoice();
      setStatus('idle');
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
    speakRef.current = speak(text, {
      onDone: () => {
        after && after();
      },
    });
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
    });
    if (!h) {
      setStatus('idle');
      return;
    }
    listenRef.current = h;
    setStatus('listening');
  }, []);

  const handleUser = useCallback(async (text: string) => {
    text = (text || '').trim();
    if (!text || finishedRef.current) return;
    stopListening();
    setFailed(false);
    setLastTurn(Date.now());
    setThinking(true);
    setStatus('thinking');
    const msgs: Turn[] = [...messagesRef.current, { role: 'user', text, at: Date.now() }];
    messagesRef.current = msgs;
    setMessages(msgs);
    // Written every turn so a reload or a closed tab still leaves a trace of
    // the visit that was started (UX-15).
    persistLocal({ draftConsult: { messages: msgs, at: Date.now() } });
    try {
      const api: ChatMessage[] = msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      let data: any;
      if (hasGemini()) {
        try {
          const userCount = msgs.filter(m => m.role === 'user').length;
          const onFile = patientRef.current.facts;
          const turn = await consultTurn({ messages: api, slots: slotsRef.current, rush: userCount >= 8, onFile });
          slotsRef.current = turn.slots;
          data = turn;
          if (turn.done || turn.redFlag) {
            const fin = await concludeConsult({ slots: turn.slots, messages: api, redFlag: turn.redFlag, onFile });
            data = { ...turn, reply: fin.reply || turn.reply, note: fin.note, confidence: fin.confidence, flags: fin.flags, done: !!fin.recommendation, recommendation: fin.recommendation };
          }
        } catch (e) {
          // No silent fallback: the demo engine emits fixed real-drug drafts,
          // and those must never reach a doctor's queue labelled as this
          // patient's AI recommendation (TODO P1 SAFETY).
          console.warn('[vd] Gemini consult failed:', e);
          throw e;
        }
      } else {
        const raw = await aiComplete({ system: systemPrompt(patientRef.current), messages: api, max_tokens: 800 });
        data = parseAi(raw);
      }
      const reply = data.reply || 'Let me think about that for a moment.';
      const next = [...msgs, { role: 'mira' as const, text: reply, at: Date.now() }];
      messagesRef.current = next;
      setMessages(next);
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
        // "delivered" silently is not delivered.
        say(reply, undefined, data.recommendation?.urgency === 'urgent');
        return;
      }
      say(reply, () => listenRef2.current());
    } catch {
      const err = "Sorry — I couldn't reach my clinical service just then, so nothing has been sent. Could you tell me that again?";
      const next = [...msgs];
      messagesRef.current = next;
      setMessages(next);
      setThinking(false);
      setStatus('idle');
      setFailed(true);
      say(err, () => listenRef2.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesRef = useRef<Turn[]>([]);
  const slotsRef = useRef<SymptomSlots>({});
  const notesRef = useRef<{ who: string; t: string }[]>([]);
  const handleUserRef = useRef(handleUser);
  handleUserRef.current = handleUser;
  const listenRef2 = useRef(listen);
  listenRef2.current = listen;
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const start = useCallback(() => {
    const first = (patientRef.current.name || '').trim().split(/\s+/)[0];
    const greeting =
      `Hi${first ? ' ' + first : ''}, I'm Dr. Mira, your AI doctor. Everything here is private, and a licensed doctor reviews my advice before it reaches you. So — how are you feeling today?`;
    const init = [{ role: 'mira' as const, text: greeting, at: Date.now() }];
    messagesRef.current = init;
    slotsRef.current = {};
    setMessages(init);
    setNotes([]);
    setMicDenied(false);
    setFailed(false);
    setStarted(true);
    setLastTurn(Date.now());
    finishedRef.current = false;
    say(greeting, () => listenRef2.current());
  }, [say]);

  // A Mira line with no model call — used when the panel opens on a state that
  // has no consult to run (e.g. a plan already awaiting review, UX-11).
  const note = useCallback((text: string) => {
    const init = [{ role: 'mira' as const, text, at: Date.now() }];
    messagesRef.current = init;
    setMessages(init);
    setStarted(true);
    say(text);
  }, [say]);

  const reset = useCallback(() => {
    stopListening();
    stopAllVoice();
    finishedRef.current = false;
    persistLocal({ draftConsult: null });
    messagesRef.current = [];
    slotsRef.current = {};
    setMessages([]);
    setNotes([]);
    setFailed(false);
    setStarted(false);
    setThinking(false);
    setStatus('idle');
    setLastTurn(0);
  }, [stopListening]);

  const orbTap = useCallback(() => {
    if (status === 'speaking') {
      speakRef.current?.cancel();
      listenRef2.current();
    } else if (status === 'idle') {
      listenRef2.current();
    } else if (status === 'listening') {
      stopListening();
      setStatus('idle');
    }
  }, [status, stopListening]);

  useEffect(() => () => {
    stopListening();
    stopAllVoice();
  }, [stopListening]);

  const retry = useCallback(() => {
    const last = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (last) handleUserRef.current(last.text);
  }, []);

  return {
    messages, notes, status: (thinking ? 'thinking' : status) as 'idle' | 'listening' | 'thinking' | 'speaking',
    thinking, speakerOff, setSpeakerOff, micOff, setMicOff,
    micDenied, clearMicDenied: () => setMicDenied(false), failed, retry, started, lastTurn,
    confidence, flags, start, note, reset, orbTap, send: (t: string) => handleUserRef.current(t),
    suggestions: messages.length <= 2 ? OPENERS : FOLLOWUPS,
  };
}
