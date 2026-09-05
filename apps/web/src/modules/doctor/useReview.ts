// Doctor-desk review conversation: Mira presents the case, takes voice/text
// commands, applies edits to the on-screen draft. Approval stays UI-only.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseItem } from '../../lib/core';
import type { MiraTurn } from '../../lib/ui';
import { aiComplete, type ChatMessage } from '../../lib/api';
import { listenOnce, speak, stopAllVoice } from '../../lib/voice';

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
const START_PILLS = ['Summarise this case', 'What did the patient say?'];
const REVIEW_PILLS = ['Approve and send', 'Decline this', 'Change the dosage', 'Add a test'];

export function useReview(opts: {
  getCase: () => CaseItem | undefined;
  onEdit: (rec: any) => void;
  onApprove: () => void;
}) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<MiraTurn[]>([]);
  const [failedCmd, setFailedCmd] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const getCaseRef = useRef(opts.getCase);
  getCaseRef.current = opts.getCase;
  const onEditRef = useRef(opts.onEdit);
  onEditRef.current = opts.onEdit;
  const onApproveRef = useRef(opts.onApprove);
  onApproveRef.current = opts.onApprove;

  const stop = useCallback(() => {
    stopAllVoice();
    setActive(false);
    setStatus('idle');
  }, []);

  const say = useCallback((text: string, after?: () => void) => {
    if (muted) {
      setStatus('idle');
      after && after();
      return;
    }
    setStatus('speaking');
    speak(text, { onDone: () => after && after() });
  }, [muted]);

  const listen = useCallback(() => {
    const h = listenOnce({
      onText: (t) => commandRef.current(t, false),
      onError: () => setStatus('idle'),
      onEnd: () => setStatus(s => (s === 'listening' ? 'idle' : s)),
    });
    if (h) setStatus('listening');
    else setStatus('idle');
  }, []);

  const command = useCallback(async (text: string, typed: boolean) => {
    text = (text || '').trim();
    if (!text) return;
    const ac = getCaseRef.current();
    if (!ac) return;
    setStatus('thinking');
    setMessages(m => [...m, { role: 'user', text, at: Date.now() }]);
    const sys = `You are Dr. Mira, an AI clinician speaking ALOUD with a licensed human doctor who is reviewing your recommendation for patient ${ac.patient}. Speak warmly and concisely, like a trusted colleague.
Current recommendation JSON: ${JSON.stringify(ac.rec)}.
The doctor just spoke. Decide:
- If they approve/confirm/say it looks good → action "approve". reply MUST be exactly: "Thank you, I'll notify the patient right away."
- If they ask for a change (add/remove/replace a test, drug, dosage, timing, or advice) → action "edit". Apply it and return the FULL updated recommendation (same JSON shape, keep untouched fields), then briefly confirm what you changed and ask if there's anything else.
- Otherwise → action "none". Answer briefly, then ask if they'd like any changes.
Keep item fields: name, dosage, timing, notes, why, detail. Respond ONLY with JSON, no prose, no code fences:
{"reply": string, "action": "approve"|"edit"|"none", "recommendation": <recommendation JSON> | null}`;
    try {
      setFailedCmd(null);
      const raw = await aiComplete({ system: sys, messages: [{ role: 'user', content: text } as ChatMessage], max_tokens: 800 });
      const data = parseAi(raw);
      const reply = data.reply || 'Done. Anything else?';
      setMessages(m => [...m, { role: 'mira', text: reply, at: Date.now() }]);
      setStatus('idle');
      if (data.action === 'approve') {
        onApproveRef.current();
        say(reply);
        return;
      }
      if (data.action === 'edit' && data.recommendation) onEditRef.current(data.recommendation);
      say(reply, typed ? undefined : () => listenRef.current());
    } catch {
      setFailedCmd(text);
      say('Sorry, could you say that again?', typed ? undefined : () => listenRef.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commandRef = useRef(command);
  commandRef.current = command;
  const listenRef = useRef(listen);
  listenRef.current = listen;

  const start = useCallback(() => {
    const ac = getCaseRef.current();
    if (!ac) return;
    const parts = (ac.rec.items || []).map(i => i.name + (i.dosage ? ' ' + i.dosage : '')).join(', ');
    const summary = `Hi doctor. Quick summary for ${ac.patient.split(' ')[0]}: ${ac.summary} My assessment is ${(ac.inferred && ac.inferred[0]) || ac.rec.title}, and I'm recommending ${parts}. Would you like to change anything — the tests, the prescription, or the advice — or shall I send it to the patient?`;
    setMessages([{ role: 'mira', text: summary, at: Date.now() }]);
    setActive(true);
    say(summary, () => listenRef.current());
  }, [say]);

  const orbTap = useCallback(() => {
    if (status === 'speaking') {
      stopAllVoice();
      listenRef.current();
    } else if (status === 'idle') {
      if (active) listenRef.current();
      else start();
    }
  }, [status, active, start]);

  useEffect(() => () => stopAllVoice(), []);

  return {
    active, status, messages, muted, setMuted, start, stop, orbTap, failedCmd,
    command: (t: string) => commandRef.current(t, true),
    send: (t: string) => commandRef.current(t, true),
    suggestions: active ? REVIEW_PILLS : START_PILLS,
    failed: !!failedCmd,
    retry: () => failedCmd && commandRef.current(failedCmd, true),
  };
}
