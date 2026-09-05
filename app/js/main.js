import { html, render, Component } from '../vendor/preact-htm.js';
import { MiraOrb } from './orb.js';
import { IOSDevice } from './ios-frame.js';
import { ImageSlot } from './image-slot.js';
import { aiComplete } from './ai.js';
import { persist, restore } from './backend.js';
import { pickVoice } from './voice.js';
import { applyTenant } from './tenant.js';

const SYS = `You are Dr. Mira, a warm, emotionally intelligent virtual general physician in the Virtual Doctor app. You speak, so your words are heard aloud — sound like a caring human clinician, never like a form.
Patient on file: Alex Kumar, 34, male, blood group O+, allergic to Penicillin, history of mild asthma.
CONVERSATION STYLE:
- FIRST, briefly acknowledge how the patient feels before your clinical question ("That sounds really uncomfortable" / "I'm sorry you're dealing with that"). Empathy first, then the question.
- Ask only ONE question per turn. 1-2 short, plain, spoken-sounding sentences. No lists, no jargon.
- Vary your wording naturally across turns — never sound scripted or repeat the same phrasings.
- If the patient seems anxious, reassure them briefly (privacy, that you're here to help, that a human doctor reviews everything).
- If the patient struggles to describe something, gently offer options or examples.
CLINICAL:
- Gather: main symptom, duration, severity, associated symptoms, relevant history.
- After enough (usually 4-6 patient replies), decide next steps: lab tests/investigations OR a prescription (NEVER Penicillin-class given the allergy — this is a hard safety rule).
- If anything sounds like an emergency (chest pain, breathing difficulty, stroke signs, severe bleeding), set urgency "urgent" and clearly tell them to seek in-person emergency care now.
Respond with ONLY a JSON object, no prose, no code fences:
{"reply": string, "note": string, "confidence": "high"|"medium"|"low", "flags": string[], "done": boolean, "recommendation": null | {"type":"prescription"|"investigation","title":string,"summary":string,"items":[{"name":string,"dosage":string,"timing":string,"notes":string,"why":string,"detail":string}],"advice":string,"urgency":"routine"|"soon"|"urgent"}}
Set done=true and fill recommendation only when complete; otherwise done=false, recommendation=null.
"note": neutral third-person summary of the patient's last message, 7 words or fewer.
"confidence": your certainty in the emerging assessment. "flags": short safety/attention notes for the reviewing human doctor (e.g. "Penicillin allergy respected", "Consider red-flag headache screen"), or [].
Per recommendation item: "name", "dosage" (e.g. "500 mg" or "" for a test), "timing" (e.g. "Twice daily after food"), "notes" (short caution or ""), "why" (one plain-language reason this is recommended, e.g. "Because your cough has lasted over two weeks"), "detail" (one-line fallback). Do NOT repeat item info in "advice" — advice adds only new guidance (when to seek help), 1 short sentence, or "".`;

// Static large orb (login / home): ground shadow + one ring + pulsing sphere.
function OrbLarge() {
  return html`
    <div style="position:relative;width:152px;height:162px;display:flex;align-items:flex-start;justify-content:center;flex:none">
      <div style="position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);width:116px;height:20px;border-radius:50%;background:radial-gradient(ellipse,rgba(12,20,60,.4),transparent 70%);filter:blur(4px)"></div>
      <div style="position:absolute;inset:0 0 10px 0;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);animation:vd-ring 2.8s ease-out infinite"></div>
      <div style="position:relative;width:138px;height:138px;font-size:138px;border-radius:50%;overflow:hidden;background:#F4FAFF;box-shadow:0 24px 48px oklch(0.35 0.15 270 / .55),0 0 38px oklch(0.7 0.15 260 / .4),inset 0 0 0 1px rgba(255,255,255,.85);animation:vd-pulse 3.6s ease-in-out infinite">
        <${MiraOrb} />
      </div>
    </div>`;
}

class App extends Component {
  state = {
    view: 'patient',
    screen: 'login',
    messages: [],
    input: '',
    thinking: false,
    started: false,
    showType: false,
    muted: false,
    status: 'idle', // idle | listening | thinking | speaking
    notes: [],
    notesExpanded: false,
    currentLine: '',
    orderPlaced: false,
    sharedCaregiver: false,
    seconds: 0,
    level: 0,
    photoAttached: false,
    photoName: '',
    recommendation: null,
    aiConfidence: 'high',
    aiFlags: [],
    reviewStatus: 'idle', // idle | pending | approved | changes | rejected | expired
    rejectReason: '',
    adultOk: false, loginErr: '', lastTurn: 0, tenantName: '',
    voiceNote: false,
    showNotifs: false,
    showDocProfile: false,
    docReview: false,
    docMin: false,
    docStatus: 'idle', // idle | listening | thinking | speaking
    docLine: '',
    docInput: '',
    docNotesOpen: false,
    docMuted: false,
    docNotes: [],
    notifications: [
      { t: 'New AI case awaiting review', d: 'Maria Gonzalez · 14 min ago', kind: 'case' },
      { t: 'Lab result uploaded', d: 'Maria Gonzalez · 22 min ago', kind: 'lab' },
      { t: 'Patient replied to your note', d: 'James Okoro · 1h ago', kind: 'msg' },
    ],
    liveCaseId: null,
    activeCaseId: 'c1',
    queue: [
      { id: 'c1', patient: 'Maria Gonzalez', demo: '29 · Female · O−', title: 'Persistent dry cough, 2 weeks', meta: 'Submitted 14 min ago', status: 'pending',
        summary: 'Patient reports a dry, non-productive cough for ~2 weeks, worse at night, no fever. Mild chest tightness. No recent travel. Non-smoker.',
        symptoms: ['Dry cough', 'Worse at night', 'Chest tightness'], history: 'No chronic conditions. Seasonal allergies. No current medications.',
        relevantLabs: [ { name: 'CBC', date: 'Jun 20, 2026', result: 'Normal', ok: true }, { name: 'CRP', date: 'Jun 20, 2026', result: 'Mildly raised', ok: false } ],
        pastLabs: [ { name: 'Allergy panel', date: 'Sep 2025', result: 'Dust mite +', ok: false }, { name: 'Spirometry', date: 'Sep 2025', result: 'Normal', ok: true } ],
        pastConsults: [ { title: 'Seasonal rhinitis', date: 'Apr 2026', note: 'Antihistamine trial gave good relief; advised allergen avoidance.' } ],
        confidence: 'medium', flags: ['Cough >2 weeks — imaging advised', 'No red-flag symptoms reported'],
        stated: ['Dry cough 2 weeks', 'Worse at night', 'Mild chest tightness'], inferred: ['Likely post-nasal drip / airway irritation'],
        observation: 'She sounded a little breathless between sentences and cleared her throat often. No acute distress; speech was clear and she was fully alert.',
        rec: { type: 'investigation', title: 'Chest X-ray + trial of antihistamine', items: [ { name: 'Chest X-ray (PA view)', dosage: '', timing: 'Within 3 days', notes: 'Rule out lower respiratory involvement.', why: 'Because the cough has lasted more than two weeks.', detail: 'Rule out lower respiratory involvement.' }, { name: 'Loratadine', dosage: '10 mg', timing: 'Once daily, 7 days', notes: 'For suspected post-nasal drip.', why: 'To settle a likely post-nasal drip driving the cough.', detail: '7-day trial for suspected post-nasal drip.' } ], advice: 'Return sooner if fever, breathlessness or coughing blood appears.', urgency: 'soon' } },
      { id: 'c2', patient: 'James Okoro', demo: '41 · Male · B+', title: 'Recurring migraines', meta: 'Submitted 40 min ago', status: 'pending',
        summary: 'Throbbing unilateral headaches 3× this month, photophobia, relieved by rest in dark room. No aura. Family history of migraine.',
        symptoms: ['Unilateral headache', 'Photophobia', 'Nausea'], history: 'Hypertension, on Amlodipine 5mg. No known drug allergies.',
        relevantLabs: [ { name: 'BP log (30d avg)', date: 'Jun 2026', result: '138/88', ok: false } ],
        pastLabs: [ { name: 'Lipid profile', date: 'Jan 2026', result: 'Normal', ok: true }, { name: 'Fasting glucose', date: 'Jan 2026', result: 'Normal', ok: true } ],
        pastConsults: [ { title: 'Hypertension review', date: 'May 2026', note: 'BP borderline on Amlodipine; advised salt reduction and re-check.' }, { title: 'Tension headache', date: 'Nov 2025', note: 'Stress-related; resolved with rest and hydration.' } ],
        confidence: 'high', flags: ['No drug allergies on file', 'Check interaction with Amlodipine'],
        stated: ['Throbbing one-sided headache', 'Light sensitivity', 'Nausea'], inferred: ['Migraine without aura'],
        observation: 'He winced while describing the pain and preferred to keep the screen dim. Alert and oriented, no slurred speech or weakness.',
        rec: { type: 'prescription', title: 'Acute migraine management', items: [ { name: 'Sumatriptan', dosage: '50 mg', timing: 'At headache onset; repeat after 2h if needed', notes: 'Max 100 mg per day.', why: 'A triptan is first-line for acute migraine attacks.', detail: 'At onset of headache, may repeat after 2h (max 100mg/day).' }, { name: 'Headache diary', dosage: '', timing: 'Daily, 4 weeks', notes: 'Track triggers, frequency and duration.', why: 'To spot triggers and see if preventive therapy is needed.', detail: 'Track triggers, frequency and duration for 4 weeks.' } ], advice: 'Book a follow-up if attacks exceed 4/month for preventive therapy.', urgency: 'routine' } },
      { id: 'c3', patient: 'Priya Sharma', demo: '36 · Female · A+', title: 'Skin rash on forearms', meta: 'Approved 1h ago', status: 'approved',
        summary: 'Itchy erythematous rash on both forearms after new detergent. No systemic symptoms. Likely contact dermatitis.',
        symptoms: ['Itchy rash', 'Redness', 'Bilateral forearms'], history: 'Eczema in childhood. No allergies on record.',
        relevantLabs: [ { name: 'Patch test', date: 'Ordered', result: 'Pending', ok: false } ],
        pastLabs: [ { name: 'IgE total', date: 'Mar 2024', result: 'Slightly high', ok: false } ],
        pastConsults: [ { title: 'Eczema flare', date: 'Aug 2025', note: 'Managed with emollients and short steroid course.' } ],
        confidence: 'high', flags: ['No allergies on record', 'Clear trigger identified'],
        stated: ['Itchy rash both forearms', 'Started after new detergent'], inferred: ['Contact dermatitis'],
        observation: 'Visible redness across both forearms in the uploaded photo, with mild scratch marks. Patient was calm and in no distress.',
        rec: { type: 'prescription', title: 'Contact dermatitis care', items: [ { name: 'Hydrocortisone 1% cream', dosage: 'Thin layer', timing: 'Twice daily, up to 7 days', notes: 'Apply to affected areas only.', why: 'A mild topical steroid calms the inflamed skin.', detail: 'Thin layer twice daily for up to 7 days.' }, { name: 'Avoid new detergent', dosage: '', timing: 'Ongoing', notes: 'Switch to fragrance-free; wash affected clothing.', why: 'Removing the trigger is the main treatment.', detail: 'Switch to fragrance-free; wash affected clothing.' } ], advice: 'Seek care if rash spreads or blisters form.', urgency: 'routine' } },
    ],
    consults: [
      { id: 'h1', title: 'Seasonal allergy check', date: 'Mar 4, 2026', status: 'Completed', note: 'Advised antihistamine; symptoms resolved within a week.' },
      { id: 'h2', title: 'Lower back pain', date: 'Jan 18, 2026', status: 'Completed', note: 'Recommended stretching routine and posture review.' },
    ],
    prescriptions: [
      { name: 'Cetirizine 10mg', detail: 'Once daily, 14 days', date: 'Mar 4, 2026' },
    ],
    labs: [
      { name: 'Complete Blood Count', date: 'Feb 2, 2026', result: 'Normal', ok: true },
      { name: 'Lipid Profile', date: 'Feb 2, 2026', result: 'Borderline', ok: false },
    ],
  };

  componentDidMount() {
    const tenant = applyTenant();
    const saved = restore();
    const hydrate = { tenantName: tenant.name };
    if (saved) {
      if (Array.isArray(saved.liveQueue) && saved.liveQueue.length) hydrate.queue = [...saved.liveQueue, ...this.state.queue];
      if (Array.isArray(saved.consultsAdd) && saved.consultsAdd.length) hydrate.consults = [...saved.consultsAdd, ...this.state.consults];
      if (Array.isArray(saved.rxAdd) && saved.rxAdd.length) hydrate.prescriptions = [...saved.rxAdd, ...this.state.prescriptions];
    }
    this.setState(hydrate);
    this._t = setInterval(() => {
      if (this.state.screen === 'consult' && this.state.started) {
        this.setState(s => ({ seconds: s.seconds + 1 }));
        // Abandonment: no patient turn for 30 minutes auto-closes the consult
        if (this.state.lastTurn && Date.now() - this.state.lastTurn > 30 * 60 * 1000) this.abandonConsult();
      }
      this.checkSla();
    }, 1000);
  }
  componentWillUnmount() { clearInterval(this._t); this.stopVoice(); }

