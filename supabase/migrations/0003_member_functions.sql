-- Refka v1 functions, part 2: member RPCs. Same rules as 0002.
-- p_gym arguments are text and accept the gym id or its slug.

create or replace function public.me() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; p profiles;
begin
  v_uid := rf_uid();
  select * into p from profiles where user_id = v_uid;
  return jsonb_build_object(
    'profile', case when p.user_id is null then null else rf_profile_json(p) end,
    'memberships', (select coalesce(jsonb_agg(rf_membership_json(m) order by m.created_at), '[]'::jsonb)
                    from memberships m where m.user_id = v_uid),
    'is_owner', exists (select 1 from gyms g where g.owner_id = v_uid));
end $$;

create or replace function public.member_join(p_slug text, p_name text, p_gender text, p_birth_year int)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid; v_phone text; g gyms; p profiles; m memberships;
  v_name text; v_gender text; v_year int; v_matched boolean := false;
begin
  v_uid := rf_uid();
  v_phone := my_phone();
  if v_phone is null then raise exception 'bad_input'; end if;       -- not a phone account
  if p_slug is null or char_length(p_slug) > 64 then raise exception 'not_found'; end if;
  select * into g from gyms where slug = lower(btrim(p_slug)) and status = 'live';
  if not found then raise exception 'not_found'; end if;

  select * into m from memberships where gym_id = g.id and phone = v_phone for update;
  if m.id is not null and m.user_id is not null and m.user_id <> v_uid then raise exception 'dup'; end if;

  select * into p from profiles where user_id = v_uid;
  if not found then
    v_name := rf_line(p_name);
    if v_name is null or char_length(v_name) not between 2 and 60 then raise exception 'bad_input'; end if;
    if p_gender is null or p_gender not in ('m', 'f') then raise exception 'bad_input'; end if;
    v_year := extract(year from rf_today())::int;
    if p_birth_year is null or p_birth_year < v_year - 90 or p_birth_year > v_year - 13 then
      raise exception 'bad_input';
    end if;
    -- when the gym already knows this phone's gender, the gym's record wins over the typed one
    v_gender := coalesce(m.gender, p_gender);
    begin
      insert into profiles (user_id, phone, name, gender, birth_year, vis)
      values (v_uid, v_phone, v_name, v_gender, p_birth_year, case when v_gender = 'f' then 'gender' else 'all' end)
      returning * into p;
    exception when unique_violation then raise exception 'dup';
    end;
  end if;
  -- an existing profile keeps its name, gender and birth year: they cannot be changed by joining again

  if m.id is null then
    -- already in this gym under an older row? (cannot normally happen, the phone is final)
    select * into m from memberships where gym_id = g.id and user_id = v_uid;
    if not found then
      if (select count(*) from memberships where gym_id = g.id and status = 'guest') >= 500 then
        raise exception 'limit';
      end if;
      insert into memberships (gym_id, phone, name, gender, user_id, status)
      values (g.id, v_phone, p.name, p.gender, v_uid, 'guest') returning * into m;
    end if;
  elsif m.user_id is null then
    update memberships set user_id = v_uid, status = 'active', gender = coalesce(gender, p.gender)
    where id = m.id returning * into m;
    v_matched := true;
  end if;
  if m.status = 'active' then v_matched := true; end if;

  return jsonb_build_object('membership', rf_membership_json(m), 'matched', v_matched);
end $$;

