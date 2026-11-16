-- Refka v1 functions, part 1: internal helpers, the visibility rule, public and owner RPCs.
-- Every function: security definer, search_path = public, extensions, returns jsonb (RPCs), raises a short code.
-- Internal helpers are prefixed rf_ and are NOT executable by anon or authenticated (see 0004_grants.sql).

-- ================================================================ small helpers

create or replace function public.rf_today() returns date
language sql stable security definer set search_path = public, extensions as $$
  select (now() at time zone 'Africa/Cairo')::date
$$;

create or replace function public.rf_day_start() returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select (public.rf_today()::timestamp) at time zone 'Africa/Cairo'
$$;

create or replace function public.rf_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v uuid;
begin
  v := auth.uid();
  if v is null then raise exception 'not_auth'; end if;
  return v;
end $$;

-- same normalisation as app/lib/api.js phoneDigits(): digits only, 00 prefix dropped, 01xxxxxxxxx -> 201xxxxxxxxx
create or replace function public.rf_phone(p text) returns text
language plpgsql immutable security definer set search_path = public, extensions as $$
declare d text;
begin
  if p is null or char_length(p) > 40 then return null; end if;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  if d like '00%' then d := substr(d, 3); end if;
  if d ~ '^01[0-9]{9}$' then d := '2' || d; end if;
  if d !~ '^[0-9]{10,15}$' then return null; end if;
  return '+' || d;
end $$;

-- The caller's phone. Once a profile exists its phone is final. Before that it is derived from the
-- synthetic login email p<digits>@m.refka.app (unique in auth), never from user_metadata, because
-- user_metadata can be edited by the user himself (see Deviations in CONTRACT.md).
create or replace function public.my_phone() returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; v_phone text; v_email text;
begin
  v_uid := auth.uid();
  if v_uid is null then return null; end if;
  select phone into v_phone from profiles where user_id = v_uid;
  if v_phone is not null then return v_phone; end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email ~ '^p[0-9]{10,15}@m\.refka\.app$' then
    return '+' || substr(v_email, 2, position('@' in v_email) - 2);
  end if;
  return null;
end $$;

create or replace function public.rf_int(p text) returns int
language plpgsql immutable security definer set search_path = public, extensions as $$
begin
  if p is null then return null; end if;
  return p::int;
exception when others then raise exception 'bad_input';
end $$;

create or replace function public.rf_date(p text) returns date
language plpgsql immutable security definer set search_path = public, extensions as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if p !~ '^\s*[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}' then raise exception 'bad_input'; end if;
  return substr(btrim(p), 1, 10)::date;
exception when others then raise exception 'bad_input';
end $$;

create or replace function public.rf_uuid(p text) returns uuid
language plpgsql immutable security definer set search_path = public, extensions as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return p::uuid;
exception when others then raise exception 'bad_input';
end $$;

-- one line text: trimmed, inner whitespace collapsed
create or replace function public.rf_line(p text) returns text
language sql immutable security definer set search_path = public, extensions as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '')
$$;

create or replace function public.rf_gender(p text) returns text
language sql immutable security definer set search_path = public, extensions as $$
  select case
    when lower(btrim(coalesce(p, ''))) in ('m', 'male', 'man', 'ذكر', 'راجل', 'رجل') then 'm'
    when lower(btrim(coalesce(p, ''))) in ('f', 'female', 'woman', 'أنثى', 'انثى', 'انثي', 'أنثي', 'ست', 'بنت') then 'f'
    else null end
$$;

-- raster data URL only (no svg: it can carry script), with a length cap on the whole string
create or replace function public.rf_img_ok(p text, p_max int) returns boolean
language sql immutable security definer set search_path = public, extensions as $$
  select p is not null and char_length(p) <= p_max
     and p ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
$$;

create or replace function public.rf_reserved_slug(p text) returns boolean
language sql immutable security definer set search_path = public, extensions as $$
  select p = any (array[
    'app','admin','api','www','pay','ar','en','de','owner','owners','login','logout','signup','signin','register',
    'auth','rest','rpc','m','member','members','gym','gyms','refka','refqa','rifqa','support','help','about','blog',
    'assets','static','dev','test','staging','mail','dashboard','console','settings','account','billing','pricing',
    'terms','privacy','legal','security','status','docs','null','undefined','root','system','supabase','index',
    'home','join','new','public','private','demo'])
$$;

-- ================================================================ lookups

create or replace function public.rf_owner_gym() returns public.gyms
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; g gyms;
begin
  v_uid := rf_uid();
  select * into g from gyms where owner_id = v_uid;
  if not found then raise exception 'not_owner'; end if;
  return g;
end $$;

