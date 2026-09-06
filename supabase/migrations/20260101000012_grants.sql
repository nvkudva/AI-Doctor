-- Grants for `authenticated`, per DATA-MODEL §3.6.
--
-- Found by running the RLS isolation suite for the first time: every policy in
-- the schema was unreachable. Postgres checks table privileges BEFORE row
-- security, so a table with policies but no grant denies everyone — including
-- the owner of the row. Every §4 call marked (T) — the ones whose whole
-- implementation is meant to be a policy — failed with 42501.
--
-- The grants here are deliberately narrow: they open the door only as wide as
-- §3.6 says, and RLS still decides which rows come back. Two rules survive
-- untouched:
--   * prescriptions / prescription_items / reviews get SELECT and nothing else.
--     The gate (§3.4) depends on there being no INSERT grant for any client
--     role, so approval remains impossible outside approve_consult.
--   * Tables marked "only writer: service_role" get no client write grant.

-- Read-only for a client; all writes go through SECURITY DEFINER functions.
grant select on table
  public.hospitals,
  public.consults,
  public.consult_slots,
  public.consult_messages,
  public.consult_events,
  public.ai_drafts,
  public.safety_checks,
  public.protocol_versions,
  public.reviews,
  public.prescriptions,
  public.prescription_items,
  public.investigation_orders,
  public.appointments,
  public.clinician_details,
  public.memberships
to authenticated;

-- Read plus the writes §3.6 allows directly.
grant select, insert, update on table public.patient_details to authenticated;
grant select, insert on table public.consult_media to authenticated;
grant select, insert on table public.lab_results to authenticated;
grant select, insert on table public.review_messages to authenticated;
grant select, insert on table public.mira_feedback to authenticated;
grant select, update on table public.notifications to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, update on table public.profiles to authenticated;

-- A patient inserts their own turn on the patient channel; RLS narrows it to
-- their own consult and sender='patient'.
grant insert on table public.consult_messages to authenticated;

-- Reference data the client renders but never writes.
grant select on table public.red_flag_scripts, public.drug_class_map to authenticated;

-- anon sees only the public branding view, which already carries its own grant.

-- Belt and braces: re-assert the gate's revokes after the broad grants above,
-- so a future edit to this file cannot accidentally open the write path.
revoke insert, update, delete on table
  public.prescriptions, public.prescription_items, public.reviews
from authenticated, anon, service_role;
