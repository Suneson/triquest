-- 0020: settle challenges on a schedule. resolve_due() (0019) is idempotent and
-- also runs whenever someone opens the challenges; this makes sure a
-- challenge nobody looks at still settles (hourly, at :17). Skipped where
-- pg_cron isn't available (the PGlite tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    perform cron.schedule('resolve-due-challenges', '17 * * * *', 'select public.resolve_due()');
  end if;
end
$$;