-- p_gym arguments accept the gym id or its slug
create or replace function public.rf_gym(p text) returns public.gyms
language plpgsql stable security definer set search_path = public, extensions as $$
declare g gyms;
begin
  if p is null or char_length(p) > 64 then raise exception 'not_found'; end if;
  if p ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    select * into g from gyms where id = p::uuid;
  else
    select * into g from gyms where slug = lower(btrim(p));
  end if;
  if not found then raise exception 'not_found'; end if;
  return g;
end $$;

-- "active membership" of the visibility rule: linked, status active, not expired for more than 7 days
create or replace function public.rf_active(m public.memberships) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select m.id is not null and m.user_id is not null and m.status = 'active'
     and (m.ends is null or m.ends >= public.rf_today() - 7)
$$;

-- the caller's active membership in a gym, or not_member. Used by every social member function.
create or replace function public.rf_member(p_gym text) returns public.memberships
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; g gyms; m memberships;
begin
  v_uid := rf_uid();
  g := rf_gym(p_gym);
  select * into m from memberships where gym_id = g.id and user_id = v_uid;
  if not found or not rf_active(m) then raise exception 'not_member'; end if;
  return m;
end $$;

-- ================================================================ THE visibility rule
-- can_see(viewer, target, gym): may viewer see target inside this gym?
-- p_known = true is the relaxed form for an existing refka: a target who later chose vis='none' stays
-- visible to his existing partners, but blocks, membership, the minors rule and the gender rule still hold
-- (cross gender then needs: gym.cross on and neither side has vis='gender').
create or replace function public.can_see(viewer uuid, target uuid, gym uuid, p_known boolean default false)
returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  pv profiles; pt profiles; mv memberships; mt memberships;
  v_settings jsonb; v_year int; gv text; gt text;
begin
  if viewer is null or target is null or gym is null then return false; end if;
  if viewer = target then return true; end if;
  if exists (select 1 from blocks b
             where (b.blocker = viewer and b.blocked = target) or (b.blocker = target and b.blocked = viewer)) then
    return false;
  end if;
  select * into pv from profiles where user_id = viewer;
  if not found then return false; end if;
  select * into pt from profiles where user_id = target;
  if not found then return false; end if;
  if pt.vis = 'none' and not coalesce(p_known, false) then return false; end if;
  select * into mv from memberships where gym_id = gym and user_id = viewer;
  if not found or not rf_active(mv) then return false; end if;
  select * into mt from memberships where gym_id = gym and user_id = target;
  if not found or not rf_active(mt) then return false; end if;
  v_year := extract(year from rf_today())::int;
  if ((v_year - pv.birth_year) < 18) <> ((v_year - pt.birth_year) < 18) then return false; end if;
  -- the gym's record of gender wins over the self declared one
  gv := coalesce(mv.gender, pv.gender);
  gt := coalesce(mt.gender, pt.gender);
  if gv = gt then return true; end if;
  select settings into v_settings from gyms where id = gym;
  if not coalesce((v_settings ->> 'cross') = 'true', false) then return false; end if;
  if coalesce(p_known, false) then
    return pv.vis <> 'gender' and pt.vis <> 'gender';
  end if;
  return pv.vis = 'all' and pt.vis = 'all';
end $$;

-- both directions: used wherever two people interact (requests, chat)
create or replace function public.rf_mutual(p_a uuid, p_b uuid, p_gym uuid, p_known boolean default false)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.can_see(p_a, p_b, p_gym, p_known) and public.can_see(p_b, p_a, p_gym, p_known)
$$;

-- ================================================================ json builders (never include qr_secret)

create or replace function public.rf_gym_json(g public.gyms) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name, 'name_ar', g.name_ar,
    'country', g.country, 'currency', g.currency, 'brand', g.brand, 'settings', g.settings, 'pay', g.pay,
    'status', g.status, 'created_at', g.created_at)
$$;

create or replace function public.rf_gym_brief(g public.gyms) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name, 'name_ar', g.name_ar, 'brand', g.brand)
$$;

-- owner view of a package: raw values
create or replace function public.rf_pkg_json(p public.packages) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'name_ar', p.name_ar, 'months', p.months, 'price', p.price,
    'before_price', p.before_price, 'until', p.until, 'active', p.active, 'sort', p.sort)
$$;

-- price a member pays today: the offer price while the offer runs, the before_price once "until" has passed
create or replace function public.rf_pkg_price(p public.packages) returns int
language sql stable security definer set search_path = public, extensions as $$
  select case when p.before_price is not null and p.until is not null and p.until < public.rf_today()
              then p.before_price else p.price end
$$;

