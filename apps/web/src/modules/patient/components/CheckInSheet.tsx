// The day-3 nudge on an approved plan. Three taps, no free text, no scale of
// one to ten: anything that reads as a survey gets ignored, and the answer has
// to be worth acting on. "Same" or "worse" opens Mira with the answer already
// said, so the patient never has to start a fresh consult to be heard.
import { useState } from 'react';
import { Button, Card, Icon, MiraPresence } from '../../../lib/ui';
import s from './CheckInSheet.module.css';

export type CheckInAnswer = 'better' | 'same' | 'worse';

const CHOICES: { key: CheckInAnswer; label: string; sub: string; bg: string; fg: string }[] = [
  { key: 'better', label: 'Better', sub: 'The plan is working', bg: 'var(--vd-ok-bg)', fg: 'var(--vd-ok-fg)' },
  { key: 'same', label: 'About the same', sub: 'No change since I started', bg: 'var(--vd-warn-bg)', fg: 'var(--vd-warn-fg)' },
  { key: 'worse', label: 'Worse', sub: 'Spreading, or new symptoms', bg: 'var(--vd-bad-bg)', fg: 'var(--vd-bad-fg)' },
];

const FOLLOW_UP: Record<CheckInAnswer, string> = {
  better: 'Good — that is what we were hoping for. Finish the course as prescribed, and tell me if anything changes.',
  same: 'Because it has not settled, Dr. Mira will ask a few short questions and send an updated plan to your doctor. You do not need to start a new consultation.',
  worse: 'Because it is worse, Dr. Mira will ask a few questions now and flag this to your doctor as a priority.',
};

export function CheckInSheet({ title, onAnswer, onDismiss }: {
  title: string;
  onAnswer: (a: CheckInAnswer, followUp: boolean) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<CheckInAnswer | null>(null);
  return (
    <div className={s.screen}>
      <div className={s.orb}><MiraPresence size={96} /></div>
      <div className={s.title}>How is it going with {title.toLowerCase()}?</div>
      <div className={s.lede}>
        It has been a few days since your doctor approved this plan. One tap is enough.
      </div>

      <div className={s.choices}>
        {CHOICES.map(c => {
          const on = picked === c.key;
          return (
            <Card
              key={c.key}
              level={on ? 3 : 1}
              pad="16px 18px"
              onClick={() => setPicked(c.key)}
              className={`${s.choice}${on ? ' ' + s.choiceOn : ''}`}
            >
              <span className={s.badge} style={{ background: c.bg, color: c.fg }}>{c.label[0]}</span>
              <div className={s.choiceBody}>
                <div className={s.choiceLabel}>{c.label}</div>
                <div className={s.choiceSub}>{c.sub}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {picked && (
        <Card tone="panel" bordered={false} className={s.note}>
          <span className={s.noteIcon}><Icon name="alert" size={18} /></span>
          <div className={s.noteText}>{FOLLOW_UP[picked]}</div>
        </Card>
      )}

      <Button
        fullWidth
        disabled={!picked}
        onClick={() => picked && onAnswer(picked, picked !== 'better')}
      >
        Continue
      </Button>
      <button type="button" className={s.later} onClick={onDismiss}>Not now — remind me tomorrow</button>
    </div>
  );
}
