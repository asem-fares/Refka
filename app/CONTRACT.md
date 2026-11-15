# Refka app v1: system contract (frozen 15 Nov 2026)

Goal: first real gym live. Owner signs up on the website, sets up his gym, goes live, gets a link + QR.
Members join with phone + PIN, see membership, renew, check in by QR, send "Train together?" requests,
chat after a yes, and post to the gym feed. Arabic (Egyptian) + English, RTL aware, mobile first.

Stack now: Supabase (Postgres 15+, Auth, hosted). Static front end served from this repo under /app/.
Rule that makes later migration cheap: **the front end never touches tables. Every read and write is one
Postgres function call (RPC).** All tables have RLS enabled with NO policies, so direct access is denied.
All functions are `security definer`, `set search_path = public, extensions`, check `auth.uid()` themselves,
return `jsonb`, and raise exceptions with a short code as message (see Errors).

## Layout
- `supabase/migrations/*.sql`  schema + functions (backend agent owns)
- `supabase/tests/`            SQL/JS tests run against local Postgres 16 (backend agent owns)
- `dev/server.js`              local Supabase-compatible mock (backend agent owns), port 54321
- `app/lib/api.js`             shared client (lead owns; do not edit, ask in your report)
- `app/config.js`              SUPABASE_URL + ANON key (placeholders; dev values on localhost)
- `app/owner/`                 owner console (owner agent owns)
- `app/index.html` + `app/m/`  member app (member agent owns). Gym chosen by `?g=<slug>`
- No build step. Vanilla JS modules. supabase-js 2.x UMD from jsdelivr, pinned.

## Auth
- Owner: email + password (min 8).
- Member: phone + 6 digit PIN. Client turns the phone into a synthetic email:
  digits only, Egyptian local `01xxxxxxxxx` becomes `201xxxxxxxxx`; email = `p<digits>@m.refka.app`; password = PIN.
  `signUp` passes `options.data = {phone:'+<digits>', kind:'member'}`; owners pass `{kind:'owner'}`.
- SQL helper `my_phone()` reads the phone from `auth.jwt() -> 'user_metadata' ->> 'phone'`.
- Known debt (accepted for pilot): PIN strength, PIN reset needs an admin function, no SMS proof of phone.
  Phone ownership is proven instead by the gym: a member is "verified" only when his phone is on the gym's list
  or the owner approves him.

## Tables (public)
gyms(id uuid pk, slug text unique, name text, name_ar text, country text default 'EG', currency text default 'EGP',
  brand jsonb {primary,accent,logo}, settings jsonb {cross:bool=true, posts:'all'|'approve'|'off'='all'},
  pay jsonb {instapay?:text, wallet?:text, cash:bool}, status text 'draft'|'live', owner_id uuid, qr_secret text, created_at)
gym_staff(gym_id, user_id, role text default 'owner', name text, pk(gym_id,user_id))
packages(id uuid pk, gym_id, name, name_ar, months int, price int, before_price int null, until date null, active bool, sort int)
memberships(id uuid pk, gym_id, phone text, name text, gender text 'm'|'f' null, package_id null, starts date null, ends date null,
  user_id uuid null, status text 'listed'|'active'|'guest', created_at, unique(gym_id, phone))
  -- listed = imported by owner, nobody joined yet; active = linked to a user; guest = joined but not on the list, waits for owner
profiles(user_id uuid pk, phone, name, gender, birth_year int, bio text, goal text, level text, times text[],
  vis text 'all'|'gender'|'none' default (f: 'gender', m: 'all'), avatar text null (data URL, <= 40 KB), created_at)
payments(id, gym_id, membership_id, package_id, amount int, method text 'instapay'|'wallet'|'cash', ref text, status 'pending'|'ok'|'rejected',
  created_at, decided_by, decided_at)
checkins(id, gym_id, membership_id, at timestamptz, via 'qr'|'desk')
requests(id, gym_id, from_user, to_user, kind 'train'|'spot', slot text, status 'pending'|'accepted'|'declined'|'cancelled', created_at)
refkas(id, gym_id, a uuid, b uuid, since, ended_at null)        -- a < b
messages(id, refka_id, from_user, body text <= 1000, at)
blocks(blocker, blocked, pk)
reports(id, gym_id, by_user, about_user null, about_post null, reason text, status 'open'|'done', at)
posts(id, gym_id, by_user, body text <= 500, img text null (data URL <= 150 KB), status 'live'|'pending'|'hidden', at)
post_respects(post_id, user_id, pk)

## Visibility rule (one SQL function `can_see(viewer uuid, target uuid, gym uuid) returns bool`, used everywhere)
false if same user is not required (self is always true); false if either blocked the other; false if target.vis='none';
both must have an active membership in the gym (ends is null or >= today - 7 days);
minors (current year - birth_year < 18) see and are seen by minors only;
same gender: true; different gender: true only if gym.settings.cross and target.vis='all' and viewer.vis='all'.
Posts follow the author: a post is visible iff can_see(viewer, author) (author always sees own). The owner sees a post
iff the author's vis='all' (reports always reach him with the post attached).