-- member/public view of a package: effective price, offer fields only while the offer runs
create or replace function public.rf_pkg_public(p public.packages) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'name_ar', p.name_ar, 'months', p.months,
    'price', public.rf_pkg_price(p),
    'before_price', case when p.until is not null and p.until >= public.rf_today() then p.before_price end,
    'until', case when p.before_price is not null and p.until >= public.rf_today() then p.until end)
$$;

create or replace function public.rf_pkg_brief(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select (select jsonb_build_object('id', p.id, 'name', p.name, 'name_ar', p.name_ar, 'months', p.months)
          from public.packages p where p.id = p_id)
$$;

create or replace function public.rf_packages_public(p_gym uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(public.rf_pkg_public(p) order by p.sort, p.price, p.created_at), '[]'::jsonb)
  from public.packages p where p.gym_id = p_gym and p.active and p.deleted_at is null
$$;

-- own profile (the only place a phone is returned to a member, and it is his own)
create or replace function public.rf_profile_json(p public.profiles) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('user_id', p.user_id, 'phone', p.phone, 'name', p.name, 'gender', p.gender,
    'birth_year', p.birth_year, 'bio', p.bio, 'goal', p.goal, 'level', p.level, 'times', to_jsonb(p.times),
    'vis', p.vis, 'avatar', p.avatar, 'created_at', p.created_at)
$$;

-- what one member may learn about another: never the phone, never the birth year
create or replace function public.rf_person(p_user uuid, p_goal boolean default false) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select (select case when p_goal
            then jsonb_build_object('user_id', p.user_id, 'name', p.name, 'avatar', p.avatar, 'goal', p.goal)
            else jsonb_build_object('user_id', p.user_id, 'name', p.name, 'avatar', p.avatar) end
          from public.profiles p where p.user_id = p_user)
$$;

create or replace function public.rf_membership_json(m public.memberships) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', m.id,
    'gym', (select public.rf_gym_brief(g) from public.gyms g where g.id = m.gym_id),
    'status', m.status, 'package', public.rf_pkg_brief(m.package_id), 'starts', m.starts, 'ends', m.ends,
    'days_left', case when m.ends is null then null else m.ends - public.rf_today() end)
$$;

