// AI adapter for Dr. Mira.
// Resolution order:
//   1. window.claude.complete  — present when running inside Claude Design / artifacts
//   2. Anthropic API           — if the user stored a key: localStorage.setItem('vd_anthropic_key', 'sk-ant-…')
//   3. Scripted demo engine    — works offline with no setup; produces plausible consults
//
// All three return a raw string the app parses as JSON.

const API_MODEL = localStorage.getItem('vd_model') || 'claude-opus-4-8';

export async function aiComplete({ system, messages, max_tokens = 800 }) {
  if (window.claude && typeof window.claude.complete === 'function') {
    return window.claude.complete({ system, messages, max_tokens });
  }
  const key = localStorage.getItem('vd_anthropic_key');
  if (key) {
    try {
      return await apiComplete({ system, messages, max_tokens }, key);
    } catch (e) {
      console.warn('[vd] Anthropic API call failed, falling back to demo engine:', e);
    }
  }
  return demoComplete({ system, messages });
}

export function aiBackendName() {
  if (window.claude && typeof window.claude.complete === 'function') return 'claude-helper';
  if (localStorage.getItem('vd_anthropic_key')) return 'anthropic-api';
  return 'demo';
}

async function apiComplete({ system, messages, max_tokens }, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: API_MODEL, max_tokens, system, messages }),
  });
  if (!res.ok) throw new Error('Anthropic API error ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Request was refused');
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// ---------------------------------------------------------------------------
// Scripted demo engine — no network, deterministic-ish, honors both system
// prompts used by the app (patient consult vs doctor-desk review).
// ---------------------------------------------------------------------------

function demoComplete({ system, messages }) {
  const isDocReview = /reviewing your recommendation/i.test(system || '');
  const raw = isDocReview ? demoDoctor(system, messages) : demoPatient(messages);
  // small delay so the "Thinking…" state is visible, like a real call
  return new Promise(r => setTimeout(() => r(JSON.stringify(raw)), 700 + Math.random() * 600));
}

