// Patient consult session: voice turns, AI turns, draft completion.
// Owns the live conversation only; lifecycle + persistence live in the clinic store.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Confidence, Recommendation } from '@vd/core';
import { aiComplete, type ChatMessage } from '@vd/api';
import { listenOnce, speak, stopAllVoice, type ListenHandle, type SpeakHandle } from '@vd/voice';

export interface Turn {
  role: 'user' | 'doctor';
  text: string;
  at: number;
}

const SYS = `You are Dr. Mira, a warm, emotionally intelligent virtual general physician in the Virtual Doctor app. You speak, so your words are heard aloud — sound like a caring human clinician, never like a form.
Patient on file: Alex Kumar, 34, male, blood group O+, allergic to Penicillin, history of mild asthma.
CONVERSATION STYLE:
- FIRST, briefly acknowledge how the patient feels before your clinical question. Empathy first, then the question.
- Ask only ONE question per turn. 1-2 short, plain, spoken-sounding sentences. No lists, no jargon.
- Vary your wording naturally across turns — never sound scripted or repeat the same phrasings.
CLINICAL:
- Gather: main symptom, duration, severity, associated symptoms, relevant history.
- After enough (usually 4-6 patient replies), decide next steps: lab tests/investigations OR a prescription (NEVER Penicillin-class given the allergy — this is a hard safety rule).
- If anything sounds like an emergency (chest pain, breathing difficulty, stroke signs, severe bleeding), set urgency "urgent" and clearly tell them to seek in-person emergency care now.
Respond with ONLY a JSON object, no prose, no code fences:
{"reply": string, "note": string, "confidence": "high"|"medium"|"low", "flags": string[], "done": boolean, "recommendation": null | {"type":"prescription"|"investigation","title":string,"summary":string,"items":[{"name":string,"dosage":string,"timing":string,"notes":string,"why":string,"detail":string}],"advice":string,"urgency":"routine"|"soon"|"urgent"}}
Set done=true and fill recommendation only when complete; otherwise done=false, recommendation=null.`;

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
  onDone: (rec: Recommendation, ctx: { confidence: Confidence; flags: string[]; notes: string[]; users: string[] }) => void;
}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [notes, setNotes] = useState<{ who: string; t: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
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

  const stopListening = useCallback(() => {
    listenRef.current?.abort();
    listenRef.current = null;
  }, []);

  const say = useCallback((text: string, after?: () => void) => {
    setStatus('speaking');
    speakRef.current = speak(text, {
      onDone: () => {
        after && after();
      },
    });
  }, []);

  const listen = useCallback(() => {
    if (muted) {
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
  }, [muted]);

  const handleUser = useCallback(async (text: string) => {
    text = (text || '').trim();
    if (!text) return;
    stopListening();
    setFailed(false);
    setLastTurn(Date.now());
    setThinking(true);
    setStatus('thinking');
    const msgs: Turn[] = [...messagesRef.current, { role: 'user', text, at: Date.now() }];
    messagesRef.current = msgs;
    setMessages(msgs);
    try {
      const api: ChatMessage[] = msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const raw = await aiComplete({ system: SYS, messages: api, max_tokens: 800 });
      const data = parseAi(raw);
      const reply = data.reply || 'Let me think about that for a moment.';
      const next = [...msgs, { role: 'doctor' as const, text: reply, at: Date.now() }];
      messagesRef.current = next;
      setMessages(next);
      setNotes(n => [...n, { who: 'You', t: (data.note as string) || text.slice(0, 48) }, { who: 'Dr. Mira', t: reply.slice(0, 64) }]);
      if (data.confidence) setConfidence(data.confidence);
      if (Array.isArray(data.flags)) setFlags(data.flags);
      setThinking(false);
      const done = data.done && data.recommendation;
      say(reply, () => {
        if (done) {
          onDoneRef.current(data.recommendation, {
            confidence: data.confidence || 'high',
            flags: Array.isArray(data.flags) ? data.flags : [],
            notes: notesRef.current.filter(n => n.who === 'You').map(n => n.t),
            users: next.filter(m => m.role === 'user').map(m => m.text),
          });
        } else {
          listenRef2.current();
        }
      });
    } catch {
      const err = 'Sorry, I had trouble hearing that — could you tell me again?';
      const next = [...msgs];
      messagesRef.current = next;
      setMessages(next);
      setThinking(false);
      setStatus('idle');
      setFailed(true);
      say(err, () => listenRef2.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  const messagesRef = useRef<Turn[]>([]);
  const notesRef = useRef<{ who: string; t: string }[]>([]);
  const handleUserRef = useRef(handleUser);
  handleUserRef.current = handleUser;
  const listenRef2 = useRef(listen);
  listenRef2.current = listen;
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const start = useCallback(() => {
    const greeting =
      "Hi Alex, I'm Dr. Mira, your AI doctor. Everything here is private, and a licensed doctor reviews my advice before it reaches you. So — how are you feeling today?";
    const init = [{ role: 'doctor' as const, text: greeting, at: Date.now() }];
    messagesRef.current = init;
    setMessages(init);
    setNotes([]);
    setMicDenied(false);
    setFailed(false);
    setStarted(true);
    setLastTurn(Date.now());
    say(greeting, () => listenRef2.current());
  }, [say]);

  const reset = useCallback(() => {
    stopListening();
    stopAllVoice();
    messagesRef.current = [];
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
    thinking, muted, micDenied, clearMicDenied: () => setMicDenied(false), failed, retry, started, lastTurn,
    confidence, flags, start, reset, orbTap, send: (t: string) => handleUserRef.current(t),
    setMuted,
  };
}