create or replace function public.rf_post_json(p public.posts, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('id', p.id, 'body', p.body, 'img', p.img, 'at', p.at, 'status', p.status,
    'mine', p.by_user = p_viewer,
    'by', public.rf_person(p.by_user),
    'respects', case when p.by_user = p_viewer
                     then (select count(*) from public.post_respects r where r.post_id = p.id) end,
    'respected', exists (select 1 from public.post_respects r where r.post_id = p.id and r.user_id = p_viewer))
$$;

-- rotating member QR: rf1.<membership id>.<60 s bucket>.<first 32 hex of HMAC-SHA256(id.bucket, gym secret)>
create or replace function public.rf_qr_sig(p_secret text, p_membership uuid, p_bucket bigint) returns text
language sql immutable security definer set search_path = public, extensions as $$
  select substr(encode(hmac(p_membership::text || '.' || p_bucket::text, p_secret, 'sha256'), 'hex'), 1, 32)
$$;

create or replace function public.rf_qr_token(p_secret text, p_membership uuid, p_bucket bigint) returns text
language sql immutable security definer set search_path = public, extensions as $$
  select 'rf1.' || p_membership::text || '.' || p_bucket::text || '.' || public.rf_qr_sig(p_secret, p_membership, p_bucket)
$$;

-- a live gym must always keep one active package and one pay method
create or replace function public.rf_check_live(p_gym uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
declare g gyms;
begin
  select * into g from gyms where id = p_gym;
  if not exists (select 1 from packages where gym_id = g.id and active and deleted_at is null) then
    raise exception 'need_package';
  end if;
  if not (coalesce((g.pay ->> 'cash') = 'true', false)
          or coalesce(btrim(g.pay ->> 'instapay'), '') <> ''
          or coalesce(btrim(g.pay ->> 'wallet'), '') <> '') then
    raise exception 'need_pay';
  end if;
end $$;

-- writes a check-in unless the member already has one in the last 3 hours. true = written
create or replace function public.rf_checkin(p_gym uuid, p_membership uuid, p_via text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from checkins where membership_id = p_membership and at > now() - interval '3 hours') then
    return false;
  end if;
  insert into checkins (gym_id, membership_id, via) values (p_gym, p_membership, p_via);
  return true;
end $$;

-- ================================================================ PUBLIC

create or replace function public.gym_public(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare g gyms;
begin
  if p_slug is null or char_length(p_slug) > 64 then return null; end if;
  select * into g from gyms where slug = lower(btrim(p_slug)) and status = 'live';
  if not found then return null; end if;
  return jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name, 'name_ar', g.name_ar, 'brand', g.brand,
    'status', g.status, 'currency', g.currency, 'packages', rf_packages_public(g.id));
end $$;

-- ================================================================ OWNER

create or replace function public.owner_create_gym(p_name text, p_name_ar text, p_slug text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid; v_name text; v_name_ar text; v_slug text; g gyms;
begin
  v_uid := rf_uid();
  v_name := rf_line(p_name);
  v_name_ar := rf_line(p_name_ar);
  if v_name is null or char_length(v_name) not between 2 and 60 then raise exception 'bad_input'; end if;
  if v_name_ar is not null and char_length(v_name_ar) > 60 then raise exception 'bad_input'; end if;
  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$' or v_slug ~ '--' or rf_reserved_slug(v_slug) then
    raise exception 'slug_bad';
  end if;
  if exists (select 1 from gyms where owner_id = v_uid) then raise exception 'dup'; end if;
  if exists (select 1 from gyms where slug = v_slug) then raise exception 'slug_taken'; end if;
  begin
    insert into gyms (slug, name, name_ar, owner_id) values (v_slug, v_name, v_name_ar, v_uid) returning * into g;
  exception when unique_violation then
    if exists (select 1 from gyms where owner_id = v_uid) then raise exception 'dup'; end if;
    raise exception 'slug_taken';
  end;
  insert into gym_staff (gym_id, user_id, role, name)
  values (g.id, v_uid, 'owner', rf_line(auth.jwt() -> 'user_metadata' ->> 'name'));
  return rf_gym_json(g);
end $$;

create or replace function public.owner_get_gym() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid; g gyms;
begin
  v_uid := rf_uid();
  select * into g from gyms where owner_id = v_uid;
  if not found then return null; end if;
  return jsonb_build_object(
    'gym', rf_gym_json(g),
    'packages', (select coalesce(jsonb_agg(rf_pkg_json(p) order by p.sort, p.price, p.created_at), '[]'::jsonb)
                 from packages p where p.gym_id = g.id and p.deleted_at is null),
    'counts', (select jsonb_build_object(
                 'members', count(*) filter (where m.status in ('listed', 'active')),
                 'active',  count(*) filter (where m.status = 'active'),
                 'listed',  count(*) filter (where m.status = 'listed'),
                 'guests',  count(*) filter (where m.status = 'guest'))
               from memberships m where m.gym_id = g.id));
end $$;

create or replace function public.owner_update_gym(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  g gyms; k text; v jsonb; t text;
  v_brand jsonb; v_settings jsonb; v_pay jsonb;
begin
  g := rf_owner_gym();
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'bad_input'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) x
             where x not in ('name', 'name_ar', 'brand', 'settings', 'pay')) then
    raise exception 'bad_input';
  end if;

  if p_patch ? 'name' then
    t := rf_line(p_patch ->> 'name');
    if jsonb_typeof(p_patch -> 'name') <> 'string' or t is null or char_length(t) not between 2 and 60 then
      raise exception 'bad_input';
    end if;
    g.name := t;
  end if;

  if p_patch ? 'name_ar' then
    if jsonb_typeof(p_patch -> 'name_ar') not in ('string', 'null') then raise exception 'bad_input'; end if;
    t := rf_line(p_patch ->> 'name_ar');
    if t is not null and char_length(t) > 60 then raise exception 'bad_input'; end if;
    g.name_ar := t;
  end if;

  if p_patch ? 'brand' then
    if jsonb_typeof(p_patch -> 'brand') <> 'object' then raise exception 'bad_input'; end if;
    v_brand := g.brand;
    for k, v in select * from jsonb_each(p_patch -> 'brand') loop
      if k in ('primary', 'accent') then
        if jsonb_typeof(v) = 'null' then v_brand := v_brand - k;
        elsif jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$' then
          v_brand := v_brand || jsonb_build_object(k, v #>> '{}');
        else raise exception 'bad_input';
        end if;
      elsif k = 'logo' then
        if jsonb_typeof(v) = 'null' then v_brand := v_brand - k;
        elsif jsonb_typeof(v) = 'string' and (
                rf_img_ok(v #>> '{}', 205000)
                or ((v #>> '{}') ~ '^https://[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$' and char_length(v #>> '{}') <= 300)) then
          v_brand := v_brand || jsonb_build_object(k, v #>> '{}');
        else raise exception 'bad_input';
        end if;
      else
        raise exception 'bad_input';
      end if;
    end loop;
    g.brand := v_brand;
  end if;

  if p_patch ? 'settings' then
    if jsonb_typeof(p_patch -> 'settings') <> 'object' then raise exception 'bad_input'; end if;
    v_settings := g.settings;
    for k, v in select * from jsonb_each(p_patch -> 'settings') loop
      if k = 'cross' and jsonb_typeof(v) = 'boolean' then
        v_settings := v_settings || jsonb_build_object(k, v);
      elsif k = 'posts' and jsonb_typeof(v) = 'string' and (v #>> '{}') in ('all', 'approve', 'off') then
        v_settings := v_settings || jsonb_build_object(k, v);
      else
        raise exception 'bad_input';
      end if;
    end loop;
    g.settings := v_settings;
  end if;

  if p_patch ? 'pay' then
    if jsonb_typeof(p_patch -> 'pay') <> 'object' then raise exception 'bad_input'; end if;
    v_pay := g.pay;
    for k, v in select * from jsonb_each(p_patch -> 'pay') loop
      if k = 'cash' and jsonb_typeof(v) = 'boolean' then
        v_pay := v_pay || jsonb_build_object(k, v);
      elsif k in ('instapay', 'wallet') then
        t := case when jsonb_typeof(v) = 'string' then rf_line(v #>> '{}') end;
        if jsonb_typeof(v) not in ('string', 'null') then raise exception 'bad_input'; end if;
        if t is null then v_pay := v_pay - k;
        elsif (k = 'instapay' and char_length(t) <= 100) or (k = 'wallet' and char_length(t) <= 30) then
          v_pay := v_pay || jsonb_build_object(k, t);
        else raise exception 'bad_input';
        end if;
      else
        raise exception 'bad_input';
      end if;
    end loop;
    g.pay := v_pay;
  end if;

  update gyms set name = g.name, name_ar = g.name_ar, brand = g.brand, settings = g.settings, pay = g.pay
  where id = g.id;
  if g.status = 'live' then perform rf_check_live(g.id); end if;
  return rf_gym_json(g);
end $$;

create or replace function public.owner_upsert_package(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  g gyms; r packages; v_new boolean := true; v_id uuid;
begin
  g := rf_owner_gym();
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'bad_input'; end if;
  if exists (select 1 from jsonb_object_keys(p) x
             where x not in ('id', 'name', 'name_ar', 'months', 'price', 'before_price', 'until', 'active', 'sort')) then
    raise exception 'bad_input';
  end if;

  v_id := rf_uuid(p ->> 'id');
  if v_id is not null then
    select * into r from packages where id = v_id and gym_id = g.id and deleted_at is null for update;
    if not found then raise exception 'not_found'; end if;
    v_new := false;
  else
    if (select count(*) from packages where gym_id = g.id and deleted_at is null) >= 20 then
      raise exception 'limit';
    end if;
    r.active := true;
    r.sort := 0;
  end if;

  if p ? 'name' then r.name := rf_line(p ->> 'name'); end if;
  if p ? 'name_ar' then r.name_ar := rf_line(p ->> 'name_ar'); end if;
  if p ? 'months' then r.months := rf_int(p ->> 'months'); end if;
  if p ? 'price' then r.price := rf_int(p ->> 'price'); end if;
  if p ? 'before_price' then r.before_price := rf_int(p ->> 'before_price'); end if;
  if p ? 'until' then r.until := rf_date(p ->> 'until'); end if;
  if p ? 'active' then
    if jsonb_typeof(p -> 'active') <> 'boolean' then raise exception 'bad_input'; end if;
    r.active := (p ->> 'active')::boolean;
  end if;
  if p ? 'sort' and jsonb_typeof(p -> 'sort') <> 'null' then r.sort := rf_int(p ->> 'sort'); end if;

  if r.name is null or char_length(r.name) > 60 then raise exception 'bad_input'; end if;
  if r.name_ar is not null and char_length(r.name_ar) > 60 then raise exception 'bad_input'; end if;
  if r.months is null or r.months not between 1 and 36 then raise exception 'bad_input'; end if;
  if r.price is null or r.price <= 0 or r.price > 10000000 then raise exception 'bad_input'; end if;
  if r.sort is null or r.sort not between -100000 and 100000 then raise exception 'bad_input'; end if;
  if r.before_price is not null then
    if r.until is null then raise exception 'before_needs_until'; end if;
    if r.before_price <= r.price or r.before_price > 10000000 then raise exception 'bad_input'; end if;
  end if;

  if v_new then
    insert into packages (gym_id, name, name_ar, months, price, before_price, until, active, sort)
    values (g.id, r.name, r.name_ar, r.months, r.price, r.before_price, r.until, r.active, r.sort)
    returning * into r;
  else
    update packages set name = r.name, name_ar = r.name_ar, months = r.months, price = r.price,
      before_price = r.before_price, until = r.until, active = r.active, sort = r.sort
    where id = r.id returning * into r;
  end if;
  if g.status = 'live' then perform rf_check_live(g.id); end if;
  return rf_pkg_json(r);
end $$;

create or replace function public.owner_delete_package(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms;
begin
  g := rf_owner_gym();
  update packages set deleted_at = now(), active = false
  where id = p_id and gym_id = g.id and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  if g.status = 'live' then perform rf_check_live(g.id); end if;
  return jsonb_build_object('ok', true);
end $$;

-- errors[].row is the 0 based index in p_rows; codes: bad_row, bad_phone, bad_name, bad_gender, bad_package, bad_date
create or replace function public.owner_import_members(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  g gyms; r jsonb; i int := -1;
  v_added int := 0; v_updated int := 0; v_errors jsonb := '[]'::jsonb;
  v_phone text; v_name text; v_gender text; v_pkg packages; v_pkg_id uuid; v_starts date; v_ends date;
  m memberships; v_code text;
begin
  g := rf_owner_gym();
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'bad_input'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'limit'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_code := null; v_pkg_id := null; v_starts := null; v_ends := null; v_gender := null;
    if jsonb_typeof(r) <> 'object' then
      v_code := 'bad_row';
    else
      v_phone := rf_phone(r ->> 'phone');
      v_name := rf_line(r ->> 'name');
      if v_phone is null then v_code := 'bad_phone';
      elsif v_name is null or char_length(v_name) not between 2 and 60 then v_code := 'bad_name';
      end if;
      if v_code is null and coalesce(btrim(r ->> 'gender'), '') <> '' then
        v_gender := rf_gender(r ->> 'gender');
        if v_gender is null then v_code := 'bad_gender'; end if;
      end if;
      if v_code is null and coalesce(btrim(r ->> 'package_id'), '') <> '' then
        begin
          select * into v_pkg from packages
          where id = (r ->> 'package_id')::uuid and gym_id = g.id and deleted_at is null;
          if found then v_pkg_id := v_pkg.id; else v_code := 'bad_package'; end if;
        exception when others then v_code := 'bad_package';
        end;
      end if;
      if v_code is null then
        begin
          v_starts := rf_date(r ->> 'starts');
          v_ends := rf_date(r ->> 'ends');
          if v_starts is not null and v_ends is not null and v_ends < v_starts then v_code := 'bad_date'; end if;
          if v_starts is not null and v_ends is null and v_pkg_id is not null then
            v_ends := (v_starts + make_interval(months => v_pkg.months))::date;
          end if;
        exception when others then v_code := 'bad_date';
        end;
      end if;
    end if;

    if v_code is not null then
      v_errors := v_errors || jsonb_build_object('row', i, 'code', v_code);
      continue;
    end if;

    select * into m from memberships where gym_id = g.id and phone = v_phone for update;
    if found then
      update memberships set
        name = v_name,
        gender = coalesce(v_gender, gender),
        package_id = coalesce(v_pkg_id, package_id),
        starts = coalesce(v_starts, starts),
        ends = coalesce(v_ends, ends),
        status = case when status = 'guest' then 'active' else status end
      where id = m.id;
      v_updated := v_updated + 1;
    else
      insert into memberships (gym_id, phone, name, gender, package_id, starts, ends, status)
      values (g.id, v_phone, v_name, v_gender, v_pkg_id, v_starts, v_ends, 'listed');
      v_added := v_added + 1;
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'errors', v_errors);
end $$;

create or replace function public.owner_go_live() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms;
begin
  g := rf_owner_gym();
  perform rf_check_live(g.id);
  update gyms set status = 'live' where id = g.id returning * into g;
  return rf_gym_json(g);
end $$;

create or replace function public.owner_home() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare g gyms; v_needs jsonb; v_stats jsonb;
begin
  g := rf_owner_gym();

  select coalesce(jsonb_agg(n.j order by n.at), '[]'::jsonb) into v_needs from (
    select x.at, x.j from (
      -- payments waiting for a decision
      select pay.created_at as at, jsonb_build_object('k', 'pay', 'id', pay.id, 'at', pay.created_at, 'name', m.name,
               'phone', m.phone, 'membership_id', m.id, 'amount', pay.amount, 'method', pay.method, 'ref', pay.ref,
               'package', rf_pkg_brief(pay.package_id), 'ends', m.ends, 'member_status', m.status) as j
      from payments pay join memberships m on m.id = pay.membership_id
      where pay.gym_id = g.id and pay.status = 'pending'
      union all
      -- people who joined but are not on the list
      select m.created_at, jsonb_build_object('k', 'guest', 'id', m.id, 'at', m.created_at, 'name', m.name,
               'phone', m.phone, 'gender', m.gender)
      from memberships m where m.gym_id = g.id and m.status = 'guest'
      union all
      -- reports always reach the owner with the post attached
      select r.at, jsonb_build_object('k', 'report', 'id', r.id, 'at', r.at,
               'name', (select p.name from profiles p where p.user_id = r.by_user),
               'reason', r.reason,
               'about', case when r.about_user is null then null else
                   jsonb_build_object('user_id', r.about_user,
                     'name', (select p.name from profiles p where p.user_id = r.about_user)) end,
               'post', (select jsonb_build_object('id', po.id, 'body', po.body, 'img', po.img, 'status', po.status, 'at', po.at)
                        from posts po where po.id = r.about_post))
      from reports r where r.gym_id = g.id and r.status = 'open'
      union all
      -- posts waiting for approval; the owner sees a post only if its author has vis = 'all'
      select po.at, jsonb_build_object('k', 'post', 'id', po.id, 'at', po.at, 'name', p.name,
               'body', po.body, 'img', po.img)
      from posts po join profiles p on p.user_id = po.by_user
      where po.gym_id = g.id and po.status = 'pending' and p.vis = 'all'
    ) x order by x.at limit 200
  ) n;

  select jsonb_build_object(
    'members', (select count(*) from memberships m where m.gym_id = g.id and m.status in ('listed', 'active')),
    'active_now', (select count(distinct c.membership_id) from checkins c
                   where c.gym_id = g.id and c.at > now() - interval '2 hours'),
    'checkins_today', (select count(*) from checkins c where c.gym_id = g.id and c.at >= rf_day_start()),
    'expiring_7d', (select count(*) from memberships m where m.gym_id = g.id and m.status in ('listed', 'active')
                    and m.ends between rf_today() and rf_today() + 7),
    'refkas', (select count(*) from refkas r where r.gym_id = g.id and r.ended_at is null)
  ) into v_stats;

  return jsonb_build_object('gym', rf_gym_json(g), 'needs', v_needs, 'stats', v_stats);
end $$;

create or replace function public.owner_members(p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare g gyms; v_q text; v_digits text;
begin
  g := rf_owner_gym();
  v_q := lower(coalesce(rf_line(left(p_q, 80)), ''));
  v_digits := regexp_replace(v_q, '[^0-9]', '', 'g');
  if v_digits ~ '^0[0-9]' then v_digits := substr(v_digits, 2); end if;   -- 010.. also finds +2010..
  return (
    select coalesce(jsonb_agg(x.j order by x.name, x.id), '[]'::jsonb) from (
      select m.name, m.id, jsonb_build_object('id', m.id, 'name', m.name, 'phone', m.phone, 'gender', m.gender,
               'status', m.status, 'package', rf_pkg_brief(m.package_id), 'starts', m.starts, 'ends', m.ends,
               'joined', m.user_id is not null,
               'last_checkin', (select max(c.at) from checkins c where c.membership_id = m.id)) as j
      from memberships m
      where m.gym_id = g.id
        and (v_q = '' or position(v_q in lower(m.name)) > 0
             or (v_digits <> '' and position(v_digits in m.phone) > 0))
      order by m.name, m.id
      limit 2000
    ) x);
end $$;

create or replace function public.owner_decide_payment(p_id uuid, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms; pay payments; m memberships; pk packages; v_from date; v_ends date;
begin
  g := rf_owner_gym();
  if p_ok is null then raise exception 'bad_input'; end if;
  select * into pay from payments where id = p_id and gym_id = g.id and status = 'pending' for update;
  if not found then raise exception 'not_found'; end if;

  if p_ok then
    select * into m from memberships where id = pay.membership_id and gym_id = g.id for update;
    if not found then raise exception 'not_found'; end if;
    select * into pk from packages where id = pay.package_id and gym_id = g.id;
    if not found then raise exception 'not_found'; end if;
    v_from := greatest(rf_today(), coalesce(m.ends, rf_today()));
    v_ends := (v_from + make_interval(months => pk.months))::date;
    update memberships set
      package_id = pk.id,
      starts = case when m.starts is null or m.ends is null or m.ends < rf_today() then rf_today() else m.starts end,
      ends = v_ends,
      status = case when m.user_id is not null then 'active' else m.status end
    where id = m.id;
  end if;

  update payments set status = case when p_ok then 'ok' else 'rejected' end,
    decided_by = auth.uid(), decided_at = now()
  where id = pay.id;
  return jsonb_build_object('ok', true, 'ends', v_ends);
end $$;

create or replace function public.owner_decide_guest(p_membership_id uuid, p_ok boolean,
  p_package_id uuid default null, p_ends date default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms; m memberships; pk packages; v_ends date;
begin
  g := rf_owner_gym();
  if p_ok is null then raise exception 'bad_input'; end if;
  select * into m from memberships where id = p_membership_id and gym_id = g.id and status = 'guest' for update;
  if not found then raise exception 'not_found'; end if;

  if not p_ok then
    delete from memberships where id = m.id;      -- cascades to his pending payment, if any
    return jsonb_build_object('ok', true);
  end if;

  if p_package_id is not null then
    select * into pk from packages where id = p_package_id and gym_id = g.id and deleted_at is null;
    if not found then raise exception 'not_found'; end if;
  end if;
  if p_ends is not null and (p_ends < rf_today() or p_ends > rf_today() + 3660) then
    raise exception 'bad_input';
  end if;
  v_ends := coalesce(p_ends, case when pk.id is not null
                                  then (rf_today() + make_interval(months => pk.months))::date end);
  update memberships set status = 'active', package_id = pk.id, starts = rf_today(), ends = v_ends
  where id = m.id;
  return jsonb_build_object('ok', true, 'ends', v_ends);
end $$;

create or replace function public.owner_decide_post(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms;
begin
  g := rf_owner_gym();
  if p_action is null or p_action not in ('approve', 'hide') then raise exception 'bad_input'; end if;
  update posts set status = case when p_action = 'approve' then 'live' else 'hidden' end
  where id = p_id and gym_id = g.id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.owner_resolve_report(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms;
begin
  g := rf_owner_gym();
  update reports set status = 'done' where id = p_id and gym_id = g.id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Token problems raise: bad_input (garbage, wrong gym, bad signature) or expired (too old, or already used).
-- A good token of a member whose membership is over returns {ok:false, valid:false, name, ends}.
create or replace function public.owner_scan(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  g gyms; m memberships; v_parts text[]; v_bucket bigint; v_now bigint; v_written boolean;
begin
  g := rf_owner_gym();
  if p_token is null or char_length(p_token) > 120 then raise exception 'bad_input'; end if;
  v_parts := string_to_array(btrim(p_token), '.');
  if array_length(v_parts, 1) is distinct from 4 or v_parts[1] <> 'rf1'
     or v_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[3] !~ '^[0-9]{1,12}$'
     or v_parts[4] !~ '^[0-9a-f]{32}$' then
    raise exception 'bad_input';
  end if;
  v_bucket := v_parts[3]::bigint;

  select * into m from memberships where id = v_parts[2]::uuid and gym_id = g.id for update;
  if not found then raise exception 'bad_input'; end if;          -- another gym's member looks like garbage
  if rf_qr_sig(g.qr_secret, m.id, v_bucket) <> v_parts[4] then raise exception 'bad_input'; end if;

  v_now := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
  if v_bucket > v_now then raise exception 'bad_input'; end if;
  if v_bucket < v_now - 1 then raise exception 'expired'; end if;  -- current and previous bucket only

  if m.qr_used_bucket is not null and v_bucket <= m.qr_used_bucket then
    -- the camera often fires twice: the very same token within 10 s is answered again, anything else is a replay
    if v_bucket = m.qr_used_bucket and m.qr_used_at > clock_timestamp() - interval '10 seconds' then
      return jsonb_build_object('ok', true, 'valid', true, 'name', m.name, 'ends', m.ends, 'already', true);
    end if;
    raise exception 'expired';
  end if;

  if m.status <> 'active' or m.user_id is null or (m.ends is not null and m.ends < rf_today()) then
    return jsonb_build_object('ok', false, 'valid', false, 'name', m.name, 'ends', m.ends, 'already', false);
  end if;

  update memberships set qr_used_bucket = v_bucket, qr_used_at = clock_timestamp() where id = m.id;
  v_written := rf_checkin(g.id, m.id, 'qr');
  return jsonb_build_object('ok', true, 'valid', true, 'name', m.name, 'ends', m.ends, 'already', not v_written);
end $$;

create or replace function public.owner_checkin(p_membership_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare g gyms; m memberships; v_written boolean;
begin
  g := rf_owner_gym();
  select * into m from memberships where id = p_membership_id and gym_id = g.id for update;
  if not found then raise exception 'not_found'; end if;
  if m.status = 'guest' then raise exception 'not_member'; end if;
  if m.ends is not null and m.ends < rf_today() then raise exception 'expired'; end if;
  v_written := rf_checkin(g.id, m.id, 'desk');
  return jsonb_build_object('ok', true, 'already', not v_written);
end $$;