const TOPICS = [
  { key: 'fever', re: /fever|temperature|hot|chills/i,
    empathy: "I'm sorry you're running a fever — that can really wear you down.",
    associated: 'Any cough, sore throat, or body aches along with it?',
    rec: { type: 'prescription', title: 'Fever management', summary: 'Fever, likely viral in origin, without red-flag features.',
      items: [
        { name: 'Paracetamol', dosage: '500 mg', timing: 'Every 6 hours as needed, max 4 doses/day', notes: 'Take after food.', why: 'To bring the fever down and ease the aches while your body fights the infection.', detail: 'Every 6 hours as needed, max 4/day.' },
        { name: 'Fluids & rest', dosage: '', timing: 'Ongoing until fever settles', notes: 'At least 2–3 litres of fluid daily.', why: 'Fever increases fluid loss; rest helps recovery.', detail: 'Plenty of fluids and rest until the fever settles.' },
      ],
      advice: 'Seek care if the fever lasts more than 3 days, goes above 39.5°C, or you develop breathing difficulty.', urgency: 'routine' } },
  { key: 'headache', re: /headache|migraine|head hurts|head pain/i,
    empathy: 'That sounds really uncomfortable — headaches can make everything harder.',
    associated: 'Do you also have nausea, light sensitivity, or any vision changes?',
    rec: { type: 'prescription', title: 'Headache relief plan', summary: 'Recurrent headache without neurological red flags.',
      items: [
        { name: 'Ibuprofen', dosage: '400 mg', timing: 'At headache onset, up to 3 times daily with food', notes: 'Avoid on an empty stomach.', why: 'An anti-inflammatory is effective for this pattern of headache.', detail: 'At onset, up to 3×/day with food.' },
        { name: 'Headache diary', dosage: '', timing: 'Daily, 2 weeks', notes: 'Note triggers, sleep and screen time.', why: 'To spot triggers and decide if preventive therapy is needed.', detail: 'Track triggers, frequency and duration for 2 weeks.' },
      ],
      advice: 'Seek urgent care for a sudden severe headache, weakness, slurred speech, or vision loss.', urgency: 'routine' } },
  { key: 'stomach', re: /stomach|belly|abdom|nausea|vomit|indigestion|acid/i,
    empathy: "I'm sorry — stomach trouble is miserable to deal with.",
    associated: 'Any vomiting, diarrhoea, or blood in your stool?',
    rec: { type: 'prescription', title: 'Gastric care plan', summary: 'Upper abdominal discomfort consistent with gastritis/dyspepsia.',
      items: [
        { name: 'Omeprazole', dosage: '20 mg', timing: 'Once daily before breakfast, 14 days', notes: 'Take 30 minutes before food.', why: 'Reducing stomach acid lets the lining settle and heal.', detail: 'Once daily before breakfast for 14 days.' },
        { name: 'Bland diet', dosage: '', timing: 'Until symptoms settle', notes: 'Avoid spicy food, alcohol and late-night meals.', why: 'Removing irritants speeds up recovery.', detail: 'Avoid spicy food, alcohol, late meals.' },
      ],
      advice: 'Seek care promptly if you notice black stools, blood, or severe persistent pain.', urgency: 'routine' } },
  { key: 'rash', re: /rash|itch|skin|hives|eczema/i,
    empathy: 'Itchy skin is so frustrating — thank you for telling me about it.',
    associated: 'Is the rash spreading, and did anything new touch your skin recently — soap, detergent, plants?',
    rec: { type: 'prescription', title: 'Skin rash care', summary: 'Localized itchy rash, likely irritant or contact dermatitis.',
      items: [
        { name: 'Hydrocortisone 1% cream', dosage: 'Thin layer', timing: 'Twice daily, up to 7 days', notes: 'Apply to affected areas only.', why: 'A mild steroid calms the inflamed, itchy skin.', detail: 'Thin layer twice daily, up to 7 days.' },
        { name: 'Cetirizine', dosage: '10 mg', timing: 'Once daily at night, 5 days', notes: 'May cause mild drowsiness.', why: 'An antihistamine takes the edge off the itching, especially at night.', detail: 'Once nightly for 5 days.' },
      ],
      advice: 'Seek care if the rash spreads quickly, blisters, or you develop a fever.', urgency: 'routine' } },
  { key: 'cough', re: /cough|throat|cold|congest|phlegm/i,
    empathy: "That lingering cough sounds exhausting — I'm glad you brought it up.",
    associated: 'Is the cough dry or bringing anything up, and is it worse at night?',
    rec: { type: 'investigation', title: 'Cough work-up', summary: 'Persistent cough; imaging advised to rule out lower respiratory involvement.',
      items: [
        { name: 'Chest X-ray (PA view)', dosage: '', timing: 'Within 3 days', notes: 'Rule out lower respiratory involvement.', why: 'Because the cough has persisted, an X-ray safely rules out anything in the chest.', detail: 'Rule out lower respiratory involvement.' },
        { name: 'Loratadine', dosage: '10 mg', timing: 'Once daily, 7 days', notes: 'For suspected post-nasal drip.', why: 'To settle a likely post-nasal drip driving the cough.', detail: '7-day trial for suspected post-nasal drip.' },
      ],
      advice: 'Return sooner if fever, breathlessness or coughing blood appears.', urgency: 'soon' } },
];

const GENERAL_TOPIC = {
  key: 'general', re: /./,
  empathy: "Thank you for telling me — I'm here to help you figure this out.",
  associated: 'Have you noticed anything else along with it — fever, tiredness, changes in appetite or sleep?',
  rec: { type: 'investigation', title: 'General health check', summary: 'Non-specific symptoms; baseline investigations advised.',
    items: [
      { name: 'Complete Blood Count', dosage: '', timing: 'Within a week', notes: 'Baseline screen.', why: 'A simple blood test rules out infection or anaemia behind how you feel.', detail: 'Baseline screen for infection/anaemia.' },
      { name: 'Rest & hydration', dosage: '', timing: 'Ongoing', notes: 'Aim for 7–8 hours of sleep.', why: 'Recovery starts with sleep and fluids.', detail: 'Prioritize sleep and fluids.' },
    ],
    advice: 'If symptoms worsen or new ones appear, start another consult right away.', urgency: 'routine' } };

const EMERGENCY_RE = /chest pain|can'?t breathe|difficulty breathing|breathless|stroke|face droop|slurred|bleeding heavily|severe bleeding|suicid/i;

function trunc7(t) {
  const w = String(t || '').trim().split(/\s+/).slice(0, 7).join(' ');
  return w.length > 48 ? w.slice(0, 47) + '…' : w;
}

