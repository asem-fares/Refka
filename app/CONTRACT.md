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
  digits only, Egyptian local `01xxxxxxxxx` becomes `201xxxxxxxxx`; email = `p<digits>@m.refka.tech`; password = PIN.
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

See the list below (written by the backend agent, 16 Nov 2026). No function name or argument changed. Items marked
(+) only add keys to a result; front ends can ignore them.

Platform and security
1. `search_path = public, extensions, pg_temp` on every function (pg_temp last). Without it a session's temporary
   table could shadow a public table inside a security definer function (shown by a test, fixed).
2. `my_phone()` does NOT read `user_metadata.phone` (the user can edit his own metadata with `auth.updateUser`).
   It returns the profile's phone once a profile exists, and before that derives it from the synthetic login email
   `p<digits>@m.refka.tech`, which is unique in auth. `user_metadata.phone` is ignored by the backend.
3. Only `gym_public` is executable by anon; every other RPC by authenticated only; `rf_*`, `can_see`, `my_phone`
   and any function not on the list in 0004 by nobody. Default privileges for future objects in public are revoked.
4. STABLE functions never write, because PostgREST runs them read-only (dev/common.js now does the same).
5. Owner password minimum 8 is a client rule. The Supabase project minimum is 6 (member PIN), so the backend accepts 6.
6. `can_see(viewer, target, gym, p_known boolean default false)`: extra optional arg. `p_known = true` is the relaxed
   form for an existing refka: a partner who later chose vis 'none' stays visible to him; blocks, membership, the
   minors rule and the gender rule still apply (cross gender then needs gym.cross and neither side vis 'gender').
7. The gym's gender on the membership row wins over the self declared profile gender, in can_see and in member_join.
8. "Active membership" for social features means linked, status 'active', and ends null or >= today - 7 (7 day grace).
   QR, scan and desk check-in use the strict rule (ends >= today). Dates are Africa/Cairo dates.

Public and owner
9. `gym_public` (+) `currency`. Package prices are effective prices: while an offer runs `price` is the offer and
   `before_price`/`until` are shown; once `until` has passed `price` becomes `before_price` and the offer fields are null.
10. Gym json everywhere (+) `country, currency, settings, pay, created_at`; never `owner_id` or `qr_secret`.
11. `owner_create_gym`: `dup` when the owner already has a gym. Slug is trimmed and lower cased first.
12. `owner_upsert_package`: at most 20 packages per gym (`limit`); `bad_input` when before_price <= price.
    `owner_delete_package` is a soft delete (old payments and memberships keep their package).
    On a live gym, any change that leaves no active package or no pay method is refused (`need_package`, `need_pay`).
13. `owner_import_members`: `errors[].row` is the 0 based index; codes `bad_row, bad_phone, bad_name, bad_gender,
    bad_package, bad_date`; max 2000 rows (`limit`). With starts + package and no ends, ends = starts + months.
    A row whose phone is a guest turns that guest active.
14. `owner_home` needs (+): pay `{phone, membership_id, amount, method, ref, package, ends, member_status}`,
    guest `{phone, gender}`, report `{reason, about:{user_id,name}|null, post:{id,body,img,status,at}|null}`,
    post `{body, img}` (only authors with vis 'all').
15. `owner_members` (+) `starts`. Search matches name, or phone digits (a leading 0 is dropped so 010.. finds +2010..).
16. `owner_decide_payment` and `owner_decide_guest` return `{ok, ends}` (+). `owner_decide_guest(false)` deletes the
    guest membership (and his pending payment). Approving a payment of a guest also makes him active.
17. `owner_scan`: a bad, foreign or tampered token raises `bad_input`; a token older than the previous 60 s bucket, or a
    reused token (except the same token again within 10 s, answered with `already:true`), raises `expired`.
    A good token of a member whose membership is over returns `{ok:false, valid:false, name, ends}`.
    Result (+) `already` (true when a check-in exists in the last 3 hours, so none was written).
18. `owner_checkin` returns `{ok, already}` (+); `not_member` for a guest, `expired` for an expired membership.

Member
19. `me()` (+) `is_owner`; memberships (+) `starts, days_left`.
20. `member_join`: `bad_input` for an account without a phone email; birth year must give age 13..90; `dup` if the
    phone's membership is linked to another account; a guest cap of 500 per gym (`limit`). Joining again never
    changes the existing profile's name, gender or birth year.
21. `update_profile`: switching away from vis 'all' publishes his pending posts (the owner may no longer see them) and
    cancels pending requests with people who can no longer see him. Avatar: png/jpeg/webp data URL <= 56000 chars.
22. `member_home` (+) `membership.id, membership.starts`, `qr.exp_at, qr.ttl` (`exp` is epoch seconds),
    `gym.currency, settings, pay, status, packages`. `here_now` counts only people the member may see, himself, and not yet joined listed members of his gender.
23. `member_renew`: the method must be one the gym takes; amount is the effective package price.
24. `request_send`: `dup` also while a refka is open and for 14 days after the same person declined; the 5 a day limit
    counts every request sent that Cairo day in any gym, cancelled ones included.
25. `request_respond`: decline needs no visibility; accept needs both to see each other (`hidden`).
26. `requests_list.outgoing` also lists accepted and declined requests of the last 14 days (with `status`).
27. `chat_list` returns at most the latest 200 messages. `chat_send`: 30 messages a minute (`limit`); `hidden` when the
    partner can no longer be seen, `not_member` when the caller's membership lapsed, `not_found` after end or block.
28. `report`: the reason is required although it has a default (Postgres needs defaults after p_user/p_post);
    10 reports a day; only a live post the reporter can see; `p_user` with `p_post` must be the post's author.
29. `feed` returns `[]` when posts are 'off'; the author also sees his own pending and hidden posts (with `status`).
30. `post_create`: approve mode sets 'pending' only for authors with vis 'all' (the owner may not see the others);
    10 posts a day; image png/jpeg/webp data URL <= 205000 chars (about 150 KB binary), no svg.
31. `post_respect` toggles and returns `{ok, respected}` (+).