  componentDidUpdate(pp, ps) {
    if (!ps || !this.state) return;
    // speak the review line when it flips to approved while patient is on the rec screen
    if (ps.reviewStatus !== 'approved' && this.state.reviewStatus === 'approved' && this.state.view === 'patient' && this.state.screen === 'recommendation') {
      this.speakRec('approved');
    }
    if (ps.reviewStatus !== 'rejected' && this.state.reviewStatus === 'rejected' && this.state.view === 'patient' && this.state.screen === 'recommendation') {
      this.speakRec('rejected');
    }
    // persist user-owned records (live cases, history additions) for reload
    if (this.state.queue !== ps.queue) persist({ liveQueue: this.state.queue.filter(c => c.mine) });
    if (this.state.consults !== ps.consults) persist({ consultsAdd: this.state.consults.filter(c => c.user) });
    if (this.state.prescriptions !== ps.prescriptions) persist({ rxAdd: this.state.prescriptions.filter(p => p.user) });
  }

  speakRec(status) {
    const rec = this.state.recommendation;
    const kind = rec && rec.type === 'prescription' ? 'prescription' : 'plan';
    const line = status === 'approved'
      ? `Dr. Whitfield has reviewed your ${kind}. Here it is.`
      : status === 'rejected'
        ? `Dr. Whitfield has reviewed your ${kind} and feels you need to be seen in person. ${this.state.rejectReason || ''}`
        : `Thanks, Alex. I've prepared your ${kind} and sent it to Dr. Whitfield for a quick review.`;
    this.speak(line);
  }