function demoPatient(messages) {
  const users = (messages || []).filter(m => m.role === 'user').map(m => String(m.content));
  const n = users.length;
  const all = users.join(' ');
  const topic = TOPICS.find(t => t.re.test(all)) || GENERAL_TOPIC;
  const note = trunc7(users[n - 1] || '');
  const base = { note, confidence: 'high', flags: ['Penicillin allergy respected'], done: false, recommendation: null };

  if (EMERGENCY_RE.test(all)) {
    return { ...base, confidence: 'low', flags: ['Possible emergency — advised in-person care', 'Penicillin allergy respected'], done: true,
      reply: "What you're describing could be serious, and I don't want to take chances with you. Please get to urgent in-person care or call emergency services now.",
      recommendation: { type: 'investigation', title: 'Urgent in-person assessment', summary: 'Symptoms may indicate an emergency; immediate in-person evaluation advised.',
        items: [{ name: 'Emergency department visit', dosage: '', timing: 'Immediately', notes: 'Do not drive yourself if unwell.', why: 'These symptoms need hands-on assessment right away.', detail: 'Immediate in-person evaluation.' }],
        advice: 'Call emergency services now if symptoms are worsening.', urgency: 'urgent' } };
  }

  switch (n) {
    case 0:
      return { ...base, reply: "Hi Alex, I'm Dr. Mira. How are you feeling today?" };
    case 1:
      return { ...base, reply: `${topic.empathy} How long has this been going on?` };
    case 2:
      return { ...base, reply: "Thanks, that helps me picture it. On a scale from mild to severe, how bad does it feel right now?" };
    case 3:
      return { ...base, confidence: 'medium', reply: `I hear you — we'll get you sorted. ${topic.associated}` };
    case 4:
      return { ...base, reply: 'Almost done, I promise. Are you taking any medicines at the moment, other than what we have on file?' };
    default:
      return { ...base, done: true,
        reply: "Thank you for walking me through everything, Alex — you've given me a clear picture. I've put together a plan for you, and Dr. Whitfield will give it a quick look before it reaches you.",
        recommendation: topic.rec };
  }
}

// Doctor-desk review: Dr. Mira talking to the reviewing physician.
function demoDoctor(system, messages) {
  const text = String((messages && messages[messages.length - 1] && messages[messages.length - 1].content) || '');
  let rec = null;
  try {
    const m = /Current recommendation JSON: (\{.*?\})\.\n/s.exec(system);
    if (m) rec = JSON.parse(m[1]);
  } catch (e) { /* fall through */ }

  if (/\b(approve|looks good|send it|go ahead|perfect|confirm|ship it|all good)\b/i.test(text)) {
    return { reply: "Thank you, I'll notify the patient right away.", action: 'approve', recommendation: null };
  }

  if (rec && /\badd\b.*\b(test|lab|cbc|x-?ray|blood)\b/i.test(text)) {
    const name = /cbc|blood count/i.test(text) ? 'Complete Blood Count' : /x-?ray/i.test(text) ? 'Chest X-ray (PA view)' : 'Complete Blood Count';
    const items = [...(rec.items || []), { name, dosage: '', timing: 'Within a week', notes: 'Added on reviewer request.', why: 'The reviewing doctor asked for this to be checked.', detail: 'Added on reviewer request.' }];
    return { reply: `Done — I've added ${name} to the plan. Anything else you'd like to change?`, action: 'edit', recommendation: { ...rec, items } };
  }

  if (rec && /\b(remove|drop|take out|delete)\b/i.test(text)) {
    const items = (rec.items || []);
    const idx = items.findIndex(it => it.name && text.toLowerCase().includes(it.name.split(' ')[0].toLowerCase()));
    const cut = idx >= 0 ? idx : items.length - 1;
    if (items.length > 1) {
      const removed = items[cut];
      const rest = items.filter((_, i) => i !== cut);
      return { reply: `Understood — I've removed ${removed.name} from the plan. Anything else?`, action: 'edit', recommendation: { ...rec, items: rest } };
    }
    return { reply: "That's the only item on the plan — shall I replace it with something instead?", action: 'none', recommendation: null };
  }

  if (rec && /\b(change|update|switch|increase|decrease|dosage|dose|advice)\b/i.test(text)) {
    if (/advice/i.test(text)) {
      const advice = text.replace(/^.*?advice\b[—:,-]*\s*/i, '').trim() || rec.advice;
      return { reply: "I've updated the advice for the patient. Anything else you'd like to adjust?", action: 'edit', recommendation: { ...rec, advice } };
    }
    return { reply: "Could you tell me exactly what to change — for example, 'change Loratadine to 5 mg once daily'? I'll update the plan.", action: 'none', recommendation: null };
  }

  return { reply: "Noted, doctor. Would you like me to change the tests, the prescription, or the advice — or shall I send it to the patient?", action: 'none', recommendation: null };
}
