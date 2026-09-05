# Virtual Doctor — Product Requirements Document

**Version:** 0.5 (v0.2 revised after PM review — MVP re-scoped into MVP-0/MVP-1, riskiest assumptions, lifecycle edge cases, and risks added; all open questions in §9.2 resolved — domain scheme, voice provider, notifications, doctor assignment; v0.3 renamed the "Doctor Desk" app to **Doctor App** throughout, matching "Patient App" — naming only, no scope change; v0.4 merges both lines of work; v0.5 reframes the product from **two separate PWAs** to **one PWA with per-module entry points** — the Patient App and Doctor App are the patient and doctor *modules* of a single PWA (future: pharmacy, …), each reached at its own URL path (`/patient`, `/doctor`) and sharing a configurable app shell + component library while keeping full per-module UI customization; §6.1 rewritten to one Vite build / one deploy with route-level module code-splitting for download isolation — see ARCHITECTURE DEC-19. Product scope unchanged; only the "two apps" framing is corrected)
**Date:** 2026-07-07
**Status:** Awaiting review — the implementation Action Plan will be written after this PRD is approved.

---

## 1. Problem Statement

Outpatient care at small and mid-size hospitals is bottlenecked by the first 10 minutes of every consultation: doctors spend most of a visit collecting the same history — main symptom, duration, severity, associated symptoms, allergies — before any clinical judgment happens. Patients, meanwhile, have no structured way to describe their problem before they arrive, no single place to see their prescriptions and visit history, and often leave with a paper slip they lose.

Hospitals want a digital front door, but existing telemedicine platforms are either single-hospital custom builds (expensive, unmaintainable) or generic marketplaces that put the platform's brand — not the hospital's — in front of the patient.

**Virtual Doctor** is **one PWA with two per-module entry points** (a patient module and a doctor module, each reached at its own URL path — future modules such as pharmacy plug in the same way). The two experiences below are modules of that single app sharing a configurable app shell and component library, not separate apps:

- **Patient App** (patient module) — a hospital-branded experience where a patient signs in and **speaks with *Dr. Mira***, an empathetic AI physician, the way they would speak to a doctor on a phone call. Dr. Mira is the **primary doctor** in the experience: she greets the patient aloud, listens, asks questions one at a time in a natural, caring voice, and concludes with a recommended plan (prescription or investigations) — everything a real doctor would do on a first call. Voice is the primary medium; text chat is a secondary aid (typing a medicine name, answering when speaking isn't possible). The app clearly discloses that Dr. Mira is an AI, and the patient can view all past visits and prescriptions.
- **Doctor App** (doctor module) — the experience for the hospital's doctors, showing a review queue of AI-drafted consults. Here Dr. Mira plays her second role: **case coordinator**. She *presents* each case to the real doctor the way a junior doctor presents to a senior — speaking naturally through the same voice (later video-avatar) interface: the patient's story, her working diagnosis, her reasoning, and her recommendation. The doctor can interrupt and ask her anything about the patient — history, prior consults, labs, allergies — and she answers from full patient context. Because the case arrives pre-worked and well-presented, the doctor approves (or edits/rejects) in minimal time, and the patient instantly receives a doctor-signed prescription. Traditional visual review (transcript, structured draft, forms) remains fully available; the conversation is an accelerator, not a replacement.

The AI never prescribes on its own. Every recommendation is a **draft** until a licensed doctor approves it — the AI compresses the intake, the doctor keeps the judgment.

The platform is **multi-tenant**: one deployment serves many hospitals, each with its own subdomain, branding, doctors, and strictly isolated data.

---

## 2. Goals & Non-Goals

### Release ladder: MVP-0 → MVP-1 → Phase 2

The MVP is deliberately split into two increments so the riskiest assumptions (§2A) are tested with the smallest possible build. **Multi-tenancy remains a design constraint from day one** (schema, RLS, theming tokens are multi-tenant in MVP-0); only its *delivery* (subdomains, onboarding flow) is deferred to MVP-1.

**MVP-0 — validate the core loop with one pilot hospital:**
- Voice-first patient consult with Dr. Mira (Goal 1) for a single design-partner hospital; tenant config seeded directly (no subdomain plumbing yet).
- **Visual-only Doctor App**: queue, transcript, editable draft, approve/edit/reject with full audit (D-1 – D-6). Mira's spoken presentation, Q&A, and conversational edits (D-7 – D-9) are MVP-1.
- Patient records and prescription views (Goal 3).
- A **single Doctor Agent** behind the Mira persona — no Receptionist split yet; the orchestration layer still exposes logical agent boundaries per §3B.2 so the split is config later.
- No patient image sharing.

**MVP-1 — widen once the loop is proven:**
- Coordinator-mode voice on the Doctor App (D-7, D-8, D-9) — reuses the proven patient voice stack.
- Multi-tenant *delivery*: subdomain resolution, per-tenant manifest/branding, operator onboarding (UC-4, Goal 4).
- Patient photo sharing + Mira image analysis (`consult_media`).
- Receptionist/Doctor agent split (§3B.1).

**Phase 2+** — as per the agent roster (§3B.1) and Non-Goals below.

### Goals (MVP)
1. **Voice-first AI consult** *(MVP-0)*: the patient completes a spoken consultation with Dr. Mira in under 5 minutes, hands-free after tapping "Start". Dr. Mira's voice must sound natural, warm, and empathetic — never robotic — and the pause between the patient finishing speaking and Dr. Mira replying must feel conversational (target < 1.5 s to first audio, hard ceiling 3 s).
2. Async doctor review, accelerated by Mira *(visual review MVP-0; Mira's spoken presentation and Q&A MVP-1)*: the doctor hears a concise spoken case presentation, can question Mira about the patient conversationally, and approves/edits/rejects in under 2 minutes.
3. Records *(MVP-0)*: patients see their visit history and approved prescriptions; doctors see the patient's history at review time.
4. Multi-hospital *(design MVP-0, delivery MVP-1)*: onboarding a new hospital requires configuration only (a row in the database + a subdomain), zero code changes.
5. Both apps installable as PWAs with fast first load (< 2.5 s LCP on a mid-range Android phone over 4G) *(MVP-0)*.
6. **Responsive across mobile, tablet, and desktop** *(MVP-0)*: both modules are used on phones (patients, and doctors reviewing on the go), tablets, and desktop browsers (doctors at a workstation) — layouts must adapt to each, not just tolerate them. See UI-1 in §5.0.

### Non-Goals (explicitly out of MVP scope)
- Appointment booking / scheduling
- Live queue / token management
- Live consultations with human doctors (chat or video)
- **Video avatar for Dr. Mira** — deferred, but this is the **product's end-state, not a maybe**: the target experience is a video call with a virtual doctor whose animated face speaks, emotes, and lip-syncs in real time. The animated orb is explicitly a *placeholder* for the MVP. Every MVP decision in the conversation/voice pipeline must be made as if the avatar already exists (see A-8 and §6.5).
- Payments and billing
- Pharmacy / lab integrations (e-orders)
- **Native mobile apps** — PWA only for MVP-0/MVP-1, but wrapping both PWAs into native containers for app-store distribution is the planned **later-phase end-state, not a maybe** (see UI-2, §5.0): the frontend architecture should not foreclose it.
- Regulatory certification (HIPAA/ABDM compliance is a design consideration, not an MVP deliverable)

---

## 2A. Riskiest Assumptions (what the MVP must prove)

The MVP is an experiment before it is a product. Each release increment exists to test these assumptions, listed in order of existential risk. If RA-1 fails, no amount of engineering rescues the product.

| # | Assumption | How MVP tests it | Gate / kill signal |
|---|---|---|---|
| **RA-1** | **Licensed doctors will put their name on AI-drafted prescriptions.** Liability comfort, not UX, is the adoption bottleneck. | Recruit **one design-partner hospital and 2–3 named doctors before building the Doctor App**; walk them through mock AI drafts and the audit/immutability model; get written intent to pilot. | **Blocking gate**: Doctor App build does not start until at least 2 doctors at the pilot hospital have reviewed mock drafts and agreed to sign real ones. Kill signal: doctors insist on re-doing the intake themselves. |
| **RA-2** | **Patients will trust and complete a voice consult with a disclosed AI.** | MVP-0 pilot: consult completion rate (started → submitted) and % conducted primarily by voice (§8). | Kill/pivot signal: completion < 40 % or most completions fall back to text — revisit voice-first as the primary medium. |
| **RA-3** | **Draft quality is high enough that review takes < 2 min and ≥ 80 % of drafts are approved with zero/minor edits.** | Measured directly from `reviews` audit data during the pilot; operator audits 100 % of MVP-0 consults via the Consult Trace (§5.4). | Kill signal: sustained approval-with-minor-edits < 50 % or median review > 5 min — the "AI compresses intake" value proposition isn't holding. |

---

## 3. Personas

| Persona | Description | App |
|---|---|---|
| **Patient** | An outpatient of a specific hospital. Uses a phone. Wants quick help without a waiting room. May have limited tech literacy. | Patient App |
| **Doctor** | A licensed physician at the hospital. Reviews AI-drafted consults between (or instead of) in-person visits, working with Dr. Mira as a presenting assistant. Values speed, trustworthy grounding, and safety flags. | Doctor App |
| **Hospital Admin** | Manages the hospital's doctors and branding. MVP: managed via database/console; a dedicated admin UI is phase 2. | (Doctor App, admin role) |
| **Platform Operator** | You. Onboards hospitals, monitors AI quality and costs. | Console/SQL |

---

## 3A. User Roles & Behaviors

This section defines each role precisely — what they do, what they expect, and the assumptions we are designing against. Terminology note: **"customer" and "patient" mean the same role** throughout this document and the codebase (`patient` is the canonical term in code).

### 3A.1 The Customer / Patient

**Who they are & assumptions:**
- Has a sickness or health concern and has typically visited different hospitals over time — so their record history **may or may not exist** in our system. The design must work well for both a first-time patient (empty history) and a returning one (rich history).
- Comes to the Patient App to get their sickness investigated and to learn **the next steps** — which may be just advice, lab tests, or a prescription — exactly what they'd seek from a normal doctor visit.
- Wants help **instantly**: no waiting room, no appointment friction. Instant availability is a core promise of the product.

**Experience expectations (these are design requirements, not nice-to-haves):**
- The doctor they speak to **knows their history** — Mira must load and use whatever record exists before/while speaking, and reference it naturally ("last time you mentioned your asthma…").
- The doctor **observes carefully and correlates** — Mira connects current symptoms with history, prior prescriptions, and allergies, and shows that she's doing so.
- The interaction feels like talking to a real, caring physician (voice-first, empathetic, one question at a time).

### 3A.2 Dr. Mira — the Virtual Doctor

Dr. Mira is a **super expert**: to the user she is one person, but behind the portrayal she can be a receptionist, a primary physician, or a background specialist — potentially **multiple AI agents orchestrated behind one consistent face, voice, and name**. The architecture must allow a multi-agent backend (e.g. an intake agent, a diagnosis agent, a research agent, a records agent) without ever breaking the single-persona illusion.

**Part 1 — With the patient (Patient App):**
1. **Greets** the customer and speaks with empathy, seeking to understand what they are going through and their symptoms.
2. **Asks all the questions a regular doctor would ask** — one at a time, naturally, adapting to the patient's answers.
3. **Runs background checks on the patient's medical history** in the system and correlates with the current complaint where relevant.
4. **Analyzes images or video** the patient shares (e.g. a photo of a rash, a swollen joint) as part of the examination. *(Image analysis: MVP-candidate via Gemini vision; video analysis: later phase.)*
5. Once she has gathered enough data, she **evaluates and forms a diagnosis** — drawing on medical expertise and, if needed, the latest research *(research lookup: later phase, flagged in §9)* — and produces a **probable conclusion and recommendations** (advice / lab tests / prescription).
6. The recommendation is **recorded into the system** and sent to the **real doctor's queue** for approval, rejection, or modification.
7. She does this **concurrently for all patients of the hospital** (see A-10).

**Part 2 — With the real doctor (Doctor App):**
1. When the doctor opens a case (or "calls" her), Mira is **instantly available** and speaks naturally — **assuming the doctor may have already seen the diagnosis/report on screen**, so she confirms rather than re-narrates: brief hand-off, then "does this look right to you, or would you change anything?"
2. If the doctor suggests changes, she **updates the prescription, lab tests, or advice** accordingly and records the revision in the system.
3. **After the doctor's confirmation**, she **notifies the customer**: in-app notification always; and if needed, a **virtual call to the patient** to explain the next steps in person *(outbound Mira call: later phase; MVP notifies in-app/push)*.
4. She then **closes the case**.

### 3A.3 The Real Doctor

**Who they are & assumptions:**
- A licensed physician working "in the background" on the Doctor App — the patient's primary experience is with Mira; the real doctor is the quality and legal gate.
- There are **many real doctors** per hospital, and many hospitals — the queue and Mira sessions must be per-doctor and per-hospital.

**Primary job:**
1. Goes through the **patient list with their investigations and diagnosis summaries** and verifies correctness.
2. If changes are needed, **works with Dr. Mira conversationally** — tells her what to change, she applies it, he reviews the updated version. He can equally **edit the diagnosis, prescriptions, or lab tests manually** — both paths are always available.
3. **Approves** the diagnosis; the case is closed once Mira communicates the outcome to the customer.
4. Can request a **real call with the customer** when the case warrants it: Mira creates the appointment, and the doctor joins the patient through the same Patient App — **video conference in a future phase**.
5. **Gives feedback to Dr. Mira** to improve future performance — corrections, style notes, protocol preferences. Feedback is stored and used to tune prompts/policies over time (and is itself an audit signal).

**Staffing & incentive (pilot requirement):** the queue only works if someone owns it. The pilot agreement must name **who is rostered to watch the queue during clinic hours** (a rota or a designated reviewing doctor per shift) and **how reviews are compensated** (per-review fee, salaried duty, or bundled into OPD load). "Doctors will check it when free" is not a plan — an unwatched queue breaks the instant-availability promise (§3A.1) and triggers the review SLA fallbacks (§3A.5).

### 3A.4 Case lifecycle (shared mental model)

```
active (patient ↔ Mira)
  → pending_review (in real doctor's queue)
    → approved / rejected / changes-applied-and-approved
      → communicated (Mira notifies patient — in-app now, virtual call later)
        → closed
  ↳ escalated (doctor requests real appointment with patient)
```

### 3A.5 Lifecycle edge cases (MVP-0 requirements, not deferrable)

These are the holes that bite in week one of a real pilot; each is a requirement, not a nice-to-have:

- **Review SLA**: a consult in `pending_review` longer than **2 hours during clinic hours** notifies the patient of the delay and escalates to the hospital's admin contact; longer than **24 hours**, the consult expires (`expired`) with an apology message and clear guidance to visit in person. Both timers are per-hospital configuration. The urgent flag (UC-1.7) is independent of this — urgent guidance is delivered immediately regardless of review latency.
- **Abandonment**: an `active` consult with no patient turn for **30 minutes** auto-closes as `abandoned`. The patient can start a fresh consult at any time; Mira may reference the abandoned attempt naturally ("we started talking about your cough earlier…").
- **Rejection path (patient side)**: a rejected consult always shows the doctor's reason and a concrete next step (e.g. "please visit the hospital in person — show this consult at the front desk"). Rejection is never a dead end.
- **Concurrent consults**: **one open consult per patient per hospital.** Tapping "Talk to Dr. Mira" with a consult already `active` resumes it; with one `pending_review`, the patient sees its status and can add a note, but cannot open a second parallel consult.
- **Identity & eligibility**: Google sign-in authenticates the *account*, not the *person* — the health profile is self-attested, and the prescription record notes this. **MVP serves adults (18+) only**, stated at onboarding and enforced via DOB; minors/caregiver flows are explicitly out of scope until a guardian-consent design exists.

---

## 3B. AI Agents

Dr. Mira is one persona backed by a **team of specialist AI agents** (§3A.2). Each agent has a narrow job, its own system prompt/policies, and its own tools; an orchestrator routes work between them. The patient and the real doctor only ever perceive Dr. Mira — agents are an internal architecture, never an interface.

### 3B.1 Agent roster (full vision)

| Agent | Job | Phase |
|---|---|---|
| **Receptionist Agent** | First contact: greets, verifies identity, opens/resumes the case, collects chief complaint and basic vitals-style info, routes to the Doctor Agent. Handles "front desk" queries (status of my prescription, where are my records). | **MVP-1** |
| **Doctor Agent (primary physician)** | The clinical core — detailed in §3B.2. | **MVP-0** |
| **Specialist Agents** (Cardiologist, Dermatologist, Gynecologist, Gastroenterologist, Pediatrician, …) | Domain consultants the Doctor Agent confers with when the case enters their specialty — each with specialty-specific prompting, red-flag lists, and guideline knowledge. Output: a specialist opinion merged into the Doctor Agent's assessment. | Phase 2+ |
| **Lab Technician Agent** | Evaluates uploaded lab reports (blood panels etc.): extracts values, flags out-of-range results, trends them against the patient's history. | Phase 2 |
| **Radiology / X-ray Specialist Agent** | Evaluates X-rays and other imaging the patient or hospital uploads; produces findings for the Doctor Agent (never directly to the patient). | Phase 2+ |
| **Pharmacy Agent** | Checks drafted prescriptions: drug–drug interactions, allergy conflicts (second line of defense after the Doctor Agent's hard rules), dosage sanity by age/weight, local availability/generic substitutions. | Phase 2 |
| **Communication Manager Agent** | Owns all outbound patient communication after approval: notifications, follow-up reminders, the future outbound virtual call (§3A.2), appointment coordination for doctor-requested real calls. | Phase 2 |
| **Billing Specialist Agent** | Consultation charges, invoices, payment status — activates when payments enter scope. | Future |
| **Supervisor Agent** | Quality & safety overseer: audits agent outputs for protocol violations, monitors confidence patterns, ingests real-doctor feedback (`mira_feedback`) and turns it into prompt/policy adjustments; escalates anomalies to the platform operator. | Phase 2 |

### 3B.2 Doctor Agent — detailed specification (MVP)

The Doctor Agent is Mira's clinical brain and carries both of her modes (A-9):

**Patient mode (intake & diagnosis):**
- Conducts the consultation with empathy-first, one-question-at-a-time conversation (voice-primary), exactly per UC-1.
- **Context in**: full patient record — profile, allergies, chronic conditions, medications, prior consults and prescriptions — assembled server-side before the first word; references history naturally and correlates it with the current complaint (§3A.1 expectations).
- **Examines media**: analyzes patient-shared photos (rash, wound, swelling) via Gemini vision (video: later), feeding findings into the assessment.
- **Safety hard rules**: allergy classes never prescribed, age/pregnancy constraints, red-flag symptom → urgent escalation with spoken emergency guidance. These are server-injected and non-negotiable (A-3).
- **Output**: probable diagnosis + structured recommendation (advice / lab tests / prescription items with dosage, timing, plain-language "why"), confidence level, and safety flags for the reviewing doctor → recorded and queued (`pending_review`).

**Coordinator mode (case presentation & revision):**
- Instantly available when a real doctor opens a case; presents SBAR-style assuming the doctor may have already seen the report — confirm, don't re-narrate (§3A.2).
- Answers the doctor's free-form questions grounded in the stored record with on-screen citations (D-8); never fabricates history.
- Applies the doctor's requested changes to prescription/lab tests/advice as an on-screen draft revision (D-9); the doctor always signs explicitly in the UI.
- After approval, triggers patient notification and case closure (Communication Manager's job once it exists; Doctor Agent handles it in MVP).
- Receives and records the doctor's feedback (`mira_feedback`) for operator review.

**In MVP-0 the Doctor Agent runs alone** (covering the Receptionist's greeting/resume duties inside its intake stage); the Receptionist splits out in MVP-1. Either way, the orchestration layer (Edge Function) must expose them as distinct logical agents from day one so splitting them into separate models/prompts later is a config change, not a refactor.

### 3B.3 Orchestration principles

1. **One persona, many agents**: hand-offs between agents are invisible — same voice, same name, no "let me transfer you".
2. **Orchestrator = Edge Function layer**: routes turns to the right agent, assembles context, merges specialist outputs, enforces quotas (A-5) and safety rules (A-3).
3. **Every agent's output is recorded** (`ai_drafts`, `consult_messages`, `review_messages`) — the real doctor and the Supervisor Agent can always trace *which* agent said *what*.
4. **Agents are config, not code**: an agent = system prompt + model choice + tool allowlist + policies, stored per deployment (later per hospital in `hospitals.ai_config`), so adding a Dermatologist Agent is configuration plus evaluation, not a rebuild.

---

## 4. Primary Use Cases

### UC-1: Patient completes a voice consult with Dr. Mira
1. Patient opens `⟨hospital⟩.vd.app/patient`, signs in with Google (first time: completes a short health profile — DOB, sex, blood group, allergies, chronic conditions).
2. Taps "Talk to Dr. Mira". The experience is a **call**: the orb animates to listening/thinking/speaking states, and Dr. Mira greets the patient aloud by name — including a brief, warm disclosure that she is an AI doctor and that a human doctor reviews everything.
3. The patient simply **speaks**. Speech is transcribed live (interim transcript visible on screen); when the patient finishes, Dr. Mira responds in a natural, empathetic voice — acknowledging feelings first, then asking one question at a time, exactly as a caring physician would on a phone call.
4. Text input remains available throughout as a secondary channel — for spelling a medicine name, answering privately in a public place, or when the microphone is unavailable. Voice and text turns mix freely in one conversation.
5. The AI knows the patient's profile (age, allergies, history) and enforces hard safety rules (e.g. never suggest a drug class the patient is allergic to).
6. After enough exchanges (~4–6 patient replies) Dr. Mira wraps up aloud — summarizing what she heard and what she's recommending — while the app shows the structured draft: consult summary, confidence, safety flags, urgency, and recommendation (prescription items or investigations) with plain-language "why" per item.
7. If the AI detects red-flag symptoms, it sets urgency **urgent** and clearly *tells* the patient to seek in-person emergency care now — spoken and shown prominently — and the consult is flagged at the top of the doctor queue.
8. The consult enters status `pending_review`. The patient sees "A doctor is reviewing your consultation" with the AI's summary (clearly labeled *not yet approved*).

### UC-2: Dr. Mira presents the case; the doctor reviews and approves
1. Doctor opens `⟨hospital⟩.vd.app/doctor`, signs in with email/password.
2. Sees the review queue for their hospital, ordered by urgency then age. Each card: patient name/age, chief complaint, AI confidence, safety flags.
3. Opens a consult. Dr. Mira **presents the case aloud**, concisely, in clinical hand-off style: "Alex Kumar, 34, male — two weeks of productive cough, no fever, penicillin-allergic. My assessment is … I'm recommending … because …". The structured view (transcript, AI note, editable draft, patient profile + history side panel) is on screen throughout.
4. The doctor converses with Mira naturally, as with an assisting subordinate doctor: "Has he had this before?", "What was his last prescription?", "Why not an X-ray?" — Mira answers instantly from the full patient record (profile, prior consults, prescriptions, and later lab results). Voice or text, the doctor's choice; the presentation can also be skipped entirely for silent visual review.
5. The doctor can direct edits conversationally ("make that 5 days, add a gastric protectant") — Mira updates the draft on screen; the doctor always confirms the final version visually before signing.
6. Doctor **approves** as-is, **edits** then approves, or **rejects** with a reason (e.g. "needs in-person examination") — rejection includes a message to the patient. The approval action itself is always an explicit UI action by the authenticated doctor, never voice-triggered.
7. On approve, the consult becomes an immutable, doctor-attributed prescription record. The patient is notified via web push (MVP, §9.1) plus in-app status; on iOS Safari, where push is unreliable, in-app status is the guaranteed path.

### UC-3: Patient views records
1. Patient opens "My records": chronological list of consults with status (in review / approved / needs in-person visit).
2. An approved consult shows the doctor's name, date, prescription items with dosage/timing/notes, advice, and can be downloaded/shared as a PDF-style view.
3. Health profile is editable by the patient (allergy changes take effect for future consults).

### UC-4: Platform operator onboards a hospital
1. Operator inserts a hospital row (name, slug, logo, theme colors) and creates doctor accounts.
2. A DNS wildcard already covers `*.vd.app`; the platform resolves the tenant from the subdomain and the app from the first path segment (`/patient`, `/doctor`) at runtime.
3. The hospital's Patient App and Doctor App are immediately live with the hospital's branding (name, logo, accent color via CSS variables).

---

## 5. Functional Requirements

### 5.0 Cross-cutting: Responsive UI & native-shell readiness (both modules)
- **UI-1** *(MVP-0)* **Adaptive layout, not just "doesn't break."** Both the Patient App and Doctor App are used across phones, tablets, and desktop browsers — a patient may consult from a phone, a doctor may review from a tablet on rounds or a desktop at a workstation. Layouts must be designed mobile-first and reflow deliberately at tablet/desktop breakpoints (e.g. the Doctor App's queue + review screen goes from stacked single-column on phone to a two/three-pane layout on desktop), not simply scale a phone or desktop layout up/down. Touch targets, the voice orb, and the review screen's side panels are all specified per breakpoint, not assumed.
- **UI-2** *(later phase, not MVP)* **Native app container.** The long-term plan is to wrap both PWAs in native containers (e.g. Capacitor/Trusted Web Activity) for app-store distribution, mirroring the video-avatar pattern (§2 Non-Goals): deferred, but the end-state, not a maybe. Every MVP-0/MVP-1 frontend decision should assume this eventually happens: avoid browser-only APIs with no native equivalent, keep platform-specific code (notifications, storage, mic access) behind an abstraction rather than scattered through components, and don't build UI that assumes a browser chrome (URL bar, browser-back) is always present. This costs little now and avoids a rewrite later.

### 5.0.1 Cross-cutting: Shared AI Voice Agent Component — the Dr. Mira Consultation Interface (`<MiraPresence>`)

The single most important shared building block in the product is **the AI-voice-agent consultation interface itself** — the surface where Dr. Mira appears, speaks, listens, and surfaces her suggestions. It is *not* a patient-app screen that the doctor app happens to reuse; it is a **first-class, cross-cutting component** deliberately designed to be dropped into *any* module — patient today, doctor today, **pharmacy/lab/admin tomorrow** — and configured to that context. The patient module, doctor module, and any future module all consume the *same* component; they differ only by configuration, never by forking the interface. This component is where the bulk of the product's UX investment and reuse discipline must go — get it right once, reuse it everywhere.

**Design intent (why this is its own section):** an AI agent that *talks to a human and shows relevant suggestions on screen* is a pattern that recurs at every point of care — Mira talking to the *patient* (empathetic intake), to the *doctor* (case coordinator / peer Q&A), and later to the *pharmacist* (dispensing checks, interaction warnings), the *lab tech*, or a hospital *admin*. Rather than rebuild a voice UI per module, the platform provides one **reusable, flexible, highly configurable** component whose audience, persona, layout, and on-screen affordances are all driven by props/config. The same shell that talks to a patient can talk to a pharmacist by changing configuration, not code.

- **MC-1** *(MVP-0)* **One shared component, many contexts.** The consultation interface lives in `packages/ui` as `<MiraPresence>` (backed by the `packages/voice` engine, §6.1) and is the *only* voice-agent surface in the product. The patient module (Mira in patient mode) and doctor module (Mira in coordinator mode) both mount this same component; no module ships its own voice UI. Adding a future module (pharmacy, lab, admin) means **configuring** this component for that audience, not writing a new one.
- **MC-2** *(MVP-0)* **Configurable by context/audience.** The component is driven entirely by declarative configuration, including at minimum: the **audience/role** it is addressing (`patient` | `doctor` | `pharmacist` | `lab` | `admin` | …), the **Mira persona/mode** and system-prompt/agent binding for that audience (§5.3 A-9), the **conversation context** injected server-side (which patient/consult record, prior visits, etc.), the **branding/theme tokens** (per-hospital accent, logo, dark/light — §5.5 T-3), the **enabled channels** (voice, text, or both) and turn-taking behaviour, and the **copy/disclosure** shown (e.g. the AI-disclosure badge, P-3b). Switching from "talk to the patient" to "talk to the doctor" to "talk to the pharmacist" is a configuration change, never a fork.
- **MC-3** *(MVP-0)* **Configurable suggestion / action surface.** Alongside the speaking agent, the component renders a **context-relevant suggestions panel** whose content and actions are configurable per audience: for the patient these are follow-up prompts, the emerging draft summary, and safety flags; for the doctor they are the case presentation, the editable draft, record citations, and approve/edit controls (D-3, D-7–D-9); for a future pharmacist they might be interaction warnings and substitution options. The *component* owns the layout, state, and voice↔panel synchronization; each module supplies the audience-specific suggestion/action content via configuration and slots. Actions that carry legal/clinical weight (e.g. signing a prescription) are always explicit authenticated UI actions surfaced by the host module, never executed by voice (consistent with D-9).
- **MC-4** *(MVP-0)* **Minimizable orb ⇄ maximized consultation.** The component has two primary presentations and animates between them: a **minimized orb** — a small, unobtrusive floating orb that indicates Mira's presence and state (idle/listening/thinking/speaking) at a glance — and a **maximized consultation view** — the full interface with the larger presence, live/interim transcript, and the suggestion/action panel. Tapping the orb **maximizes**; a control on the maximized view **minimizes** back to the orb. Both presentations are driven by the same underlying session and state machine, so minimizing never drops the conversation.
- **MC-5** *(MVP-0)* **Persistent floating overlay, always reachable.** In minimized (orb) form the component can **float on top of any interface** in the host module — over the records list, the doctor's queue, a settings page — so Mira is always one tap away without navigating away from the current task. Position is sensible per breakpoint (UI-1), avoids occluding critical controls, is dismissable, and (where it makes sense) its last position/state is remembered. The overlay is an app-shell-level concern so it can persist across in-module navigation rather than being torn down per route.
- **MC-6** *(MVP-0)* **Presence is swappable; the contract is stable (avatar-ready).** The component treats "Dr. Mira's presence" as a swappable implementation behind a stable contract (orb today, animated video-avatar later — §2 Non-Goals, §6.5, A-8), driven by the shared listening/thinking/speaking state machine and audio timeline (word/phoneme timestamps, visemes where available). Swapping orb → avatar, or restyling the presence per deployment, must not touch the host modules — they depend only on the component's configuration contract.
- **MC-7** *(MVP-0)* **Accessible and channel-flexible.** Because it is used by patients on phones and clinicians on desktops alike, the component meets the same responsive rules as everything else (UI-1) and is fully operable by text alone when voice is unavailable or undesired (P-3a) — voice and text are configurable, co-equal channels within one session, and every spoken turn has a synchronized on-screen text equivalent for accessibility.

**Architecture note:** the reuse discipline above is exactly why `packages/voice` (the conversation engine) and `<MiraPresence>` (the presence + consultation shell) live in shared packages consumed by every module (§6.1) — "one voice/presence stack, two personas [today], N modules of one PWA." Any capability added here (a new persona, a new suggestion type, the avatar) becomes available to every module by configuration, not by per-module reimplementation.

- **P-1** Google sign-in (Supabase Auth OAuth). Session persists across PWA launches.
- **P-2** First-run health profile wizard; editable later. Fields: full name, DOB, sex, blood group, allergies (structured list), chronic conditions, current medications.
- **P-3** **Voice-first consult UI** with the Dr. Mira orb (reuse prototype's visual identity and listening/thinking/speaking states). Hands-free turn-taking: automatic end-of-speech detection (with tap-to-finish fallback), live interim transcript, Dr. Mira's replies spoken aloud with synchronized text.
- **P-3a** Text input always available as a secondary channel within the same conversation (mixed voice/text turns); full consult possible by text alone if the mic is denied or unavailable.
- **P-3b** AI-disclosure: Dr. Mira verbally introduces herself as an AI at the start of every consult, and a persistent visual badge states "AI doctor — reviewed by a human physician".
- **P-3c** Voice quality: natural, warm, empathetic synthesis (cloud neural TTS, streamed); latency budget of < 1.5 s from patient end-of-speech to first audio of the reply.
- **P-4** Consult status tracking: draft → pending_review → approved / rejected.
- **P-5** Records list + prescription detail view + shareable/printable prescription.
- **P-6** PWA: installable, app icon/name per hospital brand, offline shell (records cached read-only; consults require connectivity); responsive per UI-1 (§5.0) across phone, tablet, desktop.
- **P-7** Emergency interstitial when the AI flags urgent symptoms.

### 5.2 Doctor App
- **D-1** Email/password sign-in; accounts provisioned per hospital (no self-signup).
- **D-2** Review queue: filter by status, sorted urgent-first; real-time updates when new consults arrive (Supabase Realtime).
- **D-3** Consult review screen: transcript, AI note, editable draft recommendation, patient profile + history side panel.
- **D-4** Approve / edit-and-approve / reject with reason. Every action is audited (who, when, what changed vs the AI draft).
- **D-5** Approved prescriptions are immutable; corrections create a superseding version.
- **D-6** PWA: installable on desktop, tablet, and phone; responsive per UI-1 (§5.0) — the review queue and consult screen adapt their layout across all three, since doctors review both at a workstation and on the go.
- **D-7** *(MVP-1)* **Voice case presentation**: on opening a consult, Dr. Mira presents the case aloud in clinical hand-off style (SBAR-like: patient, situation, assessment, recommendation) via the same `<MiraPresence>` component the patient app uses. Skippable/muteable per doctor preference (persisted).
- **D-8** *(MVP-1)* **Ask-Mira Q&A**: the doctor can ask Mira free-form questions (voice or text) about the patient — history, prior consults and prescriptions, allergies, and (phase 2) lab results — answered from the patient's full record within the hospital's RLS boundary. Every Mira answer cites the underlying record on screen so the doctor can verify at a glance.
- **D-9** *(MVP-1)* **Conversational edits**: the doctor can dictate changes to the draft ("5 days instead of 3", "swap to azithromycin"); Mira applies them to the on-screen draft. Signing/approval is always an explicit authenticated UI action — never executable by voice.

### 5.3 AI Service
- **A-1** All AI calls go through a **Supabase Edge Function** — the AI provider (Google Gemini) API key never ships to the browser (replacing the prototype's localStorage-key approach).
- **A-2** Model: `gemini-2.5-flash` (primary — Google Gemini, chosen over Claude on cost) with per-hospital model override; structured JSON output contract carried over from the prototype (reply, note, confidence, flags, done, recommendation).
- **A-3** Hard safety rules injected server-side: patient allergies, age-based constraints, emergency escalation rules. The client cannot alter the system prompt.
- **A-4** Full conversation + raw AI outputs are stored for doctor review and audit.
- **A-5** Cost guardrails: max turns per consult, max tokens per call, per-hospital daily consult quota — covering LLM, STT, and TTS spend.
- **A-6** **Voice pipeline** (the heart of the product): streaming speech-to-text for the patient's audio → LLM turn → streaming neural text-to-speech for Dr. Mira's reply. Both STT and TTS run through server-side proxies (keys never in the browser). The reply is spoken as it streams — TTS starts on the first sentence of the LLM output rather than waiting for the full response — to hit the < 1.5 s conversational-latency target.
- **A-7** One consistent Dr. Mira **voice persona** per deployment (selectable per hospital later): warm, unhurried, natural prosody. The persona is a product asset — voice choice, speaking rate, and phrasing style are specified and tested, not defaults.
- **A-8** The voice architecture must be **avatar-ready by design**, because the avatar is the roadmap's destination (§6.5): the TTS interface must expose word/phoneme timestamps and (where the provider supports it) visemes, and the UI must treat "Dr. Mira's presence" as a swappable component — orb today, animated face later — driven by the same listening/thinking/speaking state machine and audio timeline.
- **A-9** **Two personas, one Mira, full context**: Mira runs in *patient mode* (empathetic clinician conducting intake) and *coordinator mode* (concise clinical presenter and assistant answering a peer doctor). Both modes share the same patient context — profile, consult transcript, prior visits and prescriptions — assembled server-side per consult. Coordinator-mode answers must be grounded in the stored record (with on-screen citations, D-8), not free recall. Per §3A.2 and the agent roster in §3B, Mira is **multiple agents behind one persona** (Doctor Agent alone in MVP-0; Receptionist split in MVP-1; specialists, lab, pharmacy, communication, supervisor later); the Edge Function layer is the orchestrator, and nothing about the multi-agent internals may ever leak into the user-facing voice or identity.
- **A-10** **Concurrency**: many patients and many doctors converse with "their" Mira simultaneously. Each conversation is an independent stateless-server session (context rebuilt from the database per turn), so scaling is horizontal by design; per-hospital quotas (A-5) bound aggregate spend.

### 5.4 Consult Trace & Observability (MVP-0)

Every consult must be reconstructable, end to end, in one place — a **Consult Trace**: a single chronological timeline of everything that happened in a case. This is a first-class MVP-0 requirement (the operator audits 100 % of MVP-0 consults per RA-3, and doctor trust depends on transparency per R-5), and the data architecture must be designed for it, not retrofitted.

- **O-1** **Trace timeline view**: for any consult, one chronological view showing every event in order — patient sign-in/consult start, each Mira question and patient answer (voice or text, with channel noted), media shared, each agent's analysis output (draft diagnosis, confidence, safety flags — attributed to the logical agent that produced it, per §3B.3), queue entry, which doctor opened it and when, the doctor↔Mira review conversation, the doctor's action (approved/edited/rejected, with the draft-vs-final diff), the notification sent to the patient, and closure. Readable top-to-bottom like a log viewer.
- **O-2** **Search & filter across consults**: find consults by patient, doctor, hospital, status, urgency, date range, and free-text search over transcript and draft content. Results open directly into the trace timeline.
- **O-3** **Access scoping**: the platform operator sees traces across hospitals (console-level in MVP-0); doctors and hospital admins see only their hospital's traces under the same RLS boundary as everything else; patients see their own consult history via UC-3 (not the internal trace).
- **O-4** **Export**: a trace is exportable as a single document (JSON + printable view) for audits, incident review, and doctor feedback discussions.

**Architecture requirement**: the trace is cheap because the store is designed for it — every step already lands in an append-only table (`consult_messages`, `ai_drafts`, `review_messages`, `reviews`, `consult_media`, `prescriptions`) with timestamps and actor attribution. Two additions make the timeline complete: (1) a `consult_events` table records the transitions and system actions that aren't messages (status changes, queue entry, doctor opened, notification sent, SLA escalations per §3A.5); (2) a `consult_trace` database view unions all of these into one time-ordered stream per consult, which is what the trace UI and search read. Nothing in the flow may bypass these tables — if it isn't in the trace, it didn't happen.

### 5.5 Multi-Tenancy

*(Design — schema, RLS, theming tokens — is MVP-0; delivery — subdomain resolution, per-tenant manifests, onboarding — is MVP-1. MVP-0 seeds the single pilot hospital directly.)*

- **T-1** *(MVP-1)* Tenant resolved from subdomain, module from path (`citycare.vd.app/patient` → hospital slug `citycare`, patient module; `citycare.vd.app/doctor` → doctor module). The path scheme leaves room for future modules (e.g. `/pharmacy`).
- **T-2** Every domain table carries `hospital_id`; Postgres **Row Level Security** enforces that patients see only their own rows and doctors see only their hospital's rows. Isolation is enforced in the database, not in application code.
- **T-3** Per-hospital theming via CSS variables (accent color, logo, display name) loaded from the hospital record; PWA manifest generated per tenant.
- **T-4** Patients belong to one hospital per account context (a patient of two hospitals has two memberships; data never crosses).

---

## 6. Architecture Overview

*(High level only — the detailed phased Action Plan follows PRD approval.)*

### 6.1 Frontend: one PWA, per-module entry points

Monorepo (npm workspaces + Turborepo optional) with **Vite + React 19 + TypeScript**. The layout below is **illustrative, not prescriptive** — package boundaries (one web app with per-module routes, shared voice/ui/api packages) are the requirement; exact names and nesting are the implementer's call:

```
virtual-doctor/
├── apps/
│   └── web/              # single Vite app → the one PWA (shared shell + router)
│       └── src/
│           ├── shell/        # configurable header/nav/footer (per-module config)
│           ├── router.tsx    # maps first path segment → module, lazy-loads its chunk
│           └── modules/
│               ├── patient/  # patient module (entry: /patient)
│               └── doctor/   # doctor module  (entry: /doctor)   — future: pharmacy/, …
├── packages/
│   ├── ui/               # shared component library (buttons, cards, MiraOrb, layout primitives)
│   ├── theme/            # design tokens as CSS variables (light/dark + per-hospital accent)
│   ├── api/              # typed Supabase client, queries, generated DB types
│   ├── voice/            # voice engine: mic capture, streaming STT client, TTS playback,
│   │                     #   turn-taking state machine (provider-agnostic interface)
│   ├── core/             # shared domain logic (consult state machine, validation/Zod schemas)
│   └── config/           # shared tsconfig / eslint / vite base config
└── supabase/
    ├── migrations/       # SQL schema + RLS policies
    └── functions/        # Edge Functions (ai-consult, voice-token, tenant-manifest)
```

- **One Vite build → one deploy → one origin per hospital.** Download isolation comes from route-level module code-splitting (`manualChunks`, one chunk per module), not from separate builds: `/patient` never loads the `/doctor` chunk and vice versa. A CI import-boundary rule keeps the modules independently splittable — a module may import the shell and any `packages/*` but never another module (see ARCHITECTURE DEC-19).
- **Both modules are voice apps.** `packages/voice` (the conversation engine) and `<MiraPresence>` in `packages/ui` are consumed by *both* the patient module (Mira in patient mode) and the doctor module (Mira in coordinator mode) — the strongest driver of the shared-library architecture: one voice/presence stack, two personas, two modules of one PWA.
- One `vite-plugin-pwa` service worker for the PWA, with a distinct manifest `scope`/`start_url` **per module** so patient and doctor remain independently installable home-screen apps from the single deployment.
- Styling: **CSS variables** for all design tokens (`--vd-accent`, `--vd-surface`, spacing/typography scale) defined in `packages/theme`; components in `packages/ui` consume tokens only, so hospital branding and dark mode are runtime variable swaps with zero component changes. Lightweight styling via CSS modules (no runtime CSS-in-JS — keeps bundles small and paint fast).
- State/data: TanStack Query over the Supabase JS client; Supabase Realtime subscription for the doctor queue.

### 6.2 Performance budget
- < 2.5 s LCP on mid-range Android / 4G; JS budget ≤ 150 KB gzipped initial per module (CI-enforced size budget — ARCHITECTURE DEC-19).
- Route-level code splitting; the AI consult screen and records screens lazy-loaded.
- Fonts self-hosted and preloaded; the MVP presence (orb) stays CSS/SVG (as in the prototype), no canvas/WebGL. The future avatar will be lazy-loaded behind the `<MiraPresence>` contract (§6.5) so it never taxes the initial bundle.

### 6.3 Backend: Supabase
- **Postgres + RLS** for all domain data (free tier to start; clear upgrade path).
- **Supabase Auth**: Google OAuth (patients), email/password (doctors); JWT carries role + hospital membership claims consumed by RLS.
- **Edge Functions** (Deno) for the AI proxy and any privileged operations.
- **Voice services**: cloud STT and neural TTS accessed via server-side token minting (short-lived scoped tokens issued by an Edge Function; audio streams directly between browser and voice provider over WebSocket to keep latency low). Provider choice is an open question (§9) — candidates: Deepgram/AssemblyAI for streaming STT; ElevenLabs/Azure Neural/Google Chirp for empathetic TTS. Browser Web Speech API is the free-tier fallback only, not the primary experience.
- **Realtime** for the doctor review queue.
- **Storage** for patient-shared consult images (MVP-1, per §9.1) and lab-report uploads (phase 2), bucket-scoped per hospital with RLS-backed access policies.

### 6.4 Database schema (core tables)

```
hospitals        id, slug (unique), name, logo_url, theme jsonb, ai_config jsonb, created_at
profiles         id (= auth.users.id), full_name, role ('patient'|'doctor'|'admin'), created_at
memberships      id, profile_id, hospital_id, role, UNIQUE(profile_id, hospital_id)
patient_details  profile_id PK, dob, sex, blood_group, allergies jsonb, conditions jsonb,
                 medications jsonb, updated_at
consults         id, hospital_id, patient_id, status
                 ('active'|'pending_review'|'approved'|'rejected'|'escalated'
                  |'communicated'|'closed'|'superseded'
                  |'abandoned'|'expired'),   -- lifecycle per §3A.4 + edge cases §3A.5
                 chief_complaint, urgency, ai_confidence, ai_flags jsonb,
                 created_at, submitted_at
consult_messages id, consult_id, sender ('patient'|'ai'), content, ai_note, created_at
review_messages  id, consult_id, doctor_id, sender ('doctor'|'ai'), content,
                 citations jsonb, created_at   -- doctor↔Mira case discussion (audited)
ai_drafts        id, consult_id, raw_response jsonb, recommendation jsonb, created_at
prescriptions    id, consult_id, hospital_id, patient_id, doctor_id,
                 items jsonb, advice, edited_from_draft boolean,
                 supersedes_id nullable, approved_at
reviews          id, consult_id, doctor_id, action ('approved'|'edited'|'rejected'
                 |'escalated'), reason, diff jsonb, created_at   -- audit trail
mira_feedback    id, hospital_id, doctor_id, consult_id nullable, feedback,
                 category ('correction'|'style'|'protocol'), created_at
                 -- doctor feedback to improve Mira (§3A.3.5); reviewed by operator,
                 -- applied as prompt/policy updates
consult_media    id, consult_id, kind ('image'|'video'), storage_path, ai_findings
                 jsonb, created_at   -- patient-shared photos/videos (§3A.2)
consult_events   id, consult_id, hospital_id, event_type ('status_change'|'queued'
                 |'doctor_opened'|'notification_sent'|'sla_escalated'|'expired'
                 |'system'), actor ('patient'|'ai'|'doctor'|'system'), actor_id
                 nullable, payload jsonb, created_at
                 -- append-only; transitions & system actions not captured as
                 -- messages, so the full flow is reconstructable (§5.4)
```

Plus a **`consult_trace` view**: a time-ordered UNION of `consult_messages`, `ai_drafts`, `review_messages`, `reviews`, `consult_media`, `prescriptions`, and `consult_events` per consult — the single read model behind the Consult Trace timeline and search (O-1/O-2). All source tables are append-only, so the trace is complete by construction.

RLS sketch: patients `patient_id = auth.uid()` on consults/prescriptions and own `patient_details`; doctors `hospital_id IN (their memberships)` with role `doctor`; `ai_drafts` writable only by the Edge Function (service role); `prescriptions` insertable only via the approval flow.

---

### 6.5 Product vision: from orb to virtual avatar

The end-state experience is a **video call with Dr. Mira** — a virtual doctor with an animated face that speaks with lip-sync, natural expressions, and empathetic body language. The MVP ships the same conversation with the orb standing in for the face. To keep that upgrade a component swap rather than a rewrite:

- **`<MiraPresence>` abstraction** in `packages/ui`: a single component contract that receives the conversation state (idle / listening / thinking / speaking), the live audio stream, and per-word timestamps. MVP implements it as `OrbPresence`; the future `AvatarPresence` (WebGL/video-based, e.g. viseme-driven 3D head or a streamed avatar service like HeyGen/D-ID/Soul Machines) implements the same contract.
- **Timing data preserved end-to-end**: the voice pipeline (A-6/A-8) keeps word-level timestamps and viseme data flowing to the presence layer even though the orb only needs coarse states — so lip-sync needs no new plumbing.
- **Emotion channel**: the LLM already returns structured metadata per turn; a lightweight `tone` field (e.g. reassuring / concerned / cheerful) will be added to the response contract when the avatar lands, and can be trialed earlier by modulating TTS style.
- **Layout designed as a call screen** from day one: full-height presence area with transcript/chat as an overlay drawer — the same layout works for orb and face.

## 7. Security, Privacy & Safety

- Health data is sensitive: TLS everywhere, RLS as the isolation backbone, no PHI in logs or analytics, AI provider calls proxied server-side.
- AI safety: allergy/interaction hard rules in the server-side prompt; the doctor is the mandatory human-in-the-loop for every prescription; urgent-flag consults surface an immediate "seek emergency care" message independent of doctor review latency.
- Auditability: every doctor action recorded with the diff between AI draft and approved prescription; the full case flow — every Mira/patient turn, agent analysis, doctor review, and outbound communication — is reconstructable and searchable via the Consult Trace (§5.4).
- Prominent disclosure to patients that Dr. Mira is an AI — spoken by Dr. Mira herself at the start of each consult and shown as a persistent badge — and that a human doctor approves all recommendations.
- Voice privacy: microphone access requested with clear explanation; audio streamed for transcription only (raw audio not retained — decided, §9.1); transcripts stored under the same RLS isolation as all other consult data.

## 8. Success Metrics
- Median intake-to-approved-prescription time < 30 minutes during clinic hours.
- ≥ 80 % of AI drafts approved with zero or minor edits (quality signal).
- Consult completion rate (started → submitted) ≥ 70 %, with ≥ 60 % of completed consults conducted primarily by voice (validates the core interaction model).
- p50 end-of-speech → first reply audio < 1.5 s; p95 < 3 s (both patient and doctor conversations).
- Median doctor time-in-consult (open → decision) < 2 minutes; ≥ 50 % of doctors keep Mira's spoken presentation enabled after their first week (trust signal).
- Lighthouse PWA + Performance ≥ 90 on both modules.
- New-hospital onboarding < 1 hour of operator effort.

## 8A. Risks & Mitigations

| # | Risk | Likelihood / Impact | Mitigation |
|---|---|---|---|
| **R-1** | **Doctor liability concerns stall adoption** — doctors decline to sign AI-drafted prescriptions, or hospital leadership blocks the pilot. | Med / **Fatal** | Design-partner gate before Doctor App build (RA-1, §2A); immutable audit trail with draft-vs-approved diff (D-4/D-5); doctor can always reject to in-person; feedback channel (`mira_feedback`) gives doctors control over Mira's behavior. |
| **R-2** | **Voice latency target (< 1.5 s) unachievable on real Indian 4G** — the conversation feels laggy, undermining the core interaction. | Med / High | Streaming end-to-end (A-6) with TTS starting on first sentence; text channel always available (P-3a) with graceful degradation on poor networks as an explicit requirement; measure p50/p95 from the pilot's real devices, not lab conditions. |
| **R-3** | **Unit economics don't close** — voice (STT+TTS) + LLM cost per consult (~₹3–15 voice alone) exceeds what a small hospital will pay per consult. | Med / High | Per-consult cost tracked from day one (A-5 covers LLM+STT+TTS spend); per-hospital quotas; provider choice (§9.1, decided: Deepgram + Google Chirp 3 HD) made on cost *and* quality; cheaper TTS tier acceptable for MVP if empathy holds up in testing. |
| **R-4** | **iOS Safari PWA limitations** — web push restrictions, mic permission quirks, and install friction degrade the patient experience on iPhones. | High / Med | Web push is MVP (§9.1) but not guaranteed on iOS Safari; in-app status is the fallback notification path there regardless; mic-denied flow fully supported via text (P-3a); publish a stated browser-support matrix with the pilot; Android-first pilot cohort acceptable for MVP-0. |
| **R-5** | **AI quality failures** — missed red flags, hallucinated history in coordinator answers, or unsafe drafts erode doctor trust faster than it can be rebuilt. | Med / **Fatal** | Server-side hard safety rules (A-3); operator audits 100 % of MVP-0 consults (RA-3); coordinator answers must cite the stored record on screen (D-8); urgent-flag path independent of review latency (§7); Supervisor Agent in phase 2. |
| **R-6** | **Queue goes unwatched** — no doctor reviews consults promptly, breaking the instant-care promise and stranding patients. | High / High | Staffing/incentive named in the pilot agreement (§3A.3); review SLA with patient notification, admin escalation, and 24 h expiry (§3A.5); urgent consults surface emergency guidance immediately regardless (§7). |
| **R-7** | **Voice-provider volatility** — STT/TTS vendor pricing, free-tier terms, or model quality can change at any time (this is an industry-wide pattern, not specific to Deepgram/Google) — mid-pilot or long after launch. | Low / Med | `packages/voice` defines a provider-agnostic interface (§6.1) that both STT and TTS must go through — no call site talks to a vendor SDK directly; server-side token minting isolates provider credentials from client code; avatar-readiness contract (A-8) already forces a clean abstraction boundary. **This is a standing architectural constraint, not a one-time decision**: any future provider swap (STT or TTS, e.g. to Sarvam AI, Azure, ElevenLabs) should be a config/adapter change behind this interface, never a rewrite. |

## 9. Open Questions & Decisions

### 9.1 Decided (previously open — defaults adopted in v0.2; veto during review if you disagree)
- **Audio retention (was Q2a)** — **Decided: transcripts only for MVP.** Raw patient audio is streamed for transcription and not retained; lighter privacy burden, transcripts carry the audit value. Revisit if QA needs emerge.
- **Languages (was Q3)** — **Decided: architect for i18n, ship English first.** All user-facing strings externalized and the voice pipeline provider-selected with Indic-language support in mind; Kannada/Telugu/Hindi are fast-follows, not MVP.
- **Doctor App voice sequencing (was Q6)** — **Decided: MVP-1.** The Doctor App ships visual-first in MVP-0; coordinator-mode voice (D-7 – D-9) lands in MVP-1 reusing the proven patient voice stack. (Reflected in the §2 release ladder.)
- **Domain scheme (was Q1, decided in review)** — **One subdomain per hospital, modules as path segments**: `⟨hospital⟩.vd.app/patient` and `⟨hospital⟩.vd.app/doctor`, extensible to future modules (`/pharmacy`, …). One wildcard cert/DNS entry covers all tenants; the subdomain resolves the tenant, the first path segment selects the module. Per-tenant PWA manifests are served per subdomain. (Needed by MVP-1; MVP-0 pilots on a single dev domain.)
- **Image sharing (was Q7)** — **Decided: MVP-1 for photos; video later.** Gemini vision makes analysis straightforward, but upload UX + storage policies don't belong in the smallest loop-validating build. Related later-phase items remain flagged in §3A: Mira's live research lookup, outbound virtual call, doctor-joined video conferences.
- **Voice provider (was §9.2 #1)** — **Decided: Deepgram (streaming STT) + Google Chirp 3 HD (TTS).** Deepgram's $200 signup credit (no card required) covers MVP-0 pilot volume outright (~430 hours of audio at Nova-3 rates). Google Chirp 3 HD's free tier (1M characters/month, recurring) covers roughly 250 five-minute consults/month at no cost, with strong voice quality. Both sit behind the provider-agnostic `packages/voice` interface (R-7), so either can be swapped later — e.g. to Sarvam AI, whose Indic-language-native TTS may be the better long-term fit once Kannada/Telugu/Hindi fast-follows (§9.1 languages) are underway. Per-consult cost at these rates is ~₹6–12 (see R-3, §8A).
- **Notifications (was §9.2 #1)** — **Decided: web push is MVP**, not a later enhancement. Patients are notified the moment a consult is approved, without needing the app open. iOS Safari's push limitations (R-4, §8A) mean in-app status remains the guaranteed fallback there — push is additive, not the only path, and the Android-first pilot cohort (R-4) sidesteps the gap for most of MVP-0.
- **Doctor assignment (was §9.2 #2)** — **Decided: single doctor for MVP-0**, so routing is moot at pilot scale — every consult goes to the one reviewing doctor. The schema and queue mechanism are already assignment-free/hospital-wide (§5.2, §6.4 `consults.hospital_id`), so adding more doctors to the shared queue later requires no redesign. **Later phase**: a specialty-aware "Doctor Queue" — routing consults to the doctor whose expertise matches the case — layers on top once there are enough doctors and specialties to route between; it's a natural pairing with the Specialist Agents (§3B.1, Phase 2+) and should reuse their specialty tagging rather than inventing a second taxonomy.

### 9.2 Still open
None — all open questions resolved during PM review (v0.2).

---

*Next step after your review: a phased Action Plan document (project scaffolding → shared packages → Supabase schema/RLS → patient consult flow → doctor review flow → PWA/theming/tenancy → hardening), with per-phase deliverables and acceptance checks.*