  // ---- voice ----
  speak(text, cb) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(window.speechSynthesis.getVoices());
      if (v) u.voice = v;
      u.rate = 0.98; u.pitch = 1.05;
      this._utter = u;
      this.setState({ status: 'speaking' });
      u.onend = () => { if (this._utter === u && cb) cb(); };
      u.onerror = () => { if (this._utter === u && cb) cb(); };
      window.speechSynthesis.speak(u);
    } catch (e) { if (cb) cb(); }
  }
  // Real mic-driven level meter for the waveform (graceful fallback if denied)
  async startMeter() {
    if (this._meterOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._stream = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._audio = new Ctx();
      const src = this._audio.createMediaStreamSource(stream);
      const an = this._audio.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      this._analyser = an;
      this._buf = new Uint8Array(an.frequencyBinCount);
      this._meterOn = true;
      const loop = () => {
        if (!this._meterOn) return;
        an.getByteFrequencyData(this._buf);
        let sum = 0; for (let i = 0; i < this._buf.length; i++) sum += this._buf[i];
        const lvl = Math.min(1, (sum / this._buf.length) / 90);
        if (this.state.status === 'listening') this.setState({ level: lvl });
        this._raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { /* mic denied — waveform falls back to animated bars */ }
  }
  stopMeter() {
    this._meterOn = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    try { if (this._stream) this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (this._audio) this._audio.close(); } catch (e) {}
    this._stream = null; this._audio = null; this._analyser = null;
  }
  startListening() {
    if (this.state.muted || this.state.screen !== 'consult') { this.setState({ status: 'idle' }); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.setState({ status: 'idle', showType: true }); return; }
    try {
      this.stopRec();
      const r = new SR();
      this._rec = r;
      r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
      r.onresult = (ev) => { const t = ev.results[0][0].transcript; this.handleUser(t); };
      r.onerror = (ev) => {
        if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')) {
          this.setState({ status: 'idle', showType: true });
        } else if (this.state.status === 'listening') { this.setState({ status: 'idle' }); }
      };
      r.onend = () => { if (this.state.status === 'listening') this.setState({ status: 'idle' }); };
      this.setState({ status: 'listening', micError: false });
      this.startMeter();
      r.start();
    } catch (e) { this.setState({ status: 'idle' }); }
  }
  stopRec() { try { if (this._rec) { this._rec.onend = null; this._rec.onresult = null; this._rec.abort(); this._rec = null; } } catch (e) {} }
  stopVoice() { this._utter = null; this.stopRec(); this.stopMeter(); try { window.speechSynthesis.cancel(); } catch (e) {} }
  toggleMute() {
    this.setState(s => ({ muted: !s.muted }), () => {
      if (this.state.muted) { this.stopRec(); this.stopMeter(); if (this.state.status === 'listening') this.setState({ status: 'idle' }); }
      else if (this.state.status === 'idle') this.startListening();
    });
  }
  // Tap the orb: barge-in while she's speaking, or push-to-talk when idle
  orbTap() {
    const st = this.state.status;
    if (st === 'speaking') { this._utter = null; try { window.speechSynthesis.cancel(); } catch (e) {} this.startListening(); }
    else if (st === 'idle') { if (this.state.muted) this.setState({ muted: false }); this.startListening(); }
    else if (st === 'listening') { this.stopRec(); this.setState({ status: 'idle' }); }
  }

  parse(raw) {
    if (!raw) return { reply: '', done: false };
    let t = String(raw).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) { return { reply: String(raw), done: false }; }
  }

  startConsult() {
    // One open consult per patient: a case awaiting review resumes instead of forking
    const open = this.state.queue.find(c => c.mine && (c.status === 'pending_review' || c.status === 'pending'));
    if (open) {
      this.setState({ screen: 'recommendation', liveCaseId: open.id, recommendation: open.rec, reviewStatus: 'pending',
        aiConfidence: open.confidence || 'high', aiFlags: open.flags || [] });
      return;
    }
    // Unfinished live consult resumes; a finished one starts fresh
    if (this.state.started && this.state.messages.length && !this.state.recommendation) { this.setState({ screen: 'consult' }); return; }
    const greeting = "Hi Alex, I'm Dr. Mira, your AI doctor. Everything here is private, and a licensed doctor reviews my advice before it reaches you. So — how are you feeling today?";
    this.setState({
      started: true, screen: 'consult', seconds: 0, lastTurn: Date.now(), currentLine: greeting, micError: false,
      messages: [{ role: 'doctor', text: greeting }],
      recommendation: null, reviewStatus: 'idle', rejectReason: '', liveCaseId: null,
    }, () => this.speak(greeting, () => this.startListening()));
  }

  trunc(t, n) { return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }

  async handleUser(text) {
    text = (text || '').trim();
    if (!text || this.state.thinking) return;
    this.stopRec();
    const msgs = [...this.state.messages, { role: 'user', text }];
    this.setState({ messages: msgs, input: '', thinking: true, status: 'thinking', lastTurn: Date.now() });
    try {
      const api = msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const raw = await aiComplete({ system: SYS, messages: api, max_tokens: 800 });
      const data = this.parse(raw);
      const reply = data.reply || 'Let me think about that for a moment.';
      const newNotes = [...this.state.notes,
        { who: 'You', t: data.note || this.trunc(text, 48) },
        { who: 'Dr. Mira', t: this.trunc(reply, 64) }];
      const done = data.done && data.recommendation;
      this.setState({ messages: [...msgs, { role: 'doctor', text: reply }], thinking: false, currentLine: reply, notes: newNotes,
        aiConfidence: data.confidence || this.state.aiConfidence, aiFlags: Array.isArray(data.flags) ? data.flags : this.state.aiFlags });
      this.stopMeter();
      this.speak(reply, () => {
        if (done) this.finishConsult(data.recommendation);
        else this.startListening();
      });
    } catch (e) {
      const err = 'Sorry, I had trouble hearing that — could you tell me again?';
      this.setState({ messages: msgs, thinking: false, currentLine: err, status: 'idle' });
      this.speak(err, () => this.startListening());
    }
  }

  fillChip(text) { this.handleUser(text); }
  send() { this.handleUser(this.state.input); }
  attachPhoto() {
    try {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) this.setState({ photoAttached: true, photoName: f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name }); };
      inp.click();
    } catch (e) {}
  }

  abandonConsult() {
    this.stopVoice();
    const rec = { id: 'ab-' + Date.now(), title: 'Unfinished consult', date: 'Today', status: 'Abandoned',
      note: 'No response for 30 minutes — closed automatically. You can start a fresh consult anytime.', user: true };
    this.setState(s => ({ screen: 'home', started: false, messages: [], notes: [], currentLine: '', status: 'idle',
      seconds: 0, lastTurn: 0, notesExpanded: false, showType: false, muted: false, consults: [rec, ...s.consults] }));
  }

  // Review SLA: nudge past 2h in review, expire past 24h (per-hospital config in a real deploy)
  checkSla() {
    const H = 3600 * 1000, now = Date.now();
    let touched = false, review = null, notify = false;
    const queue = this.state.queue.map(c => {
      if (!c.mine || !c.submittedAt) return c;
      const age = now - c.submittedAt;
      if ((c.status === 'pending_review' || c.status === 'pending') && age > 24 * H) {
        touched = true;
        if (c.id === this.state.liveCaseId) review = { reviewStatus: 'expired' };
        return { ...c, status: 'expired' };
      }
      if ((c.status === 'pending_review' || c.status === 'pending') && age > 2 * H && !c.slaNudged) {
        touched = true; notify = true;
        return { ...c, slaNudged: true };
      }
      return c;
    });
    if (!touched && !review && !notify) return;
    this.setState(s => ({
      ...(touched ? { queue } : {}),
      ...(review ? review : {}),
      ...(notify ? { notifications: [{ t: 'Review SLA — case waiting over 2h', d: 'A patient consult needs review', kind: 'case' }, ...s.notifications] } : {}),
    }));
  }

  finishConsult(rec) {
    const id = 'live-' + Date.now();
    const symptoms = this.state.messages.filter(m => m.role === 'user').slice(0, 3).map(m => ({ v: m.text.length > 26 ? m.text.slice(0, 24) + '…' : m.text }));
    const stated = this.state.notes.filter(n => n.who === 'You').map(n => n.t);
    const liveCase = {
      id, mine: true, submittedAt: Date.now(),
      patient: 'Alex Kumar', demo: '34 · Male · O+', title: rec.title, meta: 'Just now · live', status: 'pending_review',
      summary: 'Live consult with Dr. Mira (AI). ' + (rec.summary || ''), symptoms,
      history: 'Mild asthma. Allergic to Penicillin. Blood group O+.', rec,
      confidence: this.state.aiConfidence || 'high',
      flags: (this.state.aiFlags && this.state.aiFlags.length) ? this.state.aiFlags : ['Penicillin allergy respected'],
      stated: stated.length ? stated : symptoms.map(s => s.v),
      inferred: [rec.title],
      observation: 'The patient sounded tired and slightly hoarse while speaking, and paused to gather their words. No acute distress noted during the call.',
      relevantLabs: this.state.labs.map(l => ({ ...l })),
      pastLabs: this.state.labs.map(l => ({ ...l })),
      pastConsults: this.state.consults.map(c => ({ title: c.title, date: c.date, note: c.note })),
    };
    this.stopVoice();
    this.setState(s => ({
      recommendation: rec, reviewStatus: 'pending', liveCaseId: id, screen: 'recommendation', status: 'idle',
      queue: [liveCase, ...s.queue],
    }), () => setTimeout(() => this.speakRec('pending'), 400));
  }

  // ---- Doctor-desk voice review (Dr. Mira talks to the real doctor) ----
  ttsDoc(text, cb) {
    if (this.state.docMuted) { this.setState({ docLine: text, docStatus: 'idle' }); if (cb) cb(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(window.speechSynthesis.getVoices());
      if (v) u.voice = v;
      u.rate = 0.98; u.pitch = 1.05;
      this._docUtter = u;
      this.setState({ docLine: text, docStatus: 'speaking' });
      u.onend = () => { if (this._docUtter === u) { this.setState({ docStatus: 'idle' }); if (cb) cb(); } };
      u.onerror = () => { if (this._docUtter === u) { this.setState({ docStatus: 'idle' }); if (cb) cb(); } };
      window.speechSynthesis.speak(u);
    } catch (e) { if (cb) cb(); }
  }
  docListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.setState({ docStatus: 'idle' }); return; }
    try {
      this.stopDocRec();
      const r = new SR();
      this._docRec = r;
      r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
      r.onresult = (ev) => this.handleDocCommand(ev.results[0][0].transcript);
      r.onerror = () => { if (this.state.docStatus === 'listening') this.setState({ docStatus: 'idle' }); };
      r.onend = () => { if (this.state.docStatus === 'listening') this.setState({ docStatus: 'idle' }); };
      this.setState({ docStatus: 'listening' });
      r.start();
    } catch (e) { this.setState({ docStatus: 'idle' }); }
  }
  stopDocRec() { try { if (this._docRec) { this._docRec.onend = null; this._docRec.onresult = null; this._docRec.abort(); this._docRec = null; } } catch (e) {} }
  stopDocReview() { this._docUtter = null; this.stopDocRec(); try { window.speechSynthesis.cancel(); } catch (e) {} this.setState({ docReview: false, docStatus: 'idle' }); }
  docOrbTap() {
    const st = this.state.docStatus;
    if (st === 'speaking') { this._docUtter = null; try { window.speechSynthesis.cancel(); } catch (e) {} this.setState({ docStatus: 'idle' }); this.docListen(); }
    else if (st === 'idle') { if (this.state.docReview) this.docListen(); else this.startDocReview(); }
    else if (st === 'listening') { this.stopDocRec(); this.setState({ docStatus: 'idle' }); }
  }
  startDocReview() {
    const ac = this.state.queue.find(c => c.id === this.state.activeCaseId);
    if (!ac) return;
    const r = ac.rec;
    const parts = (r.items || []).map(i => i.name + (i.dosage ? ' ' + i.dosage : '')).join(', ');
    const summary = `Hi doctor. Quick summary for ${ac.patient.split(' ')[0]}: ${ac.summary} My assessment is ${(ac.inferred && ac.inferred[0]) || r.title}, and I'm recommending ${parts}. Would you like to change anything — the tests, the prescription, or the advice — or shall I send it to the patient?`;
    this.setState({ docReview: true, docNotes: [{ who: 'Dr. Mira', t: summary }] });
    this.ttsDoc(summary, () => this.docListen());
  }
  async handleDocCommand(text, typed) {
    this.stopDocRec();
    this.setState(s => ({ docStatus: 'thinking', docNotes: [...s.docNotes, { who: 'Dr. Whitfield', t: text }] }));
    const ac = this.state.queue.find(c => c.id === this.state.activeCaseId);
    const sys = `You are Dr. Mira, an AI clinician speaking ALOUD with a licensed human doctor who is reviewing your recommendation for patient ${ac.patient}. Speak warmly and concisely, like a trusted colleague.
Current recommendation JSON: ${JSON.stringify(ac.rec)}.
The doctor just spoke. Decide:
- If they approve/confirm/say it looks good → action "approve". reply MUST be exactly: "Thank you, I'll notify the patient right away."
- If they ask for a change (add/remove/replace a test, drug, dosage, timing, or advice) → action "edit". Apply it and return the FULL updated recommendation (same JSON shape, keep untouched fields), then briefly confirm what you changed and ask if there's anything else.
- Otherwise → action "none". Answer briefly, then ask if they'd like any changes.
Keep item fields: name, dosage, timing, notes, why, detail. Respond ONLY with JSON, no prose, no code fences:
{"reply": string, "action": "approve"|"edit"|"none", "recommendation": <recommendation JSON> | null}`;
    try {
      const raw = await aiComplete({ system: sys, messages: [{ role: 'user', content: text }], max_tokens: 800 });
      const data = this.parse(raw);
      const reply = data.reply || (data.action === 'approve' ? "Thank you, I'll notify the patient right away." : 'Done. Anything else?');
      this.setState(s => ({ docNotes: [...s.docNotes, { who: 'Dr. Mira', t: reply }] }));
      if (data.action === 'approve') {
        this.approveCase();
        this.ttsDoc(reply, () => {});
        return;
      }
      if (data.action === 'edit' && data.recommendation) {
        this.setState(s => ({ queue: s.queue.map(c => c.id === s.activeCaseId
          ? { ...c, rec: data.recommendation, title: data.recommendation.title || c.title, editedBy: 'Dr. Whitfield', editedAt: Date.now() } : c) }));
      }
      this.ttsDoc(reply, typed ? () => {} : () => this.docListen());
    } catch (e) {
      this.ttsDoc('Sorry, could you say that again?', typed ? () => {} : () => this.docListen());
    }
  }

  fillDoc(text) { this.setState({ docInput: text }); setTimeout(() => { try { this._docInputRef && this._docInputRef.current && this._docInputRef.current.focus(); } catch (e) {} }, 0); }
  sendDoc() { const t = (this.state.docInput || '').trim(); if (!t) return; this.setState({ docInput: '' }); this.handleDocCommand(t, true); }
  docApproveChip() { const msg = "Thank you, I'll notify the patient right away."; this.setState(s => ({ docNotes: [...s.docNotes, { who: 'Dr. Mira', t: msg }] })); this.approveCase(); this.ttsDoc(msg, () => {}); }

  toggleDocMute() {
    this.setState(s => ({ docMuted: !s.docMuted }), () => {
      if (this.state.docMuted) { this._docUtter = null; this.stopDocRec(); try { window.speechSynthesis.cancel(); } catch (e) {} if (this.state.docStatus !== 'thinking') this.setState({ docStatus: 'idle' }); }
    });
  }

  approveCase() {
    const id = this.state.activeCaseId, now = Date.now();
    this.setState(s => {
      const q = s.queue.map(c => c.id === id ? { ...c, status: 'approved', reviewedBy: 'Dr. Whitfield', reviewedAt: now, decision: 'approved' } : c);
      const c = s.queue.find(x => x.id === id);
      let add = {};
      if (c && c.id === s.liveCaseId) {
        add.reviewStatus = 'approved';
        add.rejectReason = '';
        const rec = c.rec;
        if (rec.type === 'prescription' && rec.items && rec.items[0]) {
          add.prescriptions = [{ name: rec.items[0].name, detail: rec.items[0].detail, date: 'Today', user: true }, ...s.prescriptions];
        }
        add.consults = [{ id: 'live-' + now, title: rec.title, date: 'Today', status: 'Approved', note: rec.advice, user: true }, ...s.consults];
      }
      return { queue: q, ...add };
    });
  }
  editCase() {
    const now = Date.now();
    this.setState(s => ({
      queue: s.queue.map(c => c.id === s.activeCaseId ? { ...c, status: 'changes', reviewedBy: 'Dr. Whitfield', reviewedAt: now, decision: 'changes' } : c),
      ...(s.liveCaseId === s.activeCaseId ? { reviewStatus: 'changes' } : {}),
    }));
  }
  rejectCase() {
    // Rejection is never a dead end: reason + next step travel with the case to the patient
    const reason = window.prompt('Reason for declining (shown to the patient with a next step):',
      'Needs an in-person examination — please show this consult at the hospital front desk.');
    if (reason === null) return;
    const now = Date.now();
    this.setState(s => ({
      queue: s.queue.map(c => c.id === s.activeCaseId
        ? { ...c, status: 'rejected', reviewedBy: 'Dr. Whitfield', reviewedAt: now, decision: 'rejected', rejectReason: reason } : c),
      ...(s.liveCaseId === s.activeCaseId ? { reviewStatus: 'rejected', rejectReason: reason } : {}),
    }));
  }

  fmtTime(s) { const m = Math.floor(s / 60), ss = s % 60; return m + ':' + String(ss).padStart(2, '0'); }

  qStatusStyle(st) {
    const map = {
      pending: '#FFE9A8|#6B4E00', pending_review: '#FFE9A8|#6B4E00', approved: '#BFEBD5|#0E5A38',
      changes: '#CFE0FF|#1D3E86', rejected: '#FBD2DA|#8E2440', expired: '#E5E7EB|#4B5563',
    };
    const [bg, fg] = (map[st] || map.pending).split('|');
    return `font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:${bg};color:${fg}`;
  }
  qStatusLabel(st) { return ({ pending: 'Pending', pending_review: 'Pending review', approved: 'Approved', changes: 'Changes', rejected: 'Declined', expired: 'Expired' })[st] || st; }

  // Score a summary point's clinical severity, then sort high → low
  rankBySeverity(points) {
    const sev = (t) => {
      const s = t.toLowerCase();
      if (/red[- ]?flag|urgent|severe|blood|breathless|chest pain|imaging advised|>2 week|more than two week|weeks/.test(s)) {
        return /no red[- ]?flag|no red flag/.test(s) ? 1 : 3; // "no red-flags" is reassuring → low
      }
      if (/chest|tightness|pain|fever|night|worse/.test(s)) return 2;
      return 1;
    };
    const meta = { 3: { label: 'High', color: 'oklch(0.62 0.2 25)', bg: 'oklch(0.62 0.2 25 / .12)', tc: 'oklch(0.5 0.19 25)' },
                   2: { label: 'Moderate', color: 'oklch(0.72 0.16 65)', bg: 'oklch(0.8 0.14 70 / .25)', tc: 'oklch(0.5 0.13 60)' },
                   1: { label: 'Low', color: '#9AA7C0', bg: '#EEF1F7', tc: '#7A879E' } };
    return points
      .map(v => ({ v, s: sev(v) }))
      .sort((a, b) => b.s - a.s)
      .map(({ v, s }) => ({
        v,
        dotStyle: `width:7px;height:7px;border-radius:50%;background:${meta[s].color};margin-top:5px;flex:none`,
        sevLabel: meta[s].label,
        sevStyle: `font-size:9px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:2px 7px;border-radius:99px;flex:none;background:${meta[s].bg};color:${meta[s].tc}`,
      }));
  }

  renderVals() {
    const s = this.state;
    const tabOn = 'padding:8px 18px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;background:#243247;color:#fff;transition:.15s';
    const tabOff = 'padding:8px 18px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;background:transparent;color:#6B7A92;transition:.15s';

    // voice consult vals
    const statusMap = { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Dr. Mira is speaking…', idle: s.muted ? 'Mic off — tap the orb to talk' : 'Tap the orb to talk' };
    const consultStatus = s.thinking ? 'Thinking…' : (statusMap[s.status] || 'Tap the orb to talk');
    const keyBase = 'cursor:pointer;width:74px;border-radius:17px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 0;transition:.15s;';
    const notes = s.notes.map(n => ({
      ...n,
      whoStyle: `flex:none;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:99px;background:${n.who === 'You' ? 'oklch(0.62 0.2 290 / .5)' : 'oklch(0.7 0.14 200 / .45)'};color:#fff`,
    }));
    // distinct orb motion + ring colour per voice state
    const orbAnimMap = { listening: 'vd-listen 1.4s ease-in-out infinite', thinking: 'vd-think 1.6s ease-in-out infinite', speaking: 'vd-speak 1s ease-in-out infinite', idle: 'vd-pulse 3.6s ease-in-out infinite' };
    const orbAnim = orbAnimMap[s.thinking ? 'thinking' : s.status] || orbAnimMap.idle;
    const ringColorMap = { listening: 'oklch(0.8 0.14 200)', thinking: 'oklch(0.82 0.15 90)', speaking: 'oklch(0.72 0.2 300)', idle: 'rgba(255,255,255,.5)' };
    const ringColor = ringColorMap[s.thinking ? 'thinking' : s.status] || ringColorMap.idle;
    // waveform: live from mic level while listening, else gentle idle bars
    const waveLive = s.status === 'listening';
    const seeds = [0.5, 0.85, 1, 0.7, 0.4];
    const waveBars = seeds.map((sd, i) => {
      const h = waveLive ? Math.max(4, Math.min(16, 4 + s.level * 22 * sd + (Math.random() * 3))) : 0;
      return { barStyle: waveLive
        ? `width:3px;height:${h}px;border-radius:2px;background:oklch(${0.55 + i * 0.04} 0.18 ${250 + i * 15});transition:height .08s linear`
        : `width:3px;height:14px;border-radius:2px;background:oklch(${0.55 + i * 0.04} 0.18 ${250 + i * 15});animation:vd-bar 1s ease-in-out ${i * 0.15}s infinite` };
    });

    // recommendation view
    const rec = s.recommendation;
    let recVals = null;
    if (rec) {
      const isRx = rec.type === 'prescription';
      const uMap = { routine: 'oklch(0.72 0.13 160)|#062018|Routine', soon: 'oklch(0.8 0.15 85)|#332600|Follow up soon', urgent: 'oklch(0.65 0.19 25)|#fff|Urgent' };
      const [ubg, ufg, ul] = (uMap[rec.urgency] || uMap.routine).split('|');
      recVals = {
        typeLabel: isRx ? 'Prescription' : 'Investigation',
        badgeStyle: `font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:5px 11px;border-radius:99px;background:${isRx ? 'oklch(0.62 0.2 300 / .14)' : 'oklch(0.6 0.14 200 / .16)'};color:${isRx ? 'oklch(0.5 0.2 300)' : 'oklch(0.45 0.14 220)'}`,
        urgencyLabel: ul, urgencyStyle: `font-size:11px;font-weight:700;padding:5px 11px;border-radius:99px;background:${ubg};color:${ufg}`,
        title: rec.title, advice: rec.advice || '', hasAdvice: !!(rec.advice && rec.advice.trim()),
        items: (rec.items || []).map(it => ({
          name: it.name,
          dosage: it.dosage || '', hasDosage: !!(it.dosage && it.dosage.trim()),
          timing: it.timing || it.detail || '', hasTiming: !!((it.timing || it.detail || '').trim()),
          notes: it.notes || '', hasNotes: !!(it.notes && it.notes.trim()),
          why: it.why || '', hasWhy: !!(it.why && it.why.trim()),
        })),
      };
    }
    // patient-facing "what happens next" timeline
    const approved = s.reviewStatus === 'approved';
    const isRxRec = rec && rec.type === 'prescription';
    const timeline = [
      { t: 'Consult complete', d: 'Dr. Mira prepared your plan', state: 'done' },
      { t: approved ? 'Reviewed by Dr. Whitfield' : 'Doctor review', d: approved ? 'Approved just now' : 'A licensed doctor is checking your plan', state: approved ? 'done' : 'active' },
      { t: 'Plan ready', d: approved ? 'Saved to your records' : 'You’ll be notified when it’s confirmed', state: approved ? 'done' : 'todo' },
      isRxRec
        ? { t: 'Collect medicine', d: approved ? (s.orderPlaced ? 'Order placed' : 'Order for delivery or pickup') : 'Available once approved', state: approved ? (s.orderPlaced ? 'done' : 'active') : 'todo' }
        : { t: 'Book your test', d: approved ? 'Choose a lab and time' : 'Available once approved', state: approved ? 'active' : 'todo' },
    ].map(step => {
      const c = step.state === 'done' ? 'oklch(0.72 0.15 160)' : step.state === 'active' ? 'oklch(0.78 0.16 90)' : 'rgba(255,255,255,.4)';
      return { ...step, dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;margin-top:3px;background:${c};box-shadow:0 0 8px ${c}`,
        titleStyle: `font-size:13.5px;font-weight:700;color:${step.state === 'todo' ? 'rgba(255,255,255,.6)' : '#fff'}` };
    });

    // status banner on recommendation screen
    const stMap = {
      pending: 'oklch(0.8 0.15 85)|Awaiting doctor review|A licensed doctor is reviewing Dr. Mira’s plan. You’ll be notified shortly.',
      approved: 'oklch(0.72 0.15 160)|Approved by Dr. Whitfield|Your plan is confirmed and saved to your records.',
      changes: 'oklch(0.62 0.2 290)|Doctor is adjusting your plan|Dr. Whitfield requested changes — you’ll be notified of the final version.',
      rejected: 'oklch(0.65 0.19 25)|Not approved — please visit in person|' + ('Dr. Whitfield: ' + (s.rejectReason || 'This needs an in-person examination.')),
      expired: 'oklch(0.6 0.05 250)|Review window passed|No doctor picked this up in time — please start a fresh consult or visit in person.',
    };
    const [stDot, stTitle, stSub] = (stMap[s.reviewStatus] || stMap.pending).split('|');

    // doctor desk — urgent cases first, then oldest wait
    const pendingCount = s.queue.filter(c => c.status === 'pending' || c.status === 'pending_review').length;
    const urgRank = c => (c.rec && c.rec.urgency === 'urgent' ? 0 : 1);
    const queue = [...s.queue].sort((a, b) => urgRank(a) - urgRank(b) || ((a.submittedAt || 0) - (b.submittedAt || 0))).map(c => ({
      patient: c.patient, title: c.title, meta: c.meta,
      statusLabel: this.qStatusLabel(c.status), statusStyle: this.qStatusStyle(c.status),
      cardStyle: `cursor:pointer;padding:13px 14px;border-radius:14px;margin-bottom:9px;border:1.5px solid ${c.id === s.activeCaseId ? 'oklch(0.6 0.2 290 / .7)' : 'transparent'};background:${c.id === s.activeCaseId ? '#fff' : 'rgba(255,255,255,.6)'};box-shadow:${c.id === s.activeCaseId ? '0 10px 24px rgba(12,20,60,.28)' : '0 3px 10px rgba(12,20,60,.14)'};transition:.15s`,
      onClick: () => { this.stopDocReview(); this.setState({ activeCaseId: c.id }); },
    }));
    const ac = s.queue.find(c => c.id === s.activeCaseId) || s.queue[0];
    const acRx = ac.rec.type === 'prescription';
    const acStatusMap = {
      pending: '#FFE9A8|#6B4E00|Pending review', pending_review: '#FFE9A8|#6B4E00|Pending review', approved: '#BFEBD5|#0E5A38|Approved',
      changes: '#CFE0FF|#1D3E86|Changes requested', rejected: '#FBD2DA|#8E2440|Declined', expired: '#E5E7EB|#4B5563|Expired',
    };
    const labTag = l => `font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:99px;flex:none;background:${l.ok ? 'oklch(0.72 0.13 160 / .16)' : 'oklch(0.8 0.14 70 / .25)'};color:${l.ok ? 'oklch(0.42 0.13 160)' : 'oklch(0.45 0.14 60)'}`;
    const [acbg, acfg, acl] = (acStatusMap[ac.status] || acStatusMap.pending).split('|');
    const active = {
      patient: ac.patient, demo: ac.demo, summary: ac.summary, history: ac.history,
      symptoms: ac.symptoms.map(x => typeof x === 'string' ? { v: x } : x), recTitle: ac.rec.title, recItems: ac.rec.items, advice: ac.rec.advice, hasAdvice: !!(ac.rec.advice && ac.rec.advice.trim()),
      headerLabel: 'AI consultation',
      summaryPoints: this.rankBySeverity([
        ...(ac.stated || ac.symptoms || []).map(x => (typeof x === 'string' ? x : x.v)),
        ...(ac.flags || []).map(f => f),
      ]),
      evaluation: (ac.inferred || []).map(x => x).join('; ') || (ac.rec && ac.rec.title) || '',
      observation: ac.observation || 'No additional observations recorded during the consultation.',
      tests: (ac.rec.items || []).filter(it => !(it.dosage && it.dosage.trim())),
      rx: (ac.rec.items || []).filter(it => !!(it.dosage && it.dosage.trim())),
      hasTests: (ac.rec.items || []).some(it => !(it.dosage && it.dosage.trim())),
      hasRx: (ac.rec.items || []).some(it => !!(it.dosage && it.dosage.trim())),
      recType: acRx ? 'Prescription' : 'Investigation',
      testHistory: (() => {
        const seen = {}, out = [];
        [...(ac.relevantLabs || []), ...(ac.pastLabs || [])].forEach(l => {
          const k = (l.name + '|' + l.date).toLowerCase();
          if (!seen[k]) { seen[k] = 1; out.push({ ...l, tagStyle: labTag(l) }); }
        });
        return out;
      })(),
      pastConsults: ac.pastConsults || [],
      statusLabel: acl, statusStyle: `font-size:12px;font-weight:700;padding:6px 13px;border-radius:99px;background:${acbg};color:${acfg}`,
      actionable: ac.status === 'pending' || ac.status === 'pending_review', approved: ac.status === 'approved',
      confLabel: 'Confidence: ' + ((ac.confidence || 'high').charAt(0).toUpperCase() + (ac.confidence || 'high').slice(1)),
      confStyle: (() => { const c = ac.confidence || 'high'; const m = { high: '#BFEBD5|#0E5A38', medium: '#FFE9A8|#6B4E00', low: '#FBD2DA|#8E2440' }; const [b, f] = (m[c] || m.high).split('|'); return `font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;background:${b};color:${f}`; })(),
      lowConf: (ac.confidence || 'high') === 'low',
    };

    // profile tags
    const consults = s.consults.map(c => ({ ...c, tagStyle: `font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:${c.status === 'Approved' ? 'oklch(0.72 0.13 160 / .16)' : '#EEF3FB'};color:${c.status === 'Approved' ? 'oklch(0.45 0.13 160)' : '#6B7A92'}` }));
    const labs = s.labs.map(l => ({ ...l, tagStyle: `font-size:12px;font-weight:700;padding:5px 11px;border-radius:99px;background:${l.ok ? 'oklch(0.72 0.13 160 / .16)' : 'oklch(0.8 0.14 70 / .2)'};color:${l.ok ? 'oklch(0.45 0.13 160)' : 'oklch(0.5 0.14 60)'}` }));

    return {
      isPatient: s.view === 'patient', isDoctor: s.view === 'doctor',
      viewPatient: () => { this.stopDocReview(); this.setState({ view: 'patient' }); },
      viewDoctor: () => this.setState({ view: 'doctor' }),
      patientTabStyle: s.view === 'patient' ? tabOn : tabOff,
      doctorTabStyle: s.view === 'doctor' ? tabOn : tabOff,

      isLogin: s.screen === 'login', isHome: s.screen === 'home', isConsult: s.screen === 'consult', isRec: s.screen === 'recommendation', isProfile: s.screen === 'profile',
      hospitalName: s.tenantName || 'Virtual Doctor',
      adultOk: s.adultOk, loginErr: s.loginErr,
      toggleAdult: () => this.setState(s => ({ adultOk: !s.adultOk, loginErr: '' })),
      loginGoogle: () => {
        if (!this.state.adultOk) { this.setState({ loginErr: 'This service is for adults (18+). Please confirm to continue.' }); return; }
        this.setState({ screen: 'home', loginErr: '' });
      },
      startBtn: () => this.startConsult(),
      goProfile: () => this.setState({ screen: 'profile' }),
      goConsult: () => this.startConsult(),
      backToConsult: () => this.setState({ screen: 'consult' }),

      input: s.input,
      onInput: (e) => this.setState({ input: e.target.value }),
      onKey: (e) => { if (e.key === 'Enter') this.send(); },
      send: () => this.send(),
      endVisit: () => {
        this.stopVoice();
        this.setState(s => {
          // Ending mid-consult closes it as abandoned and records it — never a silent drop
          const cut = s.started && s.messages.length > 1 && !s.recommendation;
          return { screen: 'home', started: false, messages: [], notes: [], currentLine: '', status: 'idle', seconds: 0, lastTurn: 0,
            notesExpanded: false, showType: false, muted: false,
            consults: cut ? [{ id: 'ab-' + Date.now(), title: 'Unfinished consult', date: 'Today', status: 'Abandoned',
              note: 'Ended before a plan was prepared. Start a fresh consult anytime.', user: true }, ...s.consults] : s.consults };
        });
      },
      statusLabel: consultStatus,
      orbTap: () => this.orbTap(),
      orbAnimStyle: 'position:relative;width:138px;height:138px;font-size:138px;border-radius:50%;overflow:hidden;background:#F4FAFF;box-shadow:0 24px 48px oklch(0.35 0.15 270 / .55),0 0 38px oklch(0.7 0.15 260 / .4),inset 0 0 0 1px rgba(255,255,255,.85);cursor:pointer;animation:' + orbAnim,
      ringColorA: `position:absolute;inset:0 0 10px 0;border-radius:50%;border:1.5px solid ${ringColor};animation:vd-ring 2.8s ease-out infinite`,
      ringColorB: `position:absolute;inset:0 0 10px 0;border-radius:50%;border:1.5px solid ${ringColor};opacity:.6;animation:vd-ring 2.8s ease-out 1s infinite`,
      waveBars,
      attachPhoto: () => this.attachPhoto(),
      photoAttached: s.photoAttached, photoName: s.photoName,
      hasNotes: notes.length > 0,
      notes,
      toggleNotes: () => this.setState(st => ({ notesExpanded: !st.notesExpanded })),
      notesToggleLabel: s.notesExpanded ? '▾ tap to collapse' : '▴ tap to expand',
      notesBodyStyle: `overflow-y:auto;display:flex;flex-direction:column;gap:5px;transition:max-height .25s ease;max-height:${s.notesExpanded ? '300px' : '84px'}`,
      toggleMute: () => this.toggleMute(),
      micLabel: s.muted ? 'Mic off' : 'Mute',
      micKeyStyle: keyBase + (s.muted ? 'background:rgba(255,255,255,.35);opacity:.75;box-shadow:0 2px 6px rgba(12,20,60,.18)' : 'background:rgba(255,255,255,.6);box-shadow:0 4px 10px rgba(12,20,60,.22)'),
      showChips: s.messages.length <= 1 && !s.thinking,
      chips: ['I have a fever', 'Bad headache', 'Stomach pain', 'Skin rash'].map(l => ({ label: l, onClick: () => this.fillChip(l) })),

      rec: recVals || { items: [], badgeStyle: '', urgencyStyle: '', hasAdvice: false },
      recHeadline: rec
        ? (s.reviewStatus === 'approved'
            ? 'Dr. Whitfield reviewed your ' + (rec.type === 'prescription' ? 'prescription' : 'plan') + ' — here it is.'
            : 'Sent to Dr. Whitfield for a quick review.')
        : '',
      showOrder: !!(rec && rec.type === 'prescription' && s.reviewStatus === 'approved'),
      orderLabel: s.orderPlaced ? 'Order placed ✓' : 'Order medicine',
      orderMeds: () => { if (!this.state.orderPlaced) this.setState({ orderPlaced: true }); },
      timeline,
      shareCaregiver: () => this.setState({ sharedCaregiver: true }),
      caregiverLabel: s.sharedCaregiver ? 'Shared with caregiver ✓' : 'Share with a caregiver',
      askFollowUp: () => this.startConsult(),
      statusTitle: stTitle, statusSub: stSub,
      reviewerDotStyle: `position:absolute;bottom:-3px;right:-3px;width:13px;height:13px;border-radius:50%;background:${stDot};border:2px solid #5F7CC4`,

      pendingCount, queue, active,
      notifCount: s.notifications.length,
      notifications: s.notifications.map(n => ({ ...n, dotStyle: `width:9px;height:9px;border-radius:50%;margin-top:5px;flex:none;background:${n.kind === 'case' ? 'oklch(0.62 0.2 290)' : n.kind === 'lab' ? 'oklch(0.72 0.15 200)' : 'oklch(0.75 0.15 160)'}` })),
      toggleNotifs: () => this.setState(st => ({ showNotifs: !st.showNotifs, showDocProfile: false })),
      toggleDocProfile: () => this.setState(st => ({ showDocProfile: !st.showDocProfile, showNotifs: false })),
      showNotifs: s.showNotifs, showDocProfile: s.showDocProfile,
      approveCase: () => this.approveCase(),
      docReview: s.docReview,
      notDocReview: !s.docReview,
      docStatusLabel: ({ idle: s.docReview ? 'Tap the orb to reply' : 'Ready to review', listening: 'Listening to you…', thinking: 'Thinking…', speaking: 'Speaking…' })[s.docStatus] || 'Ready',
      docInput: s.docInput,
      docInputRef: (this._docInputRef || (this._docInputRef = { current: null })),
      onDocInput: (e) => this.setState({ docInput: e.target.value }),
      onDocKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); this.sendDoc(); } },
      sendDoc: () => this.sendDoc(),
      docApprove: () => this.docApproveChip(),
      toggleDocMute: () => this.toggleDocMute(),
      docMicLabel: s.docMuted ? 'Muted' : 'Mute',
      docMicKeyStyle: keyBase + (s.docMuted ? 'background:rgba(255,255,255,.35);opacity:.75;box-shadow:0 2px 6px rgba(12,20,60,.18)' : 'background:rgba(255,255,255,.6);box-shadow:0 4px 10px rgba(12,20,60,.2)'),
      docChips: [
        { label: 'Change prescription', fill: 'Change the prescription — ' },
        { label: 'Add lab test', fill: 'Add a lab test — ' },
        { label: 'Remove lab test', fill: 'Remove the lab test — ' },
        { label: 'Update advice', fill: 'Update the advice — ' },
      ].map(c => ({ label: c.label, onClick: () => this.fillDoc(c.fill) })),
      startDocReview: () => this.startDocReview(),
      stopDocReview: () => this.stopDocReview(),
      docOrbTap: () => this.docOrbTap(),
      docMin: s.docMin,
      notDocMin: !s.docMin,
      toggleDocMin: () => this.setState(st => ({ docMin: !st.docMin })),
      docOrbAnim: 'position:relative;width:108px;height:108px;font-size:138px;border-radius:50%;overflow:hidden;flex:none;background:#F4FAFF;cursor:pointer;box-shadow:0 18px 40px oklch(0.4 0.15 270 / .5),0 0 30px oklch(0.7 0.15 260 / .35),inset 0 0 0 1px rgba(255,255,255,.85);animation:' + ({ listening: 'vd-listen 1.4s ease-in-out infinite', thinking: 'vd-think 1.6s ease-in-out infinite', speaking: 'vd-speak 1s ease-in-out infinite' }[s.docStatus] || 'vd-pulse 3.6s ease-in-out infinite'),
      docRingColor: `position:absolute;inset:0 0 12px 0;border-radius:50%;border:1.5px solid ${s.docStatus === 'listening' ? 'oklch(0.8 0.13 200)' : s.docStatus === 'thinking' ? 'oklch(0.82 0.15 90)' : s.docStatus === 'speaking' ? 'oklch(0.72 0.2 300)' : 'rgba(255,255,255,.5)'};animation:vd-ring 2.8s ease-out infinite`,
      docLiveDot: `width:7px;height:7px;border-radius:50%;flex:none;background:${s.docStatus === 'listening' ? 'oklch(0.7 0.18 25)' : s.docStatus === 'speaking' ? 'oklch(0.7 0.18 300)' : 'oklch(0.75 0.15 160)'};box-shadow:0 0 8px currentColor`,
      docNotes: s.docNotes.map(n => ({ ...n, whoStyle: `flex:none;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:99px;background:${n.who === 'Dr. Mira' ? 'oklch(0.62 0.2 290 / .16);color:#5A3EA6' : 'oklch(0.6 0.14 220 / .16);color:#2C5A86'}` })),
      hasDocNotes: s.docNotes.length > 0,
      approveLabel: s.voiceNote ? 'Approve + voice note' : 'Approve & send',

      consults, labs, prescriptions: s.prescriptions,
    };
  }

  // ---------------- patient screens ----------------

  renderLogin(v) {
    return html`
      <div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:66px 26px 40px;text-align:center">
        <div style="height:38px;flex:none"></div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;min-height:0">
          <${OrbLarge} />
          <div>
            <div style="font-size:30px;font-weight:700;color:#fff;text-shadow:0 2px 16px rgba(20,30,80,.4)">${v.hospitalName}</div>
            <div style="font-size:15px;line-height:1.55;color:rgba(255,255,255,.82);margin-top:12px;max-width:280px">A calm, private doctor’s visit — whenever you need one. Speak naturally, get clear next steps.</div>
          </div>
        </div>
        <div onClick=${v.toggleAdult} style="cursor:pointer;width:100%;border-radius:14px;background:rgba(255,255,255,.16);border:1.5px solid ${v.adultOk ? '#fff' : 'rgba(255,255,255,.4)'};display:flex;align-items:center;gap:10px;padding:12px 14px;font-size:13.5px;font-weight:600;color:#fff">
          <span style="width:20px;height:20px;border-radius:7px;background:${v.adultOk ? '#fff' : 'transparent'};border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;color:#414FA0;flex:none">${v.adultOk ? '✓' : ''}</span>
          <span style="text-align:left">I confirm I am 18 or older</span>
        </div>
        ${v.loginErr && html`<div style="font-size:12.5px;font-weight:600;color:#FFE9A8;margin-top:10px">${v.loginErr}</div>`}
        <div onClick=${v.loginGoogle} style="cursor:pointer;width:100%;height:56px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;gap:11px;font-size:15.5px;font-weight:600;color:#243247;box-shadow:0 10px 26px rgba(12,20,60,.35)">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16z"></path><path fill="#FBBC05" d="M10.3 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.5 10.5l7.8-6.1z"></path><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.8-3.7-13.7-9.9l-7.8 6.1C6.4 42.6 14.6 48 24 48z"></path></svg>
          Continue with Google
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:16px;line-height:1.5">One tap. New here? We create your account automatically.</div>
      </div>`;
  }

  renderHome(v) {
    return html`
      <div style="position:relative;height:100%;display:flex;flex-direction:column;padding:66px 26px 40px">
        <div style="display:flex;justify-content:flex-end;align-items:center">
          <div onClick=${v.goProfile} title="Profile" style="cursor:pointer;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);display:flex;align-items:center;justify-content:center;color:#1E3A5C;font-size:13px;font-weight:700;box-shadow:0 3px 12px rgba(12,20,60,.22)">AK</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center">
          <${OrbLarge} />
          <div>
            <div style="font-size:25px;font-weight:700;color:#fff;text-shadow:0 2px 14px rgba(20,30,80,.4)">Hi Alex 👋</div>
            <div style="font-size:15px;line-height:1.55;color:rgba(255,255,255,.85);margin-top:8px;max-width:270px">Dr. Mira is ready whenever you are. Start a consult and just talk — no forms.</div>
          </div>
        </div>
        <div onClick=${v.startBtn} style="cursor:pointer;width:100%;height:60px;border-radius:18px;background:linear-gradient(180deg,oklch(0.68 0.2 265),oklch(0.56 0.23 300));display:flex;align-items:center;justify-content:center;gap:10px;font-size:17px;font-weight:700;color:#fff;box-shadow:0 12px 30px oklch(0.42 0.2 290 / .55)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" stroke="#fff" stroke-width="2"></rect><path d="M5 11v1a7 7 0 0014 0v-1" stroke="#fff" stroke-width="2" stroke-linecap="round"></path><path d="M12 19v3" stroke="#fff" stroke-width="2" stroke-linecap="round"></path></svg>
          Start consultation
        </div>
        <div onClick=${v.goProfile} style="cursor:pointer;text-align:center;margin-top:14px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.85)">View my records</div>
      </div>`;
  }

  renderConsult(v) {
    return html`
      <div style="position:relative;height:100%;display:flex;flex-direction:column;padding:66px 20px 26px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);border-radius:13px;font-size:12px;font-weight:600;color:#1E3A5C;box-shadow:0 3px 12px rgba(12,20,60,.22)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(0.75 0.16 160);box-shadow:0 0 8px oklch(0.75 0.16 160)"></span>Private · voice not stored</div>
          <div onClick=${v.goProfile} title="Profile" style="cursor:pointer;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);display:flex;align-items:center;justify-content:center;color:#1E3A5C;font-size:13px;font-weight:700;box-shadow:0 3px 12px rgba(12,20,60,.22)">AK</div>
        </div>

        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:14px 0 6px;min-height:0">
          <div style="position:relative;width:152px;height:162px;display:flex;align-items:flex-start;justify-content:center;flex:none">
            <div style="position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);width:116px;height:20px;border-radius:50%;background:radial-gradient(ellipse,rgba(12,20,60,.4),transparent 70%);filter:blur(4px)"></div>
            <div style=${v.ringColorA}></div>
            <div style=${v.ringColorB}></div>
            <div onClick=${v.orbTap} style=${v.orbAnimStyle}>
              <${MiraOrb} />
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.85);text-shadow:0 1px 8px rgba(20,30,80,.4)">Dr. Mira</div>
          <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;background:rgba(255,255,255,.4);backdrop-filter:blur(12px) saturate(160%);border-radius:14px;box-shadow:0 3px 12px rgba(15,30,70,.22)">
            <div style="display:flex;align-items:center;gap:3px;height:16px">
              ${v.waveBars.map(w => html`<span style=${w.barStyle}></span>`)}
            </div>
            <span style="font-size:13px;color:#1E3A5C;font-weight:500">${v.statusLabel}</span>
          </div>
        </div>

        ${v.showChips && html`
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0 10px">
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
              ${v.chips.map(c => html`
                <div onClick=${c.onClick} style="cursor:pointer;padding:9px 14px;background:rgba(255,255,255,.85);border-radius:99px;font-size:13px;font-weight:600;color:#3A4E6E;box-shadow:0 3px 10px rgba(12,20,60,.16)">${c.label}</div>`)}
            </div>
          </div>`}

        ${v.hasNotes && html`
          <div style="flex:none;background:rgba(255,255,255,.22);backdrop-filter:blur(14px) saturate(160%);border-radius:16px;padding:6px 14px 10px;box-shadow:0 6px 18px rgba(12,20,60,.2)">
            <div onClick=${v.toggleNotes} style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;padding:2px 0 6px">
              <div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,.55)"></div>
              <div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.8)">Consult notes</span><span style="font-size:10px;color:rgba(255,255,255,.65)">${v.notesToggleLabel}</span></div>
            </div>
            <div class="vd-scroll" style=${v.notesBodyStyle}>
              ${v.notes.map(n => html`
                <div style="display:flex;gap:8px;align-items:baseline;animation:vd-fade .3s ease both"><div style=${n.whoStyle}>${n.who}</div><div style="font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.92)">${n.t}</div></div>`)}
            </div>
          </div>`}

        <div style="margin-top:10px">
          ${v.photoAttached && html`
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:rgba(255,255,255,.28);border-radius:12px;font-size:12.5px;font-weight:600;color:#fff">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="#fff" stroke-width="1.7"></rect><circle cx="9" cy="11" r="2" stroke="#fff" stroke-width="1.7"></circle><path d="M4 18l5-4 4 3 3-2 4 3" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></svg>Photo attached · ${v.photoName}
            </div>`}
          <div style="display:flex;align-items:center;background:rgba(255,255,255,.9);border-radius:16px;padding:4px 4px 4px 8px;box-shadow:0 6px 18px rgba(12,20,60,.22)">
            <div onClick=${v.attachPhoto} title="Attach or take a photo" style="cursor:pointer;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="3" stroke="#5F7CC4" stroke-width="1.8"></rect><path d="M8 6l1.2-2h5.6L16 6" stroke="#5F7CC4" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="13" r="3.2" stroke="#5F7CC4" stroke-width="1.8"></circle></svg>
            </div>
            <input value=${v.input} onInput=${v.onInput} onKeyDown=${v.onKey} placeholder="Type or describe it your way…" style="flex:1;border:none;outline:none;background:transparent;font-family:inherit;font-size:14.5px;color:#243247;padding:10px 6px" />
            <div onClick=${v.send} style="cursor:pointer;width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,oklch(0.66 0.2 265),oklch(0.55 0.23 300));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px oklch(0.45 0.2 290 / .5)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12h13M12 5l7 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:center;padding-top:12px">
          <div style="display:flex;align-items:stretch;gap:10px;padding:10px;border-radius:26px;background:rgba(255,255,255,.24);backdrop-filter:blur(18px) saturate(180%);box-shadow:0 16px 38px rgba(12,20,60,.38)">
            <div onClick=${v.endVisit} style="cursor:pointer;width:112px;border-radius:17px;background:linear-gradient(180deg,oklch(0.66 0.2 265),oklch(0.55 0.23 300));box-shadow:0 8px 20px oklch(0.4 0.2 290 / .55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 0;color:#fff">
              <span style="font-size:15px;font-weight:700;text-shadow:0 1px 2px rgba(20,10,60,.4)">End</span>
              <span style="font-size:10px;font-weight:600;opacity:.8">Finish visit</span>
            </div>
            <div onClick=${v.toggleMute} style=${v.micKeyStyle}>
              <svg width="17" height="17" viewBox="0 0 20 20"><rect x="7" y="2" width="6" height="11" rx="3" fill="#27466B"></rect><path d="M4 9v1a6 6 0 0 0 12 0V9" stroke="#27466B" stroke-width="1.6" fill="none" stroke-linecap="round"></path><line x1="10" y1="16" x2="10" y2="19" stroke="#27466B" stroke-width="1.6" stroke-linecap="round"></line></svg>
              <span style="font-size:10px;font-weight:600;color:rgba(20,38,58,.55)">${v.micLabel}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  renderRecommendation(v) {
    return html`
      <div class="vd-scroll" style="position:relative;height:100%;overflow-y:auto;padding:66px 22px 34px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div onClick=${v.backToConsult} style="cursor:pointer;display:flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);border-radius:13px;font-size:13px;font-weight:600;color:#1E3A5C">‹ Back</div>
          <div onClick=${v.goProfile} style="cursor:pointer;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);display:flex;align-items:center;justify-content:center;color:#1E3A5C;font-size:13px;font-weight:700">AK</div>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:18px">
          <div style="position:relative;width:76px;height:82px;display:flex;align-items:flex-start;justify-content:center">
            <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:58px;height:12px;border-radius:50%;background:radial-gradient(ellipse,rgba(12,20,60,.4),transparent 70%);filter:blur(3px)"></div>
            <div style="position:absolute;inset:0 0 6px 0;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);animation:vd-ring 2.8s ease-out infinite"></div>
            <div style="position:relative;width:70px;height:70px;font-size:104px;border-radius:50%;overflow:hidden;background:#F4FAFF;box-shadow:0 14px 30px oklch(0.35 0.15 270 / .5),0 0 26px oklch(0.7 0.15 260 / .4),inset 0 0 0 1px rgba(255,255,255,.85);animation:vd-pulse 3.6s ease-in-out infinite">
              <${MiraOrb} />
            </div>
          </div>
          <div style="font-size:15.5px;font-weight:600;line-height:1.4;color:#fff;text-align:center;max-width:290px;text-shadow:0 1px 10px rgba(20,30,80,.35)">${v.recHeadline}</div>
        </div>

        <div style="background:#fff;border-radius:22px;padding:20px;box-shadow:0 18px 40px rgba(12,20,60,.3)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
            <div style=${v.rec.badgeStyle}>${v.rec.typeLabel}</div>
            <div style=${v.rec.urgencyStyle}>${v.rec.urgencyLabel}</div>
          </div>
          ${v.rec.items.map(it => html`
            <div style="border:1px solid rgba(30,50,90,.1);border-radius:16px;padding:14px 15px;margin-bottom:10px">
              <div style="font-size:15.5px;font-weight:700;color:#243247">${it.name}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                ${it.hasDosage && html`
                  <div style="flex:1 1 120px;background:#F3F6FB;border-radius:11px;padding:9px 11px"><div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC">Dosage</div><div style="font-size:13.5px;font-weight:600;color:#243247;margin-top:2px">${it.dosage}</div></div>`}
                ${it.hasTiming && html`
                  <div style="flex:1 1 120px;background:#F3F6FB;border-radius:11px;padding:9px 11px"><div style="font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC">Timing</div><div style="font-size:13.5px;font-weight:600;color:#243247;margin-top:2px">${it.timing}</div></div>`}
              </div>
              ${it.hasNotes && html`
                <div style="display:flex;gap:7px;align-items:baseline;margin-top:10px"><span style="font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#B9526B;flex:none">Note</span><span style="font-size:12.5px;line-height:1.45;color:#6B7A92">${it.notes}</span></div>`}
              ${it.hasWhy && html`
                <div style="display:flex;gap:7px;align-items:baseline;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(30,50,90,.12)"><span style="font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5F6FD6;flex:none">Why</span><span style="font-size:12.5px;line-height:1.45;color:#5A6B82">${it.why}</span></div>`}
            </div>`)}
          ${v.rec.hasAdvice && html`
            <div style="background:oklch(0.7 0.13 200 / .12);border-radius:14px;padding:12px 15px;margin-top:4px">
              <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:oklch(0.45 0.12 220);margin-bottom:5px">When to seek help</div>
              <div style="font-size:13px;line-height:1.5;color:#3A4E6E">${v.rec.advice}</div>
            </div>`}
          <div style="display:flex;align-items:center;gap:9px;background:oklch(0.72 0.13 160 / .12);border-radius:14px;padding:11px 14px;margin-top:10px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6l7-3z" stroke="oklch(0.45 0.13 160)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M9 11.5l2 2 4-4" stroke="oklch(0.45 0.13 160)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <div style="font-size:12px;line-height:1.45;color:oklch(0.4 0.12 160);font-weight:600">Safety checks done — your Penicillin allergy was respected and drug interactions were reviewed.</div>
          </div>
        </div>

        <div style="background:rgba(255,255,255,.14);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.22);border-radius:18px;padding:15px 16px;margin-top:16px">
          <div style="display:flex;align-items:center;gap:11px">
            <div style="position:relative;width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#3E6FD6,#7B4DE0);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex:none">SW<div style=${v.reviewerDotStyle}></div></div>
            <div style="flex:1">
              <div style="font-size:14.5px;font-weight:700;color:#fff">Dr. Sara Whitfield, MD</div>
              <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:1px">General Physician · GMC-483920</div>
            </div>
          </div>
          <div style="font-size:12.5px;color:rgba(255,255,255,.85);margin-top:10px;line-height:1.45"><span style="font-weight:700">${v.statusTitle}</span> — ${v.statusSub}</div>
        </div>

        <div style="background:rgba(255,255,255,.12);border-radius:18px;padding:16px;margin-top:12px">
          <div style="font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:12px">What happens next</div>
          ${v.timeline.map(step => html`
            <div style="display:flex;gap:11px;padding-bottom:12px">
              <div style=${step.dotStyle}></div>
              <div><div style=${step.titleStyle}>${step.t}</div><div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:1px">${step.d}</div></div>
            </div>`)}
        </div>

        <div style="display:flex;gap:10px;margin-top:16px">
          <div onClick=${v.askFollowUp} style="cursor:pointer;flex:1;height:52px;border-radius:16px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14.5px;font-weight:600;color:#1E3A5C;box-shadow:0 6px 16px rgba(12,20,60,.2)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="6" height="11" rx="3" stroke="#1E3A5C" stroke-width="1.8"></rect><path d="M4 10v1a6 6 0 0012 0v-1" stroke="#1E3A5C" stroke-width="1.8" stroke-linecap="round"></path></svg>Ask a follow-up</div>
          ${v.showOrder && html`
            <div onClick=${v.orderMeds} style="cursor:pointer;flex:1.2;height:52px;border-radius:16px;background:linear-gradient(180deg,oklch(0.66 0.2 265),oklch(0.55 0.23 300));display:flex;align-items:center;justify-content:center;gap:8px;font-size:14.5px;font-weight:700;color:#fff;box-shadow:0 8px 22px oklch(0.42 0.2 290 / .5)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16l-1.4 10.3a2 2 0 01-2 1.7H7.4a2 2 0 01-2-1.7L4 7zM8 7V5a4 4 0 018 0v2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>${v.orderLabel}</div>`}
        </div>
        <div onClick=${v.shareCaregiver} style="cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:46px;border-radius:14px;margin-top:10px;background:rgba(255,255,255,.14);font-size:13.5px;font-weight:600;color:#fff">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"></path><path d="M12 15V3m0 0L8 7m4-4l4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>${v.caregiverLabel}</div>
      </div>`;
  }

  renderProfile(v) {
    return html`
      <div class="vd-scroll" style="position:relative;height:100%;overflow-y:auto;padding:66px 20px 34px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <div onClick=${v.goConsult} style="cursor:pointer;display:flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);border-radius:13px;font-size:13px;font-weight:600;color:#1E3A5C">‹ Consult</div>
          <div style="height:38px;padding:0 14px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.32);border-radius:13px;font-size:13px;font-weight:600;color:#1E3A5C">Settings</div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,oklch(0.66 0.2 265),oklch(0.62 0.21 320));display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;box-shadow:0 8px 20px oklch(0.45 0.2 290 / .45)">AK</div>
          <div><div style="font-size:20px;font-weight:700;color:#fff;text-shadow:0 1px 8px rgba(20,30,80,.3)">Alex Kumar</div><div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:2px">alex.kumar@gmail.com</div></div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:18px">
          <div style="flex:1;background:rgba(255,255,255,.85);border-radius:14px;padding:11px 12px;text-align:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8493AC">Age</div><div style="font-size:16px;font-weight:700;color:#243247;margin-top:2px">34</div></div>
          <div style="flex:1;background:rgba(255,255,255,.85);border-radius:14px;padding:11px 12px;text-align:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8493AC">Blood</div><div style="font-size:16px;font-weight:700;color:#243247;margin-top:2px">O+</div></div>
          <div style="flex:1.4;background:rgba(255,255,255,.85);border-radius:14px;padding:11px 12px;text-align:center"><div style="font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8493AC">Allergy</div><div style="font-size:14px;font-weight:700;color:#C0405A;margin-top:3px">Penicillin</div></div>
        </div>

        <div style="font-size:13px;font-weight:700;color:#fff;margin:4px 4px 10px;text-shadow:0 1px 6px rgba(20,30,80,.3)">Consultations</div>
        ${v.consults.map(c => html`
          <div style="background:#fff;border-radius:16px;padding:15px 16px;margin-bottom:10px;box-shadow:0 6px 16px rgba(12,20,60,.14)">
            <div style="display:flex;justify-content:space-between;align-items:start"><div style="font-size:14.5px;font-weight:600;color:#243247">${c.title}</div><div style=${c.tagStyle}>${c.status}</div></div>
            <div style="font-size:12.5px;color:#8493AC;margin-top:3px">${c.date} · Dr. Mira</div>
            <div style="font-size:13px;color:#5A6B82;margin-top:8px;line-height:1.5">${c.note}</div>
          </div>`)}

        <div style="font-size:13px;font-weight:700;color:#fff;margin:14px 4px 10px;text-shadow:0 1px 6px rgba(20,30,80,.3)">Prescriptions</div>
        ${v.prescriptions.map(p => html`
          <div style="background:#fff;border-radius:16px;padding:15px 16px;margin-bottom:10px;box-shadow:0 6px 16px rgba(12,20,60,.14);display:flex;gap:12px;align-items:center">
            <div style="width:40px;height:40px;border-radius:12px;background:#EEF3FB;display:flex;align-items:center;justify-content:center;flex:none">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 3h6a4 4 0 010 8H6V3zM6 11l8 10" stroke="#5F7CC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </div>
            <div style="flex:1"><div style="font-size:14.5px;font-weight:600;color:#243247">${p.name}</div><div style="font-size:12.5px;color:#8493AC;margin-top:2px">${p.detail} · ${p.date}</div></div>
          </div>`)}

        <div style="font-size:13px;font-weight:700;color:#fff;margin:14px 4px 10px;text-shadow:0 1px 6px rgba(20,30,80,.3)">Lab results</div>
        ${v.labs.map(l => html`
          <div style="background:#fff;border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 6px 16px rgba(12,20,60,.14);display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:14px;font-weight:600;color:#243247">${l.name}</div><div style="font-size:12.5px;color:#8493AC;margin-top:2px">${l.date}</div></div>
            <div style=${l.tagStyle}>${l.result}</div>
          </div>`)}

        <div style="font-size:13px;font-weight:700;color:#fff;margin:14px 4px 10px;text-shadow:0 1px 6px rgba(20,30,80,.3)">Documents</div>
        <div style="display:flex;gap:10px">
          <${ImageSlot} placeholder="Upload report" radius=${14} style="flex:1;height:104px" />
          <${ImageSlot} placeholder="Upload scan" radius=${14} style="flex:1;height:104px" />
        </div>
      </div>`;
  }

  renderPatient(v) {
    return html`
      <${IOSDevice}>
        <div style="position:relative;height:100%;width:100%;overflow:hidden;background:linear-gradient(165deg,#7FA8DC 0%,#5F7CC4 48%,#414FA0 100%);font-family:'Instrument Sans',sans-serif">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 1px,transparent 1px 44px),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 44px);mask-image:radial-gradient(ellipse 90% 60% at 50% 38%,#000 20%,transparent 75%);-webkit-mask-image:radial-gradient(ellipse 90% 60% at 50% 38%,#000 20%,transparent 75%)"></div>
          <div style="position:absolute;top:-12%;left:-25%;width:70%;height:45%;border-radius:50%;background:radial-gradient(circle,oklch(0.8 0.14 195 / .5),transparent 65%)"></div>
          <div style="position:absolute;top:30%;right:-30%;width:75%;height:50%;border-radius:50%;background:radial-gradient(circle,oklch(0.68 0.19 330 / .4),transparent 65%)"></div>
          <div style="position:absolute;bottom:-15%;left:-15%;width:70%;height:45%;border-radius:50%;background:radial-gradient(circle,oklch(0.55 0.2 290 / .45),transparent 65%)"></div>
          ${v.isLogin && this.renderLogin(v)}
          ${v.isHome && this.renderHome(v)}
          ${v.isConsult && this.renderConsult(v)}
          ${v.isRec && this.renderRecommendation(v)}
          ${v.isProfile && this.renderProfile(v)}
        </div>
      <//>`;
  }

  // ---------------- doctor desk ----------------

  renderDoctor(v) {
    const a = v.active;
    return html`
      <div style="width:min(1160px,100%);border-radius:22px;overflow:hidden;box-shadow:0 30px 70px rgba(10,18,45,.35);border:1px solid rgba(255,255,255,.3);background:linear-gradient(165deg,#7FA8DC 0%,#5F7CC4 48%,#414FA0 100%);position:relative">
        <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 44px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 44px);mask-image:radial-gradient(ellipse 90% 70% at 50% 30%,#000 20%,transparent 80%);-webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 30%,#000 20%,transparent 80%)"></div>
        <div style="position:absolute;top:-18%;left:-15%;width:55%;height:50%;border-radius:50%;background:radial-gradient(circle,oklch(0.8 0.14 195 / .45),transparent 65%)"></div>
        <div style="position:absolute;bottom:-20%;right:-15%;width:60%;height:55%;border-radius:50%;background:radial-gradient(circle,oklch(0.6 0.19 320 / .35),transparent 65%)"></div>

        <div style="position:relative;z-index:5;display:flex;align-items:center;gap:10px;padding:16px 18px 12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);border-radius:13px;font-size:12.5px;font-weight:600;color:#1E3A5C;box-shadow:0 3px 12px rgba(12,20,60,.22)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(0.75 0.16 160);box-shadow:0 0 8px oklch(0.75 0.16 160)"></span>Clinical Review</div>
          <div style="height:38px;padding:0 12px;display:flex;align-items:center;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);border-radius:13px;font-size:12px;font-weight:700;color:#1E3A5C">${v.pendingCount}${' '}pending</div>
          <div style="flex:1"></div>
          <div onClick=${v.toggleNotifs} title="Notifications" style="cursor:pointer;position:relative;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(12,20,60,.22)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" stroke="#1E3A5C" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10 20a2 2 0 004 0" stroke="#1E3A5C" stroke-width="1.9" stroke-linecap="round"></path></svg>
            <div style="position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;border-radius:99px;background:oklch(0.62 0.21 20);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 2px 6px rgba(120,10,40,.4)">${v.notifCount}</div>
          </div>
          <div onClick=${v.toggleDocProfile} title="Doctor profile & settings" style="cursor:pointer;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;color:#1E3A5C;font-size:13px;font-weight:700;box-shadow:0 3px 12px rgba(12,20,60,.22)">SW</div>
        </div>

        ${v.showNotifs && html`
          <div style="position:absolute;z-index:20;top:62px;right:66px;width:300px;max-width:calc(100% - 36px);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(12,20,60,.4);padding:8px;animation:vd-fade .2s ease both">
            <div style="font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC;padding:10px 12px 6px">Notifications</div>
            ${v.notifications.map(n => html`
              <div class="vd-hov" style="display:flex;gap:10px;padding:10px 12px;border-radius:11px">
                <div style=${n.dotStyle}></div>
                <div><div style="font-size:13px;font-weight:600;color:#243247">${n.t}</div><div style="font-size:12px;color:#8493AC;margin-top:1px">${n.d}</div></div>
              </div>`)}
          </div>`}

        ${v.showDocProfile && html`
          <div style="position:absolute;z-index:20;top:62px;right:18px;width:280px;max-width:calc(100% - 36px);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(12,20,60,.4);padding:18px;animation:vd-fade .2s ease both">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:46px;height:46px;border-radius:15px;background:linear-gradient(135deg,#3E6FD6,#7B4DE0);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:700">SW</div>
              <div><div style="font-size:15px;font-weight:700;color:#243247">Dr. Sara Whitfield</div><div style="font-size:12px;color:#8493AC;margin-top:1px">General Physician · GMC-483920</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:8px 12px;background:oklch(0.72 0.13 160 / .14);border-radius:10px;font-size:12.5px;font-weight:600;color:oklch(0.42 0.13 160)"><span style="width:7px;height:7px;border-radius:99px;background:oklch(0.7 0.15 160)"></span>On duty · accepting reviews</div>
            <div style="height:1px;background:rgba(30,50,90,.1);margin:14px 0 6px"></div>
            <div style="padding:10px 4px;font-size:13.5px;font-weight:600;color:#3A4E6E;display:flex;justify-content:space-between;cursor:pointer"><span>Availability hours</span><span style="color:#98A6C2">›</span></div>
            <div style="padding:10px 4px;font-size:13.5px;font-weight:600;color:#3A4E6E;display:flex;justify-content:space-between;cursor:pointer"><span>Notification preferences</span><span style="color:#98A6C2">›</span></div>
            <div style="padding:10px 4px;font-size:13.5px;font-weight:600;color:#3A4E6E;display:flex;justify-content:space-between;cursor:pointer"><span>E-signature & stamp</span><span style="color:#98A6C2">›</span></div>
            <div style="height:1px;background:rgba(30,50,90,.1);margin:6px 0"></div>
            <div style="padding:10px 4px;font-size:13.5px;font-weight:600;color:#C0405A;cursor:pointer">Sign out</div>
          </div>`}

        <div style="position:relative;display:flex;flex-wrap:wrap;gap:14px;padding:4px 18px 18px;align-items:stretch">

          <div class="vd-scroll" style="flex:1 1 250px;min-width:250px;max-height:clamp(360px,calc(100vh - 170px),640px);overflow-y:auto">
            <div style="font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.85);text-shadow:0 1px 6px rgba(20,30,80,.35);margin:2px 4px 10px">Review queue</div>
            ${v.queue.map(q => html`
              <div onClick=${q.onClick} style=${q.cardStyle}>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-size:14px;font-weight:700;color:#243247">${q.patient}</div><div style=${q.statusStyle}>${q.statusLabel}</div></div>
                <div style="font-size:12.5px;color:#5A6B82;margin-top:4px">${q.title}</div>
                <div style="font-size:11.5px;color:#8493AC;margin-top:6px">${q.meta}</div>
              </div>`)}
          </div>

          <div class="vd-scroll" style="flex:999 1 460px;min-width:min(460px,100%);max-height:clamp(360px,calc(100vh - 170px),640px);overflow-y:auto;position:relative;border-radius:22px">

            <div style="position:sticky;top:0;z-index:6;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 10px 16px;margin:0 0 2px;background:linear-gradient(165deg,#7FA8DC 0%,#5F7CC4 60%,#5474bd 100%);border-radius:22px 22px 0 0">
              <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
                <div style="font-size:21px;font-weight:700;color:#fff;text-shadow:0 1px 10px rgba(20,30,80,.4)">${a.patient}</div>
                <div style="font-size:13px;color:rgba(255,255,255,.8)">${a.demo}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div style=${a.statusStyle}>${a.statusLabel}</div>
                ${a.actionable && html`
                  <div onClick=${v.approveCase} style="cursor:pointer;height:34px;padding:0 14px;border-radius:11px;background:linear-gradient(180deg,oklch(0.72 0.15 155),oklch(0.62 0.16 160));display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#06231A;box-shadow:0 5px 14px oklch(0.5 0.15 160 / .45)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#06231A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>${v.approveLabel}</div>`}
              </div>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin-top:2px">

              <div style="flex:8 1 240px;min-width:min(240px,100%);display:flex;flex-direction:column;gap:12px">
                <div style="background:#fff;border-radius:16px;padding:15px 17px;box-shadow:0 14px 34px rgba(12,20,60,.32)">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                    <div style="display:flex;align-items:center;gap:7px"><div style="width:19px;height:19px;border-radius:6px;background:linear-gradient(135deg,oklch(0.7 0.18 250),oklch(0.62 0.2 310));display:flex;align-items:center;justify-content:center;flex:none"><div style="width:7px;height:7px;border-radius:50%;background:#fff"></div></div><div style="font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#5F6FD6">${a.headerLabel}</div></div>
                    <div style=${a.confStyle}>${a.confLabel}</div>
                  </div>

                  ${a.lowConf && html`
                    <div style="display:flex;align-items:center;gap:7px;margin-top:9px;padding:8px 11px;background:oklch(0.8 0.14 70 / .2);border-radius:9px;font-size:11.5px;font-weight:600;color:#6B4E00">⚠ Low AI confidence — recommend closer human review or a live call.</div>`}

                  <div style="background:#F5F7FB;border-radius:12px;padding:12px 13px;margin-top:11px">
                    <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC;margin-bottom:8px">Consultation summary</div>
                    ${a.summaryPoints.map(p => html`
                      <div style="display:flex;gap:8px;align-items:baseline;padding:3px 0"><div style=${p.dotStyle}></div><div style="font-size:12.5px;line-height:1.4;color:#3A4E6E;flex:1">${p.v}</div></div>`)}
                  </div>

                  <div style="background:#F5F7FB;border-radius:12px;padding:12px 13px;margin-top:10px">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#5F6FD6" stroke-width="1.7"></circle><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke="#5F6FD6" stroke-width="1.7" stroke-linejoin="round"></path></svg><span style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#5F6FD6">AI doctor observation</span></div>
                    <div style="font-size:12.5px;line-height:1.55;color:#3A4E6E">${a.observation}</div>
                  </div>

                  <div style="background:oklch(0.62 0.2 290 / .08);border:1px solid oklch(0.62 0.2 290 / .18);border-radius:12px;padding:12px 13px;margin-top:10px">
                    <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#5F6FD6;margin-bottom:6px">Evaluation</div>
                    <div style="font-size:13.5px;line-height:1.45;font-weight:600;color:#4A3E86">${a.evaluation}</div>
                  </div>

                  <div style="background:#F5F7FB;border-radius:13px;padding:13px 14px;margin-top:10px">
                    <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8493AC;margin-bottom:10px">Next steps</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px">
                      ${a.hasTests && html`
                        <div>
                          <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 3v6l-4.5 8A2 2 0 006.3 20h11.4a2 2 0 001.8-3L15 9V3" stroke="#3E86C4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9 3h6" stroke="#3E86C4" stroke-width="1.7" stroke-linecap="round"></path></svg><span style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#3E86C4">Tests</span></div>
                          ${a.tests.map(it => html`
                            <div style="background:#fff;border-radius:9px;padding:8px 11px;margin-bottom:6px;box-shadow:0 1px 3px rgba(12,20,60,.08)"><div style="font-size:12.5px;font-weight:700;color:#243247">${it.name}</div><div style="font-size:11px;color:#6B7A92;margin-top:1px;line-height:1.4">${it.detail}</div></div>`)}
                        </div>`}
                      ${a.hasRx && html`
                        <div>
                          <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 3h5a4 4 0 010 8H6V3zM6 11l8 10" stroke="#8B4FD6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8B4FD6">Prescription</span></div>
                          ${a.rx.map(it => html`
                            <div style="background:#fff;border-radius:9px;padding:8px 11px;margin-bottom:6px;box-shadow:0 1px 3px rgba(12,20,60,.08)"><div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:700;color:#243247">${it.name}</span><span style="font-size:11px;font-weight:700;color:#8B4FD6">${it.dosage}</span></div><div style="font-size:11px;color:#6B7A92;margin-top:1px;line-height:1.4">${it.timing}</div></div>`)}
                        </div>`}
                    </div>
                  </div>

                  ${a.hasAdvice && html`
                    <div style="background:oklch(0.7 0.13 200 / .1);border-radius:12px;padding:11px 14px;margin-top:10px">
                      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:oklch(0.45 0.12 220);margin-bottom:5px">Advice</div>
                      <div style="font-size:12.5px;color:#3A4E6E;line-height:1.5">${a.advice}</div>
                    </div>`}

                  ${a.approved && html`
                    <div style="display:flex;align-items:center;gap:8px;margin-top:11px;padding:9px 12px;background:oklch(0.72 0.13 160 / .14);border-radius:10px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="oklch(0.5 0.14 160)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><div style="font-size:12px;font-weight:600;color:oklch(0.4 0.13 160)">Approved — sent to ${a.patient} and added to their records.</div></div>`}
                </div>

                <div style="background:rgba(255,255,255,.9);border-radius:16px;padding:16px 17px">
                  <div style="font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC;margin-bottom:10px">Patient history</div>
                  <div style="font-size:13px;line-height:1.6;color:#3A4E6E">${a.history}</div>
                </div>
                <div style="background:rgba(255,255,255,.9);border-radius:16px;padding:16px 17px">
                  <div style="font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC;margin-bottom:8px">Test history</div>
                  ${a.testHistory.map(l => html`
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(30,50,90,.07)">
                      <div><div style="font-size:13px;font-weight:600;color:#243247">${l.name}</div><div style="font-size:11.5px;color:#8493AC;margin-top:1px">${l.date}</div></div>
                      <div style=${l.tagStyle}>${l.result}</div>
                    </div>`)}
                </div>
                <div style="background:rgba(255,255,255,.9);border-radius:16px;padding:16px 17px">
                  <div style="font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8493AC;margin-bottom:8px">Previous consultations</div>
                  ${a.pastConsults.map(pc => html`
                    <div style="padding:9px 0;border-bottom:1px solid rgba(30,50,90,.07)">
                      <div style="display:flex;justify-content:space-between;gap:8px"><div style="font-size:13px;font-weight:700;color:#243247">${pc.title}</div><div style="font-size:11.5px;color:#8493AC;flex:none">${pc.date}</div></div>
                      <div style="font-size:12px;color:#5A6B82;margin-top:3px;line-height:1.45">${pc.note}</div>
                    </div>`)}
                </div>
              </div>

              ${v.notDocMin && html`
              <div style="flex:2 1 280px;min-width:min(280px,100%);position:sticky;top:0;align-self:flex-start">
                <div style="position:relative;display:flex;flex-direction:column;height:clamp(360px,calc(100vh - 170px),640px);background:linear-gradient(165deg,#7FA8DC 0%,#5F7CC4 48%,#414FA0 100%);border-radius:22px;padding:18px 18px 16px;box-shadow:0 16px 40px rgba(12,20,60,.35);overflow:hidden">
                  <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 40px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 40px);mask-image:radial-gradient(ellipse 90% 70% at 50% 35%,#000 20%,transparent 80%);-webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 35%,#000 20%,transparent 80%)"></div>
                  <div style="position:absolute;top:-12%;right:-18%;width:65%;height:42%;border-radius:50%;background:radial-gradient(circle,oklch(0.68 0.19 330 / .4),transparent 65%)"></div>
                  <div style="position:absolute;bottom:-14%;left:-16%;width:68%;height:45%;border-radius:50%;background:radial-gradient(circle,oklch(0.55 0.2 290 / .4),transparent 65%)"></div>

                  <div style="position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center">
                    <div style="display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);border-radius:13px;font-size:12px;font-weight:600;color:#1E3A5C;box-shadow:0 3px 12px rgba(12,20,60,.22)"><div style=${v.docLiveDot}></div>Live review</div>
                    ${v.docReview && html`
                      <div onClick=${v.stopDocReview} title="End review" style="cursor:pointer;height:38px;padding:0 14px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);display:flex;align-items:center;font-size:12px;font-weight:700;color:#C0405A;box-shadow:0 3px 12px rgba(12,20,60,.22)">End</div>`}
                    ${v.notDocReview && html`
                      <div style="width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.32);backdrop-filter:blur(14px) saturate(160%);display:flex;align-items:center;justify-content:center;color:#1E3A5C;font-size:13px;font-weight:700;box-shadow:0 3px 12px rgba(12,20,60,.22)">SW</div>`}
                  </div>

                  <div style="position:relative;z-index:2;flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:8px 0 2px">
                    <div style="position:relative;width:116px;height:124px;display:flex;align-items:flex-start;justify-content:center;flex:none">
                      <div style="position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);width:86px;height:16px;border-radius:50%;background:radial-gradient(ellipse,rgba(12,20,60,.4),transparent 70%);filter:blur(4px)"></div>
                      <div style=${v.docRingColor}></div>
                      <div style="position:absolute;inset:0 0 12px 0;border-radius:50%;border:1.5px solid rgba(255,255,255,.4);opacity:.55;animation:vd-ring 2.8s ease-out 1s infinite"></div>
                      <div onClick=${v.toggleDocMin} title="Minimize" style=${v.docOrbAnim}>
                        <${MiraOrb} />
                      </div>
                    </div>
                    <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.85);text-shadow:0 1px 8px rgba(20,30,80,.4)">Dr. Mira</div>
                    <div style="display:flex;align-items:center;gap:10px;padding:9px 16px;background:rgba(255,255,255,.4);backdrop-filter:blur(12px) saturate(160%);border-radius:14px;box-shadow:0 3px 12px rgba(15,30,70,.22)">
                      <div style="display:flex;align-items:center;gap:3px;height:16px">
                        <span style="width:3px;height:6px;border-radius:2px;background:oklch(0.6 0.2 265)"></span>
                        <span style="width:3px;height:12px;border-radius:2px;background:oklch(0.62 0.2 290)"></span>
                        <span style="width:3px;height:9px;border-radius:2px;background:oklch(0.66 0.2 330)"></span>
                        <span style="width:3px;height:14px;border-radius:2px;background:oklch(0.62 0.2 300)"></span>
                        <span style="width:3px;height:7px;border-radius:2px;background:oklch(0.6 0.2 275)"></span>
                      </div>
                      <span style="font-size:13px;color:#1E3A5C;font-weight:500">${v.docStatusLabel}</span>
                    </div>
                  </div>

                  ${v.docReview && html`
                    <div style="position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:2px 0 8px">
                      ${v.docChips.map(c => html`
                        <div onClick=${c.onClick} style="cursor:pointer;padding:8px 13px;background:rgba(255,255,255,.85);border-radius:99px;font-size:12.5px;font-weight:600;color:#3A4E6E;box-shadow:0 3px 10px rgba(12,20,60,.16)">${c.label}</div>`)}
                      <div onClick=${v.docApprove} style="cursor:pointer;display:flex;align-items:center;gap:5px;padding:8px 13px;background:linear-gradient(180deg,oklch(0.75 0.15 155),oklch(0.64 0.16 160));border-radius:99px;font-size:12.5px;font-weight:700;color:#06231A;box-shadow:0 3px 10px oklch(0.5 0.15 160 / .4)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#06231A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>Approve & send</div>
                    </div>`}

                  ${v.hasDocNotes && html`
                    <div style="position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;background:rgba(255,255,255,.22);backdrop-filter:blur(14px) saturate(160%);border-radius:16px;padding:6px 14px 10px;box-shadow:0 6px 18px rgba(12,20,60,.2)">
                      <div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;padding:2px 0 6px">
                        <div style="width:36px;height:4px;border-radius:99px;background:rgba(255,255,255,.55)"></div>
                        <div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.8)">Review thread</span></div>
                      </div>
                      <div class="vd-scroll" style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
                        ${v.docNotes.map(n => html`
                          <div style="display:flex;gap:8px;align-items:baseline;animation:vd-fade .3s ease both"><div style=${n.whoStyle}>${n.who}</div><div style="font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.92)">${n.t}</div></div>`)}
                      </div>
                    </div>`}

                  ${v.docReview && html`
                    <div style="position:relative;z-index:2;margin-top:10px;display:flex;align-items:center;background:rgba(255,255,255,.9);border-radius:16px;padding:4px 4px 4px 8px;box-shadow:0 6px 18px rgba(12,20,60,.22)">
                      <div onClick=${v.docOrbTap} title="Tap to speak instead" style="cursor:pointer;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="#5F7CC4" stroke-width="1.8"></rect><path d="M5 11v1a7 7 0 0014 0v-1" stroke="#5F7CC4" stroke-width="1.8" stroke-linecap="round"></path></svg></div>
                      <input value=${v.docInput} onInput=${v.onDocInput} onKeyDown=${v.onDocKey} ref=${v.docInputRef} placeholder="Reply to Dr. Mira…" style="flex:1;min-width:0;border:none;outline:none;background:transparent;font-family:inherit;font-size:14.5px;color:#243247;padding:10px 6px" />
                      <div onClick=${v.sendDoc} style="cursor:pointer;width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,oklch(0.66 0.2 265),oklch(0.55 0.23 300));display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px oklch(0.45 0.2 290 / .5);flex:none"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12h13M12 5l7 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>
                    </div>
                    <div style="position:relative;z-index:2;display:flex;justify-content:center;padding-top:12px">
                      <div style="display:flex;align-items:stretch;gap:10px;padding:10px;border-radius:26px;background:rgba(255,255,255,.24);backdrop-filter:blur(18px) saturate(180%);box-shadow:0 16px 38px rgba(12,20,60,.38)">
                        <div onClick=${v.stopDocReview} style="cursor:pointer;width:112px;border-radius:17px;background:linear-gradient(180deg,oklch(0.66 0.2 265),oklch(0.55 0.23 300));box-shadow:0 8px 20px oklch(0.4 0.2 290 / .55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 0;color:#fff">
                          <span style="font-size:15px;font-weight:700;text-shadow:0 1px 2px rgba(20,10,60,.4)">End</span>
                          <span style="font-size:10px;font-weight:600;opacity:.8">Finish review</span>
                        </div>
                        <div onClick=${v.toggleDocMute} style=${v.docMicKeyStyle}>
                          <svg width="17" height="17" viewBox="0 0 20 20"><rect x="7" y="2" width="6" height="11" rx="3" fill="#27466B"></rect><path d="M4 9v1a6 6 0 0 0 12 0V9" stroke="#27466B" stroke-width="1.6" fill="none" stroke-linecap="round"></path><line x1="10" y1="16" x2="10" y2="19" stroke="#27466B" stroke-width="1.6" stroke-linecap="round"></line></svg>
                          <span style="font-size:10px;font-weight:600;color:rgba(20,38,58,.55)">${v.docMicLabel}</span>
                        </div>
                      </div>
                    </div>`}
                  ${v.notDocReview && html`
                    <div style="flex:1"></div>
                    <div onClick=${v.startDocReview} style="cursor:pointer;position:relative;z-index:2;margin-top:10px;height:52px;border-radius:16px;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;gap:9px;font-size:14.5px;font-weight:700;color:#243247;box-shadow:0 8px 20px rgba(12,20,60,.3)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke="#5F6FD6" stroke-width="1.9" stroke-linejoin="round"></path></svg>Talk</div>`}
                </div>
              </div>`}

              ${v.docMin && html`
                <div onClick=${v.toggleDocMin} title="Open Dr. Mira" style="position:sticky;bottom:22px;z-index:30;align-self:flex-end;flex:none;width:66px;height:66px;margin:auto 4px 4px 0;cursor:pointer">
                  <div style="position:absolute;inset:-7px;border-radius:50%;border:1.5px solid rgba(120,150,220,.6);animation:vd-ring 2.8s ease-out infinite"></div>
                  <div style="position:relative;width:66px;height:66px;font-size:80px;border-radius:50%;overflow:hidden;background:#F4FAFF;box-shadow:0 12px 28px oklch(0.4 0.15 270 / .5),0 0 22px oklch(0.7 0.15 260 / .45);animation:vd-pulse 3.6s ease-in-out infinite">
                    <${MiraOrb} />
                  </div>
                </div>`}

            </div>
          </div>
        </div>
      </div>`;
  }

  render() {
    const v = this.renderVals();
    return html`
      <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:26px 20px 60px;gap:22px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <div style="font-size:19px;font-weight:700;color:#243247;letter-spacing:.01em">Virtual Doctor</div>
          <div style="display:flex;background:#fff;border:1px solid rgba(30,50,90,.1);border-radius:12px;padding:4px;box-shadow:0 2px 10px rgba(20,40,90,.08)">
            <div onClick=${v.viewPatient} style=${v.patientTabStyle}>Patient app</div>
            <div onClick=${v.viewDoctor} style=${v.doctorTabStyle}>Doctor desk</div>
          </div>
        </div>
        ${v.isPatient && this.renderPatient(v)}
        ${v.isDoctor && this.renderDoctor(v)}
      </div>`;
  }
}

render(html`<${App} />`, document.getElementById('app'));