create or replace function public.update_profile(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; p profiles; t text; v_old_vis text; v_times text[];
begin
  v_uid := rf_uid();
  select * into p from profiles where user_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'bad_input'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) x
             where x not in ('name', 'bio', 'goal', 'level', 'times', 'vis', 'avatar')) then
    raise exception 'bad_input';
  end if;
  v_old_vis := p.vis;

  if p_patch ? 'name' then
    t := rf_line(p_patch ->> 'name');
    if jsonb_typeof(p_patch -> 'name') <> 'string' or t is null or char_length(t) not between 2 and 60 then
      raise exception 'bad_input';
    end if;
    p.name := t;
  end if;
  if p_patch ? 'bio' then
    if jsonb_typeof(p_patch -> 'bio') not in ('string', 'null') then raise exception 'bad_input'; end if;
    t := nullif(btrim(p_patch ->> 'bio'), '');
    if t is not null and char_length(t) > 300 then raise exception 'bad_input'; end if;
    p.bio := t;
  end if;
  if p_patch ? 'goal' then
    if jsonb_typeof(p_patch -> 'goal') not in ('string', 'null') then raise exception 'bad_input'; end if;
    t := rf_line(p_patch ->> 'goal');
    if t is not null and char_length(t) > 40 then raise exception 'bad_input'; end if;
    p.goal := t;
  end if;
  if p_patch ? 'level' then
    if jsonb_typeof(p_patch -> 'level') not in ('string', 'null') then raise exception 'bad_input'; end if;
    t := rf_line(p_patch ->> 'level');
    if t is not null and char_length(t) > 40 then raise exception 'bad_input'; end if;
    p.level := t;
  end if;
  if p_patch ? 'times' then
    if jsonb_typeof(p_patch -> 'times') = 'null' then
      p.times := '{}';
    elsif jsonb_typeof(p_patch -> 'times') = 'array' then
      if jsonb_array_length(p_patch -> 'times') > 12
         or exists (select 1 from jsonb_array_elements(p_patch -> 'times') e
                    where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 20) then
        raise exception 'bad_input';
      end if;
      select coalesce(array_agg(distinct btrim(e #>> '{}')), '{}') into v_times
      from jsonb_array_elements(p_patch -> 'times') e;
      p.times := v_times;
    else
      raise exception 'bad_input';
    end if;
  end if;
  if p_patch ? 'vis' then
    if jsonb_typeof(p_patch -> 'vis') <> 'string' or (p_patch ->> 'vis') not in ('all', 'gender', 'none') then
      raise exception 'bad_input';
    end if;
    p.vis := p_patch ->> 'vis';
  end if;
  if p_patch ? 'avatar' then
    if jsonb_typeof(p_patch -> 'avatar') = 'null' then
      p.avatar := null;
    elsif jsonb_typeof(p_patch -> 'avatar') = 'string' and rf_img_ok(p_patch ->> 'avatar', 56000) then
      p.avatar := p_patch ->> 'avatar';
    else
      raise exception 'bad_input';
    end if;
  end if;

  update profiles set name = p.name, bio = p.bio, goal = p.goal, level = p.level, times = p.times,
    vis = p.vis, avatar = p.avatar
  where user_id = v_uid;

  if v_old_vis = 'all' and p.vis <> 'all' then
    -- the owner may no longer look at this member's posts, so nothing of his can wait for approval
    update posts set status = 'live' where by_user = v_uid and status = 'pending';
  end if;
  if v_old_vis <> p.vis then
    -- pending requests with people who can no longer see each other are withdrawn
    update requests r set status = 'cancelled', decided_at = now()
    where r.status = 'pending' and (r.from_user = v_uid or r.to_user = v_uid)
      and not rf_mutual(r.from_user, r.to_user, r.gym_id);
  end if;
  return rf_profile_json(p);
end $$;

create or replace function public.member_home(p_gym text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid uuid; g gyms; m memberships; v_qr jsonb; v_bucket bigint; v_gender text; v_here int;
begin
  v_uid := rf_uid();
  g := rf_gym(p_gym);
  select * into m from memberships where gym_id = g.id and user_id = v_uid;
  if not found then raise exception 'not_member'; end if;

  if m.status = 'active' and (m.ends is null or m.ends >= rf_today()) then
    v_bucket := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
    v_qr := jsonb_build_object(
      'token', rf_qr_token(g.qr_secret, m.id, v_bucket),
      'exp', (v_bucket + 1) * 60,                                   -- epoch seconds: fetch a new one then
      'exp_at', to_timestamp((v_bucket + 1) * 60),
      'ttl', greatest(1, ((v_bucket + 1) * 60 - floor(extract(epoch from clock_timestamp())))::int));
  end if;

  -- "here now" only counts people this member is allowed to see (plus himself), so it cannot be used
  -- to learn that a hidden member walked in
  if rf_active(m) then
    select coalesce(m.gender, p.gender) into v_gender from profiles p where p.user_id = v_uid;
    select count(distinct c.membership_id) into v_here
    from checkins c join memberships x on x.id = c.membership_id
    where c.gym_id = g.id and c.at > now() - interval '2 hours'
      and ( x.user_id = v_uid
            or (x.user_id is not null and can_see(v_uid, x.user_id, g.id))
            or (x.user_id is null and x.gender is not distinct from v_gender) );
  else
    v_here := 0;
  end if;

  return jsonb_build_object(
    'gym', rf_gym_brief(g) || jsonb_build_object('currency', g.currency, 'settings', g.settings, 'pay', g.pay,
             'status', g.status, 'packages', rf_packages_public(g.id)),
    'membership', jsonb_build_object('id', m.id, 'status', m.status, 'package', rf_pkg_brief(m.package_id),
             'starts', m.starts, 'ends', m.ends,
             'days_left', case when m.ends is null then null else m.ends - rf_today() end),
    'qr', v_qr,
    'here_now', v_here,
    'week_checkins', (select count(*) from checkins c where c.membership_id = m.id and c.at > now() - interval '7 days'),
    'pending_payment', exists (select 1 from payments pay where pay.membership_id = m.id and pay.status = 'pending'));
end $$;

create or replace function public.member_renew(p_gym text, p_package_id uuid, p_method text, p_ref text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; g gyms; m memberships; pk packages; v_ref text; pay payments;
begin
  v_uid := rf_uid();
  g := rf_gym(p_gym);
  select * into m from memberships where gym_id = g.id and user_id = v_uid for update;
  if not found then raise exception 'not_member'; end if;
  if g.status <> 'live' then raise exception 'not_found'; end if;
  select * into pk from packages where id = p_package_id and gym_id = g.id and active and deleted_at is null;
  if not found then raise exception 'not_found'; end if;

  if p_method is null or p_method not in ('instapay', 'wallet', 'cash') then raise exception 'bad_input'; end if;
  if (p_method = 'cash' and not coalesce((g.pay ->> 'cash') = 'true', false))
     or (p_method in ('instapay', 'wallet') and coalesce(btrim(g.pay ->> p_method), '') = '') then
    raise exception 'bad_input';                                    -- the gym does not take this method
  end if;
  v_ref := rf_line(p_ref);
  if v_ref is not null and char_length(v_ref) > 60 then raise exception 'bad_input'; end if;
  if p_method <> 'cash' and (v_ref is null or char_length(v_ref) < 4) then raise exception 'bad_input'; end if;

  if exists (select 1 from payments where membership_id = m.id and status = 'pending') then
    raise exception 'pending_exists';
  end if;
  begin
    insert into payments (gym_id, membership_id, package_id, amount, method, ref)
    values (g.id, m.id, pk.id, rf_pkg_price(pk), p_method, v_ref) returning * into pay;
  exception when unique_violation then raise exception 'pending_exists';
  end;
  return jsonb_build_object('payment', jsonb_build_object('id', pay.id, 'amount', pay.amount, 'method', pay.method,
    'ref', pay.ref, 'status', pay.status, 'created_at', pay.created_at, 'package', rf_pkg_brief(pay.package_id)));
end $$;

-- ================================================================ people and requests

create or replace function public.people(p_gym text, p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; me_m memberships; me_p profiles; v_q text;
begin
  me_m := rf_member(p_gym);
  v_uid := me_m.user_id;
  select * into me_p from profiles where user_id = v_uid;
  v_q := lower(coalesce(rf_line(left(p_q, 60)), ''));
  return (
    select coalesce(jsonb_agg(x.j order by x.overlap desc, x.name, x.user_id), '[]'::jsonb) from (
      select p.name, p.user_id, o.overlap,
        jsonb_build_object('user_id', p.user_id, 'name', p.name, 'gender', coalesce(m.gender, p.gender),
          'goal', p.goal, 'level', p.level, 'times', to_jsonb(p.times), 'bio', p.bio, 'avatar', p.avatar,
          'overlap', o.overlap,
          'relation', case
            when exists (select 1 from refkas r where r.gym_id = m.gym_id and r.ended_at is null
                         and r.a = least(v_uid, p.user_id) and r.b = greatest(v_uid, p.user_id)) then 'refka'
            when exists (select 1 from requests q where q.gym_id = m.gym_id and q.status = 'pending'
                         and q.from_user = v_uid and q.to_user = p.user_id) then 'out'
            when exists (select 1 from requests q where q.gym_id = m.gym_id and q.status = 'pending'
                         and q.from_user = p.user_id and q.to_user = v_uid) then 'in'
            else 'none' end) as j
      from memberships m
      join profiles p on p.user_id = m.user_id
      cross join lateral (select count(*)::int as overlap from unnest(p.times) t where t = any (me_p.times)) o
      where m.gym_id = me_m.gym_id and m.status = 'active' and m.user_id <> v_uid
        and can_see(v_uid, m.user_id, m.gym_id)
        and (v_q = '' or position(v_q in lower(p.name)) > 0)
      order by o.overlap desc, p.name, p.user_id
      limit 100
    ) x);
end $$;

create or replace function public.request_send(p_gym text, p_to uuid, p_kind text, p_slot text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships; v_slot text; r requests;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  if p_to is null or p_to = v_uid then raise exception 'bad_input'; end if;
  if p_kind is null or p_kind not in ('train', 'spot') then raise exception 'bad_input'; end if;
  v_slot := rf_line(p_slot);
  if v_slot is not null and char_length(v_slot) > 40 then raise exception 'bad_input'; end if;

  -- both must be able to see each other. A block answers "hidden" too, so nobody learns he was blocked.
  if not rf_mutual(v_uid, p_to, m.gym_id) then raise exception 'hidden'; end if;

  if exists (select 1 from refkas x where x.gym_id = m.gym_id and x.ended_at is null
             and x.a = least(v_uid, p_to) and x.b = greatest(v_uid, p_to)) then
    raise exception 'dup';
  end if;
  if exists (select 1 from requests q where q.gym_id = m.gym_id and q.status = 'pending'
             and ((q.from_user = v_uid and q.to_user = p_to) or (q.from_user = p_to and q.to_user = v_uid))) then
    raise exception 'dup';
  end if;
  -- no means no: after a decline the same person cannot be asked again for 14 days
  if exists (select 1 from requests q where q.gym_id = m.gym_id and q.status = 'declined'
             and q.from_user = v_uid and q.to_user = p_to and q.decided_at > now() - interval '14 days') then
    raise exception 'dup';
  end if;
  -- 5 a day over all gyms; cancelled ones count, so cancel and resend cannot be used to pester
  if (select count(*) from requests q where q.from_user = v_uid and q.created_at >= rf_day_start()) >= 5 then
    raise exception 'limit';
  end if;

  begin
    insert into requests (gym_id, from_user, to_user, kind, slot)
    values (m.gym_id, v_uid, p_to, p_kind, v_slot) returning * into r;
  exception when unique_violation then raise exception 'dup';
  end;
  return jsonb_build_object('request', jsonb_build_object('id', r.id, 'kind', r.kind, 'slot', r.slot,
    'status', r.status, 'at', r.created_at, 'to', rf_person(r.to_user, true)));
end $$;

create or replace function public.request_respond(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; r requests; v_refka uuid; m memberships;
begin
  v_uid := rf_uid();
  if p_accept is null then raise exception 'bad_input'; end if;
  select * into r from requests where id = p_id and to_user = v_uid and status = 'pending' for update;
  if not found then raise exception 'not_found'; end if;
  select * into m from memberships where gym_id = r.gym_id and user_id = v_uid;
  if not found or not rf_active(m) then raise exception 'not_member'; end if;

  if not p_accept then
    update requests set status = 'declined', decided_at = now() where id = r.id;
    return jsonb_build_object('ok', true);
  end if;

  if not rf_mutual(v_uid, r.from_user, r.gym_id) then raise exception 'hidden'; end if;
  update requests set status = 'accepted', decided_at = now() where id = r.id;
  insert into refkas (gym_id, a, b)
  values (r.gym_id, least(r.from_user, r.to_user), greatest(r.from_user, r.to_user))
  on conflict do nothing
  returning id into v_refka;
  if v_refka is null then
    select id into v_refka from refkas
    where gym_id = r.gym_id and ended_at is null
      and a = least(r.from_user, r.to_user) and b = greatest(r.from_user, r.to_user);
  end if;
  return jsonb_build_object('ok', true, 'refka_id', v_refka);
end $$;

create or replace function public.request_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  v_uid := rf_uid();
  update requests set status = 'cancelled', decided_at = now()
  where id = p_id and from_user = v_uid and status = 'pending';
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.requests_list(p_gym text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  return jsonb_build_object(
    'incoming', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) from (
        select r.created_at, jsonb_build_object('id', r.id, 'kind', r.kind, 'slot', r.slot, 'at', r.created_at,
                 'from', rf_person(r.from_user, true)) as j
        from requests r
        where r.gym_id = m.gym_id and r.to_user = v_uid and r.status = 'pending'
          and rf_mutual(v_uid, r.from_user, r.gym_id)
        order by r.created_at desc limit 50) x),
    'outgoing', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]'::jsonb) from (
        select r.created_at, jsonb_build_object('id', r.id, 'kind', r.kind, 'slot', r.slot, 'at', r.created_at,
                 'status', r.status, 'to', rf_person(r.to_user, true)) as j
        from requests r
        where r.gym_id = m.gym_id and r.from_user = v_uid
          and (r.status = 'pending'
               or (r.status in ('accepted', 'declined') and r.created_at > now() - interval '14 days'))
          and can_see(v_uid, r.to_user, r.gym_id, true)
        order by r.created_at desc limit 50) x));
end $$;

-- ================================================================ refkas and chat

-- the open refka p_refka if the caller is one of the two and may still deal with the other, else an error
create or replace function public.rf_refka(p_refka uuid) returns public.refkas
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; r refkas; v_other uuid; m memberships;
begin
  v_uid := rf_uid();
  select * into r from refkas where id = p_refka and (a = v_uid or b = v_uid) and ended_at is null;
  if not found then raise exception 'not_found'; end if;
  v_other := case when r.a = v_uid then r.b else r.a end;
  if exists (select 1 from blocks k where (k.blocker = v_uid and k.blocked = v_other)
                                       or (k.blocker = v_other and k.blocked = v_uid)) then
    raise exception 'blocked';
  end if;
  select * into m from memberships where gym_id = r.gym_id and user_id = v_uid;
  if not found or not rf_active(m) then raise exception 'not_member'; end if;
  if not rf_mutual(v_uid, v_other, r.gym_id, true) then raise exception 'hidden'; end if;
  return r;
end $$;

create or replace function public.refkas_list(p_gym text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  return (
    select coalesce(jsonb_agg(x.j order by x.sort_at desc), '[]'::jsonb) from (
      select coalesce(l.at, r.since) as sort_at,
        jsonb_build_object('id', r.id, 'since', r.since,
          'with', rf_person(o.other),
          'last', case when l.id is null then null else
                    jsonb_build_object('body', l.body, 'at', l.at, 'mine', l.from_user = v_uid) end,
          'unread', (select count(*) from messages x2
                     where x2.refka_id = r.id and x2.from_user <> v_uid
                       and x2.at > coalesce(case when r.a = v_uid then r.a_read_at else r.b_read_at end,
                                            '-infinity'::timestamptz))) as j
      from refkas r
      cross join lateral (select case when r.a = v_uid then r.b else r.a end as other) o
      left join lateral (select x1.* from messages x1 where x1.refka_id = r.id order by x1.at desc limit 1) l on true
      where r.gym_id = m.gym_id and r.ended_at is null and (r.a = v_uid or r.b = v_uid)
        and rf_mutual(v_uid, o.other, r.gym_id, true)
      order by sort_at desc limit 200
    ) x);
end $$;

create or replace function public.refka_end(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  v_uid := rf_uid();
  update refkas set ended_at = now() where id = p_id and (a = v_uid or b = v_uid) and ended_at is null;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.chat_list(p_refka uuid, p_after timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; r refkas; v_out jsonb;
begin
  v_uid := rf_uid();
  r := rf_refka(p_refka);
  select coalesce(jsonb_agg(x.j order by x.at, x.id), '[]'::jsonb) into v_out from (
    select msg.at, msg.id, jsonb_build_object('id', msg.id, 'body', msg.body, 'at', msg.at,
             'mine', msg.from_user = v_uid) as j
    from messages msg
    where msg.refka_id = r.id and (p_after is null or msg.at > p_after)
    order by msg.at desc, msg.id desc limit 200
  ) x;
  if r.a = v_uid then update refkas set a_read_at = clock_timestamp() where id = r.id;
  else update refkas set b_read_at = clock_timestamp() where id = r.id;
  end if;
  return v_out;
end $$;

create or replace function public.chat_send(p_refka uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; r refkas; v_body text; msg messages;
begin
  v_uid := rf_uid();
  r := rf_refka(p_refka);
  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) not between 1 and 1000 then raise exception 'bad_input'; end if;
  if (select count(*) from messages x where x.from_user = v_uid and x.at > now() - interval '1 minute') >= 30 then
    raise exception 'limit';
  end if;
  insert into messages (refka_id, from_user, body, at) values (r.id, v_uid, v_body, clock_timestamp())
  returning * into msg;
  return jsonb_build_object('id', msg.id, 'at', msg.at);
end $$;

create or replace function public.block_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  v_uid := rf_uid();
  if p_user is null or p_user = v_uid then raise exception 'bad_input'; end if;
  if not exists (select 1 from profiles where user_id = p_user) then raise exception 'not_found'; end if;
  insert into blocks (blocker, blocked) values (v_uid, p_user) on conflict do nothing;
  update refkas set ended_at = now()
  where ended_at is null and a = least(v_uid, p_user) and b = greatest(v_uid, p_user);
  update requests set status = 'cancelled', decided_at = now()
  where status = 'pending'
    and ((from_user = v_uid and to_user = p_user) or (from_user = p_user and to_user = v_uid));
  return jsonb_build_object('ok', true);
end $$;

-- p_reason has a default only because Postgres wants defaults after p_user and p_post; it is required.
create or replace function public.report(p_gym text, p_user uuid default null, p_post uuid default null,
  p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships; v_reason text; po posts; v_about uuid;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  v_reason := btrim(coalesce(p_reason, ''), E' \t\r\n');
  if char_length(v_reason) not between 1 and 500 then raise exception 'bad_input'; end if;
  if p_user is null and p_post is null then raise exception 'bad_input'; end if;
  if p_user = v_uid then raise exception 'bad_input'; end if;

  if p_post is not null then
    select * into po from posts where id = p_post and gym_id = m.gym_id;
    -- only a post the reporter can actually see
    if not found or po.by_user = v_uid or po.status <> 'live' or not can_see(v_uid, po.by_user, m.gym_id) then
      raise exception 'not_found';
    end if;
    v_about := po.by_user;
  end if;
  if p_user is not null then
    if not exists (select 1 from memberships x where x.gym_id = m.gym_id and x.user_id = p_user) then
      raise exception 'not_found';
    end if;
    v_about := p_user;
  end if;
  if (select count(*) from reports x where x.by_user = v_uid and x.at >= rf_day_start()) >= 10 then
    raise exception 'limit';
  end if;
  insert into reports (gym_id, by_user, about_user, about_post, reason)
  values (m.gym_id, v_uid, v_about, p_post, v_reason);
  return jsonb_build_object('ok', true);
end $$;

-- ================================================================ feed

create or replace function public.feed(p_gym text, p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships; g gyms;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  select * into g from gyms where id = m.gym_id;
  if coalesce(g.settings ->> 'posts', 'all') = 'off' then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(rf_post_json(x, v_uid) order by x.at desc, x.id), '[]'::jsonb) from (
      select po.* from posts po
      where po.gym_id = m.gym_id
        and (p_before is null or po.at < p_before)
        and (po.by_user = v_uid or (po.status = 'live' and can_see(v_uid, po.by_user, po.gym_id)))
      order by po.at desc, po.id limit 20
    ) x);
end $$;

create or replace function public.post_create(p_gym text, p_body text, p_img text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; m memberships; g gyms; v_mode text; v_body text; v_vis text; po posts;
begin
  m := rf_member(p_gym);
  v_uid := m.user_id;
  select * into g from gyms where id = m.gym_id;
  v_mode := coalesce(g.settings ->> 'posts', 'all');
  if v_mode = 'off' then raise exception 'posts_off'; end if;
  v_body := btrim(coalesce(p_body, ''), E' \t\r\n');
  if char_length(v_body) > 500 then raise exception 'bad_input'; end if;
  if p_img is not null and not rf_img_ok(p_img, 205000) then raise exception 'bad_input'; end if;
  if v_body = '' and p_img is null then raise exception 'bad_input'; end if;
  if (select count(*) from posts x where x.by_user = v_uid and x.at >= rf_day_start()) >= 10 then
    raise exception 'limit';
  end if;
  select vis into v_vis from profiles where user_id = v_uid;
  -- approve mode: the owner reviews first, but only posts he is allowed to see (author vis = 'all').
  -- Posts of members with vis 'gender' or 'none' go live for the people who may see them; reports still reach him.
  insert into posts (gym_id, by_user, body, img, status, at)
  values (m.gym_id, v_uid, v_body, p_img,
          case when v_mode = 'approve' and v_vis = 'all' then 'pending' else 'live' end, clock_timestamp())
  returning * into po;
  return jsonb_build_object('post', rf_post_json(po, v_uid));
end $$;

-- toggles; returns the new state in "respected"
create or replace function public.post_respect(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; po posts; m memberships; v_on boolean;
begin
  v_uid := rf_uid();
  select * into po from posts where id = p_id;
  if not found then raise exception 'not_found'; end if;
  select * into m from memberships where gym_id = po.gym_id and user_id = v_uid;
  if not found or not rf_active(m) then raise exception 'not_found'; end if;   -- do not confirm other gyms' posts
  if po.status <> 'live' or not can_see(v_uid, po.by_user, po.gym_id) then raise exception 'not_found'; end if;
  delete from post_respects where post_id = po.id and user_id = v_uid;
  if found then
    v_on := false;
  else
    insert into post_respects (post_id, user_id) values (po.id, v_uid) on conflict do nothing;
    v_on := true;
  end if;
  return jsonb_build_object('ok', true, 'respected', v_on);
end $$;

create or replace function public.post_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  v_uid := rf_uid();
  delete from posts where id = p_id and by_user = v_uid;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;