## RPC list (name(args) -> jsonb). Args are named exactly as shown.
Public (anon allowed)
- gym_public(p_slug) -> {id,slug,name,name_ar,brand,status,packages:[{id,name,name_ar,months,price,before_price,until}]} ; null if not live

Owner (caller must be gym owner; gym is found from auth.uid(), one gym per owner in v1)
- owner_create_gym(p_name, p_name_ar, p_slug) -> gym   (slug: a-z0-9- 3..30, unique, reserved words rejected)
- owner_get_gym() -> {gym, packages:[...], counts:{members,active,listed,guests}} ; null if he has no gym yet
- owner_update_gym(p_patch jsonb) -> gym   (allowed keys: name,name_ar,brand,settings,pay)
- owner_upsert_package(p jsonb {id?,name,name_ar,months,price,before_price?,until?,active?,sort?}) -> package
     before_price only with until (else error before_needs_until)
- owner_delete_package(p_id) -> {ok}
- owner_import_members(p_rows jsonb array of {phone,name,gender?,package_id?,starts?,ends?}) -> {added,updated,errors:[{row,code}]}
- owner_go_live() -> gym   (needs >=1 active package and a pay method; errors need_package, need_pay)
- owner_home() -> {gym, needs:[{k:'pay'|'guest'|'report'|'post', id, at, name, ...detail}], stats:{members,active_now,checkins_today,expiring_7d,refkas}}
- owner_members(p_q text default '') -> [{id,name,phone,gender,status,package,ends,joined:bool,last_checkin}]
- owner_decide_payment(p_id, p_ok bool) -> {ok}   (ok: membership.package/starts/ends extended from max(today, ends))
- owner_decide_guest(p_membership_id, p_ok bool, p_package_id null, p_ends date null) -> {ok}
- owner_decide_post(p_id, p_action 'approve'|'hide') -> {ok}
- owner_resolve_report(p_id) -> {ok}
- owner_scan(p_token text) -> {ok, name, ends, valid:bool}   (verifies member QR, writes a check-in, once per 3 hours)
- owner_checkin(p_membership_id) -> {ok}

Member
- me() -> {profile|null, memberships:[{id,gym:{id,slug,name,name_ar,brand},status,package,ends}]}
- member_join(p_slug, p_name, p_gender, p_birth_year) -> {membership, matched:bool}
     creates/updates profile; phone on the list -> status active, matched true; else creates guest + owner 'guest' need
- update_profile(p_patch jsonb) -> profile   (keys: name,bio,goal,level,times,vis,avatar)
- member_home(p_gym) -> {gym, membership:{status,package,ends,days_left}, qr:{token,exp}, here_now:int, week_checkins:int, pending_payment:bool}
     qr only when membership active and not expired; token rotates every 60 s
- member_renew(p_gym, p_package_id, p_method, p_ref) -> {payment}   (ref required >= 4 chars unless cash; one pending at a time)
- people(p_gym, p_q text default '') -> [{user_id,name,gender,goal,level,times,bio,avatar,overlap:int,relation:'none'|'out'|'in'|'refka'}]
- request_send(p_gym, p_to, p_kind, p_slot) -> {request}  (max 5 a day; no duplicate pending; needs can_see; errors limit, dup, hidden)
- request_respond(p_id, p_accept bool) -> {ok, refka_id?}
- request_cancel(p_id) -> {ok}
- requests_list(p_gym) -> {incoming:[{id,kind,slot,at,from:{user_id,name,avatar,goal}}], outgoing:[{id,kind,slot,at,status,to:{...}}]}
- refkas_list(p_gym) -> [{id,since,with:{user_id,name,avatar},last:{body,at,mine}|null,unread:int}]
- refka_end(p_id) -> {ok}
- chat_list(p_refka, p_after timestamptz default null) -> [{id,body,at,mine:bool}]  (marks read)
- chat_send(p_refka, p_body) -> {id,at}   (only while refka not ended and nobody blocked)
- block_user(p_user) -> {ok}   (ends any refka, cancels requests)
- report(p_gym, p_user default null, p_post default null, p_reason text) -> {ok}
- feed(p_gym, p_before timestamptz default null) -> [{id,body,img,at,status,mine:bool,by:{user_id,name,avatar},respects:int|null (only if mine),respected:bool}] (20 per page)
- post_create(p_gym, p_body, p_img default null) -> {post}   (off -> error posts_off; approve -> status pending)
- post_respect(p_id) -> {ok}
- post_delete(p_id) -> {ok}

## Errors
Functions `raise exception '<code>'`. Codes: not_auth, not_owner, not_member, not_found, bad_input, slug_taken, slug_bad,
need_package, need_pay, before_needs_until, limit, dup, hidden, blocked, posts_off, expired, pending_exists.
The client maps codes to friendly EN/AR text; unknown codes show a generic message.

## Deviations
(backend agent: list any change to a signature here, with the reason)
