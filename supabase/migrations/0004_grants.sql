-- Who may call what. Postgres grants EXECUTE to PUBLIC by default and Supabase adds default grants for
-- anon and authenticated, so everything is revoked first and then granted one by one.
--   rf_* helpers, can_see, my_phone : nobody from outside (they run inside the security definer RPCs)
--   any other function in public     : nobody (closed until it is added to a list here)
--   gym_public                       : anon + authenticated
--   every other RPC                  : authenticated only

do $$
declare
  f record;
  v_public text[] := array['gym_public'];
  v_auth text[] := array[
    'owner_create_gym','owner_get_gym','owner_update_gym','owner_upsert_package','owner_delete_package',
    'owner_import_members','owner_go_live','owner_home','owner_members','owner_decide_payment',
    'owner_decide_guest','owner_decide_post','owner_resolve_report','owner_scan','owner_checkin',
    'me','member_join','update_profile','member_home','member_renew','people','request_send',
    'request_respond','request_cancel','requests_list','refkas_list','refka_end','chat_list','chat_send',
    'block_user','report','feed','post_create','post_respect','post_delete'];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'      -- every function in public: anything not listed stays closed
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = any (v_public) then
      execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname = any (v_auth) then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- tables stay closed (repeated here on purpose: this file is the last word on access)
revoke all on all tables in schema public from public, anon, authenticated;

-- Supabase gives anon and authenticated EXECUTE on every new function in public by default. Turn that off for
-- functions created later by this role, so a future function is closed until it is added to the lists above.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
