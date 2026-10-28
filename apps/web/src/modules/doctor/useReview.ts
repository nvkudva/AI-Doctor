// Doctor-desk review conversation: Mira presents the case, takes voice/text
// commands, applies edits to the on-screen draft. Approval stays UI-only: Mira
// may *propose* an approval, but only the doctor's own press of "Approve & send"
// ever signs one (PRD UC-2.6 / D-9).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseItem } from '../../lib/core';
import type { MiraTurn, Suggestion } from '../../lib/ui';
import { aiComplete, aiReview, hasSupabase, type ChatMessage } from '../../lib/api';
import { listenOnce, onVoiceHealth, speak, stopAllVoice, voiceDegraded, type SpeakHandle } from '../../lib/voice';
import { kokoroReady, kokoroWhenReady, warmKokoro } from '../../lib/voice/kokoro';
import { warmStt } from '../../lib/models/stt';
import { warmLlm } from '../../lib/models/llm';

function parseAi(raw: string): any {
  if (!raw) return { reply: '', done: false, action: 'none' };
  let t = String(raw).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    return { reply: String(raw), done: false, action: 'none' };
  }
}

// Spoken shortcuts for the actions the doctor takes most; they run through the
// same command path as speech, so Mira confirms them the same way.
const START_PILLS: Suggestion[] = [
  { label: 'Summarise this case' },
  { label: 'What did the patient say?' },
];
const REVIEW_PILLS: Suggestion[] = [
  { label: 'Draft an approval', tone: 'ok' },
  { label: 'Decline this', tone: 'bad' },
  { label: 'Change the dosage', tone: 'warn' },
  { label: 'Add a test' },
];

// Spoken by Mira, never by the model, whenever the doctor signals approval.
// It is deliberately fixed text: no model output may ever assert that a
// prescription was signed (UX-07/UX-08).
const APPROVAL_HANDOFF =
  "I can't sign a prescription — that's yours to do. When you're happy with the draft, press \u201cApprove & send\u201d on the case and it goes to the patient.";
const NO_CASE = 'Open a case from the queue and I\u2019ll take you through it.';

// The doctor asking for a change is a `revise` turn; anything else is `qa`
// (§4.2 row 20). The mode only tells the function what kind of turn this is —
// nothing clinical is decided here.
const REVISE = /\b(change|add|remove|replace|swap|increase|decrease|drop|dose|dosage|timing|advice)\b/i;
// An approval is never routed through a model: the doctor's own press of
// “Approve & send” is the only thing that signs one (UX-07/UX-08).
const APPROVE_INTENT = /\b(approve|approved|looks good|sign it|send it|go ahead|happy with)\b/i;

