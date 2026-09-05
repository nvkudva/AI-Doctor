-- 0009 — the (S) row of §4.2 (#18, queue live updates) and the pg_cron schedule
-- for §4.3 #33.

-- Realtime on `consults`, filtered client-side by hospital_id=eq.<h>. Because the
-- table has RLS enabled and forced, a subscriber only ever receives rows their own
-- policies would have returned: the queue channel needs no separate authorization.
alter table public.consults replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.consults;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Timers move server-side; apps/web/src/store/sla.ts is the client sweep this
-- replaces. Scheduling is only attempted when pg_cron is installed, so the
-- migration applies cleanly on a local stack without it.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vd_consult_timers',  '*/5 * * * *', 'select public.run_consult_timers();');
    perform cron.schedule('vd_storage_retention', '17 3 * * *', 'select public.run_storage_retention();');
  else
    raise notice 'pg_cron not installed — schedule run_consult_timers() externally (see README).';
  end if;
end $$;