export function useReview(opts: {
  getCase: () => CaseItem | undefined;
  onEdit: (rec: any) => void;
}) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<MiraTurn[]>([]);
  const [failedCmd, setFailedCmd] = useState<string | null>(null);
  // Same degradation the patient sees: the browser's voice stands in.
  const speakRef = useRef<SpeakHandle | null>(null);
  const abandonRef = useRef(false);
  const [voiceOffline, setVoiceOffline] = useState(voiceDegraded());
  useEffect(() => onVoiceHealth(setVoiceOffline), []);
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
  // Two separate switches: whether Mira speaks, and whether she listens.
  const [speakerOff, setSpeakerOffState] = useState(false);
  const [micOff, setMicOffState] = useState(false);
  const speakerOffRef = useRef(false);
  const micOffRef = useRef(false);
  const getCaseRef = useRef(opts.getCase);
  getCaseRef.current = opts.getCase;
  const onEditRef = useRef(opts.onEdit);
  onEditRef.current = opts.onEdit;
  // True once the doctor has asked Mira to approve: the decision is staged for
  // them, never performed. Cleared as soon as the draft changes again.
  const [approvalStaged, setApprovalStaged] = useState(false);

  const stop = useCallback(() => {
    abandonRef.current = true;
    speakRef.current?.cancel();
    stopAllVoice();
    setActive(false);
    setStatus('idle');
  }, []);

  const say = useCallback((text: string, after?: () => void) => {
    if (speakerOffRef.current) {
      setStatus('idle');
      after && after();
      return;
    }
    setStatus('speaking');
    abandonRef.current = false;
    // The handle is kept so an interrupt can resolve the turn rather than
    // orphan it: cancelling now runs the continuation, which is how she starts
    // listening again (D-voice 3).
    speakRef.current = speak(text, {
      onDone: () => {
        if (abandonRef.current) return;
        after && after();
      },
      // Not armed while the mic is switched off: barge-in turns capture back
      // on, and a patient who has silenced their microphone has said they do
      // not want it live.
      onBarge: micOffRef.current ? undefined : () => { speakRef.current?.cancel(); },
    });
  }, []);

  // Silencing her cuts the current sentence off at once; the transcript keeps it.
  const setSpeakerOff = useCallback((v: boolean) => {
    speakerOffRef.current = v;
    setSpeakerOffState(v);
    if (v) {
      speakRef.current?.cancel();
    }
  }, []);

  const setMicOff = useCallback((v: boolean) => {
    micOffRef.current = v;
    setMicOffState(v);
    if (v) setStatus(s => (s === 'listening' ? 'idle' : s));
  }, []);

  const listen = useCallback(() => {
    if (micOffRef.current) {
      setStatus('idle');
      return;
    }
    const h = listenOnce({
      onText: (t) => commandRef.current(t, false),
      onError: () => setStatus('idle'),
      onEnd: () => setStatus(s => (s === 'listening' ? 'idle' : s)),
      onStart: () => setStatus('listening'),
    });
    if (!h) setStatus('idle');
  }, []);

  const command = useCallback(async (text: string, typed: boolean) => {
    text = (text || '').trim();
    if (!text) return;
    const ac = getCaseRef.current();
    setMessages(m => [...m, { role: 'user', text, at: Date.now() }]);
    if (!ac) {
      setMessages(m => [...m, { role: 'mira', text: NO_CASE, at: Date.now() }]);
      // Spoken to, she answers and keeps listening; typed to, the composer has
      // the turn. Either way she never answers and then goes deaf.
      say(NO_CASE, typed ? undefined : () => listenRef.current());
      return;
    }
    setStatus('thinking');
    const sys = `You are Dr. Mira, an AI clinician speaking ALOUD with a licensed human doctor who is reviewing your recommendation for patient ${ac.patient}. Speak warmly and concisely, like a trusted colleague.
Current recommendation JSON: ${JSON.stringify(ac.rec)}.
The doctor just spoke. Decide:
- If they approve/confirm/say it looks good → action "approve". You are NOT able to approve or send anything: set reply to "" and let the app answer. Never claim a prescription was signed, sent or that the patient was notified.
- If they ask for a change (add/remove/replace a test, drug, dosage, timing, or advice) → action "edit". Apply it and return the FULL updated recommendation (same JSON shape, keep untouched fields), then briefly confirm what you changed and ask if there's anything else.
- Otherwise → action "none". Answer briefly, then ask if they'd like any changes.
Keep item fields: name, dosage, timing, notes, why, detail. Respond ONLY with JSON, no prose, no code fences:
{"reply": string, "action": "approve"|"edit"|"none", "recommendation": <recommendation JSON> | null}`;
    try {
      setFailedCmd(null);
      if (hasSupabase()) {
        if (APPROVE_INTENT.test(text)) {
          setStatus('idle');
          setApprovalStaged(true);
          setMessages(m => [...m, { role: 'mira', text: APPROVAL_HANDOFF, at: Date.now() }]);
          say(APPROVAL_HANDOFF, typed ? undefined : () => listenRef.current());
          return;
        }
        let streamed = '';
        const turn = await aiReview(
          { consultId: ac.id, text, mode: REVISE.test(text) ? 'revise' : 'qa' },
          (t) => { streamed += t; },
        );
        setStatus('idle');
        const spoken = streamed.trim() || 'Done. Anything else?';
        setMessages(m => [...m, { role: 'mira', text: spoken, at: Date.now() }]);
        if (turn.proposed_draft) {
          // Rendered now; persisted only by the deliberate revise_draft call
          // the store makes on our behalf (§4.2 row 21).
          setApprovalStaged(false);
          onEditRef.current(turn.proposed_draft);
        }
        say(spoken, typed ? undefined : () => listenRef.current());
        return;
      }
      // The whole exchange, not just the latest line: without it a follow-up
      // like "make that 5 mg instead" has nothing to refer back to.
      const history: ChatMessage[] = messagesRef.current.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant', content: m.text,
      } as ChatMessage));
      const raw = await aiComplete({ system: sys, messages: [...history, { role: 'user', content: text } as ChatMessage], max_tokens: 800 });
      const data = parseAi(raw);
      setStatus('idle');
      // The model may propose an approval; it may never perform one, and the
      // confirmation it wants to speak is replaced with the handoff line.
      if (data.action === 'approve') {
        setApprovalStaged(true);
        setMessages(m => [...m, { role: 'mira', text: APPROVAL_HANDOFF, at: Date.now() }]);
        say(APPROVAL_HANDOFF, typed ? undefined : () => listenRef.current());
        return;
      }
      const reply = data.reply || 'Done. Anything else?';
      setMessages(m => [...m, { role: 'mira', text: reply, at: Date.now() }]);
      if (data.action === 'edit' && data.recommendation) {
        setApprovalStaged(false);
        onEditRef.current(data.recommendation);
      }
      say(reply, typed ? undefined : () => listenRef.current());
    } catch {
      setFailedCmd(text);
      say('Sorry, could you say that again?', typed ? undefined : () => listenRef.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesRef = useRef<MiraTurn[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const commandRef = useRef(command);
  commandRef.current = command;
  const listenRef = useRef(listen);
  listenRef.current = listen;

  const start = useCallback(() => {
    const ac = getCaseRef.current();
    if (!ac) {
      setMessages([{ role: 'mira', text: NO_CASE, at: Date.now() }]);
      setActive(true);
      say(NO_CASE, () => listenRef.current());
      return;
    }
    setApprovalStaged(false);
    const parts = (ac.rec.items || []).map(i => i.name + (i.dosage ? ' ' + i.dosage : '')).join(', ');
    const summary = `Hi doctor. Quick summary for ${ac.patient.split(' ')[0]}: ${ac.summary} My assessment is ${(ac.inferred && ac.inferred[0]) || ac.rec.title}, and I'm recommending ${parts}. Would you like to change anything — the tests, the prescription, or the advice — before you sign it off?`;
    setMessages([{ role: 'mira', text: summary, at: Date.now() }]);
    setActive(true);
    say(summary, () => listenRef.current());
  }, [say]);

  const orbTap = useCallback(() => {
    if (status === 'speaking') {
      // Cancel resolves into the same continuation, so listening is not started
      // twice here — that ran two capture streams and leaked the first.
      speakRef.current?.cancel();
    } else if (status === 'idle') {
      if (active) listenRef.current();
      else start();
    }
  }, [status, active, start]);

  useEffect(() => () => stopAllVoice(), []);

  return {
    active, status, messages, speakerOff, setSpeakerOff, micOff, setMicOff, start, stop, orbTap, failedCmd,
    voiceOffline, voiceLoading,
    silence: stop,
    approvalStaged,
    command: (t: string) => commandRef.current(t, true),
    send: (t: string) => commandRef.current(t, true),
    suggestions: active ? REVIEW_PILLS : START_PILLS,
    failed: !!failedCmd,
    retry: () => failedCmd && commandRef.current(failedCmd, true),
  };
}
