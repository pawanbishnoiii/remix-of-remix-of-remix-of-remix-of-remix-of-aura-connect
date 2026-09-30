create type public.app_role as enum ('admin','moderator','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','moderator'))
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text unique check (display_name is null or char_length(display_name) between 3 and 24),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 160),
  pronouns text check (pronouns is null or char_length(pronouns) <= 24),
  tags text[] not null default '{}',
  country_code text,
  onboarding_completed boolean not null default false,
  is_banned boolean not null default false,
  banned_until timestamptz,
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then
    new.is_banned := old.is_banned;
    new.banned_until := old.banned_until;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  languages text[] not null default '{}',
  interests text[] not null default '{}',
  preferred_countries text[] not null default '{}',
  default_mode text not null default 'video' check (default_mode in ('video','audio','text')),
  similar_interests boolean not null default true,
  broaden_after_wait boolean not null default true,
  auto_next boolean not null default false,
  approximate_country text,
  approximate_region text,
  location_enabled boolean not null default false,
  discoverable boolean not null default true,
  theme text not null default 'dark',
  mirror_preview boolean not null default true,
  effects_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
create trigger prefs_touch before update on public.user_preferences for each row execute function public.touch_updated_at();
create policy "prefs owner select" on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy "prefs owner insert" on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "prefs owner update" on public.user_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_type text not null check (policy_type in ('terms','privacy','guidelines','age')),
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, policy_type, policy_version)
);
grant select, insert on public.policy_acceptances to authenticated;
grant all on public.policy_acceptances to service_role;
alter table public.policy_acceptances enable row level security;
create policy "acc owner select" on public.policy_acceptances for select to authenticated using (user_id = auth.uid());
create policy "acc owner insert" on public.policy_acceptances for insert to authenticated with check (user_id = auth.uid());

create table public.match_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','reserved','cancelled')),
  desired_mode text not null check (desired_mode in ('video','audio','text')),
  preference_snapshot jsonb not null default '{}',
  queued_at timestamptz not null default now(),
  reserved_session_id uuid,
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '45 seconds'
);
grant select on public.match_queue to authenticated;
grant all on public.match_queue to service_role;
alter table public.match_queue enable row level security;
create policy "queue owner select" on public.match_queue for select to authenticated using (user_id = auth.uid());
create index match_queue_status_idx on public.match_queue (status, expires_at, queued_at);

create table public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('video','audio','text')),
  initiator_id uuid not null,
  status text not null default 'created' check (status in ('created','connecting','connected','ended','failed','reported')),
  started_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  created_at timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);
grant select on public.conversation_sessions to authenticated;
grant all on public.conversation_sessions to service_role;
alter table public.conversation_sessions enable row level security;
create policy "session participants" on public.conversation_sessions for select to authenticated
  using (auth.uid() in (user_a_id, user_b_id) or public.is_staff(auth.uid()));
create index sessions_a_idx on public.conversation_sessions (user_a_id, created_at desc);
create index sessions_b_idx on public.conversation_sessions (user_b_id, created_at desc);
create index sessions_status_idx on public.conversation_sessions (status, created_at desc);

create table public.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.conversation_sessions(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.session_events to authenticated;
grant all on public.session_events to service_role;
alter table public.session_events enable row level security;
create policy "events staff" on public.session_events for select to authenticated using (public.is_staff(auth.uid()));
create index session_events_type_idx on public.session_events (event_type, created_at desc);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
grant select, insert, delete on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;
alter table public.user_blocks enable row level security;
create policy "blocks owner select" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy "blocks owner insert" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy "blocks owner delete" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());
create index blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  category text not null check (category in ('nudity','harassment','hate','minor','scam','violence','spam','impersonation','other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  resolution_note text
);
grant select on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports own or staff" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_staff(auth.uid()));
create index reports_status_idx on public.reports (status, created_at desc);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('warn','suspend','ban','unban','dismiss','review')),
  reason text not null,
  report_id uuid references public.reports(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;
alter table public.moderation_actions enable row level security;
create policy "modlog staff" on public.moderation_actions for select to authenticated using (public.is_staff(auth.uid()));

create table public.mutual_connections (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  user_a_accepted_at timestamptz,
  user_b_accepted_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','removed')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);
grant select on public.mutual_connections to authenticated;
grant all on public.mutual_connections to service_role;
alter table public.mutual_connections enable row level security;
create policy "conn participants" on public.mutual_connections for select to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mutual_connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_by_sender_at timestamptz,
  deleted_by_recipient_at timestamptz
);
grant select, insert, update on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;
alter table public.direct_messages enable row level security;
create index dm_conn_idx on public.direct_messages (connection_id, created_at desc);

create or replace function public.is_active_connection_member(_conn uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mutual_connections c
    where c.id = _conn and c.status = 'active' and _uid in (c.user_a_id, c.user_b_id)
    and not exists (select 1 from public.user_blocks b
      where (b.blocker_id = c.user_a_id and b.blocked_id = c.user_b_id)
         or (b.blocker_id = c.user_b_id and b.blocked_id = c.user_a_id)))
$$;

create policy "dm members read" on public.direct_messages for select to authenticated
  using (public.is_active_connection_member(connection_id, auth.uid()));
create policy "dm send" on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_active_connection_member(connection_id, auth.uid()));
create policy "dm update members" on public.direct_messages for update to authenticated
  using (public.is_active_connection_member(connection_id, auth.uid()));

create or replace function public.dm_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.direct_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little';
  end if;
  return new;
end $$;
create trigger dm_rate before insert on public.direct_messages for each row execute function public.dm_rate_limit();

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.conversation_sessions(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
grant select, insert on public.user_feedback to authenticated;
grant all on public.user_feedback to service_role;
alter table public.user_feedback enable row level security;
create policy "fb owner insert" on public.user_feedback for insert to authenticated with check (user_id = auth.uid());
create policy "fb owner select" on public.user_feedback for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "profile self" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "profile via session or connection" on public.profiles for select to authenticated using (
  not is_banned and (
    exists (select 1 from public.conversation_sessions s
      where s.status in ('created','connecting','connected') and
        ((s.user_a_id = auth.uid() and s.user_b_id = profiles.id) or (s.user_b_id = auth.uid() and s.user_a_id = profiles.id)))
    or exists (select 1 from public.mutual_connections c
      where c.status in ('active','pending') and
        ((c.user_a_id = auth.uid() and c.user_b_id = profiles.id) or (c.user_b_id = auth.uid() and c.user_a_id = profiles.id)))
  ));
create policy "profile self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.join_match_queue(_mode text, _snapshot jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if _mode not in ('video','audio','text') then raise exception 'Invalid mode'; end if;
  select * into p from public.profiles where id = uid;
  if not p.onboarding_completed then raise exception 'Finish onboarding first'; end if;
  if p.is_banned or (p.banned_until is not null and p.banned_until > now()) then raise exception 'Account restricted'; end if;
  if (select count(*) from public.session_events where actor_id = uid and event_type = 'queue_join' and created_at > now() - interval '1 minute') >= 15 then
    raise exception 'Too many attempts, wait a moment';
  end if;
  insert into public.match_queue (user_id, status, desired_mode, preference_snapshot, queued_at, heartbeat_at, expires_at, reserved_session_id)
  values (uid, 'waiting', _mode, coalesce(_snapshot,'{}'), now(), now(), now() + interval '45 seconds', null)
  on conflict (user_id) do update set status='waiting', desired_mode=excluded.desired_mode,
    preference_snapshot=excluded.preference_snapshot, queued_at=now(), heartbeat_at=now(),
    expires_at=now() + interval '45 seconds', reserved_session_id=null;
  update public.profiles set last_seen_at = now() where id = uid;
  insert into public.session_events (actor_id, event_type) values (uid, 'queue_join');
end $$;

create or replace function public.leave_match_queue()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.match_queue where user_id = auth.uid() and status = 'waiting';
end $$;

create or replace function public.find_or_create_match()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me public.match_queue;
  cand public.match_queue;
  waited interval;
  broaden boolean;
  my_langs text[]; my_ints text[]; my_countries text[]; my_country text;
  sid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.match_queue where expires_at < now() and status = 'waiting';

  select * into me from public.match_queue where user_id = uid for update;
  if not found then return jsonb_build_object('status','idle'); end if;
  if me.status = 'reserved' and me.reserved_session_id is not null then
    return jsonb_build_object('status','matched','session_id', me.reserved_session_id);
  end if;

  update public.match_queue set heartbeat_at = now(), expires_at = now() + interval '45 seconds' where user_id = uid;

  waited := now() - me.queued_at;
  broaden := coalesce((me.preference_snapshot->>'broaden')::boolean, true) and waited > interval '30 seconds';
  my_langs := coalesce(array(select jsonb_array_elements_text(coalesce(me.preference_snapshot->'languages','[]'))), '{}');
  my_ints := coalesce(array(select jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'))), '{}');
  my_countries := coalesce(array(select jsonb_array_elements_text(coalesce(me.preference_snapshot->'countries','[]'))), '{}');
  select country_code into my_country from public.profiles where id = uid;

  select q.* into cand
  from public.match_queue q
  join public.profiles p on p.id = q.user_id
  where q.user_id <> uid and q.status = 'waiting' and q.expires_at > now()
    and q.desired_mode = me.desired_mode
    and not p.is_banned and (p.banned_until is null or p.banned_until < now())
    and not exists (select 1 from public.user_blocks b where (b.blocker_id = uid and b.blocked_id = q.user_id) or (b.blocker_id = q.user_id and b.blocked_id = uid))
    and not exists (select 1 from public.conversation_sessions s
      where s.created_at > now() - interval '24 hours'
        and ((s.user_a_id = uid and s.user_b_id = q.user_id) or (s.user_b_id = uid and s.user_a_id = q.user_id))
        and not exists (select 1 from public.mutual_connections c where c.status='active'
          and c.user_a_id = least(uid, q.user_id) and c.user_b_id = greatest(uid, q.user_id)))
    and (broaden or cardinality(my_countries) = 0 or p.country_code = any(my_countries))
    and (broaden or cardinality(my_langs) = 0
         or coalesce(array(select jsonb_array_elements_text(coalesce(q.preference_snapshot->'languages','[]'))), '{}') && my_langs)
  order by
    (cardinality(my_ints) > 0 and coalesce(array(select jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'))), '{}') && my_ints) desc,
    (my_country is not null and p.country_code = my_country) desc,
    q.queued_at asc
  limit 1
  for update of q skip locked;

  if not found then return jsonb_build_object('status','waiting','broadened', broaden); end if;

  insert into public.conversation_sessions (user_a_id, user_b_id, mode, initiator_id, status)
  values (uid, cand.user_id, me.desired_mode, uid, 'created') returning id into sid;

  update public.match_queue set status='reserved', reserved_session_id = sid where user_id in (uid, cand.user_id);
  insert into public.session_events (session_id, actor_id, event_type, metadata)
  values (sid, uid, 'created', jsonb_build_object('wait_seconds', extract(epoch from waited)));

  return jsonb_build_object('status','matched','session_id', sid);
end $$;

create or replace function public.session_transition(_session uuid, _to text, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.conversation_sessions;
begin
  select * into s from public.conversation_sessions where id = _session for update;
  if not found or uid not in (s.user_a_id, s.user_b_id) then raise exception 'Not allowed'; end if;
  if s.status in ('ended','failed','reported') then return; end if;
  if _to = 'connecting' and s.status = 'created' then
    update public.conversation_sessions set status='connecting' where id=_session;
  elsif _to = 'connecting' then
    null;
  elsif _to = 'connected' and s.status in ('created','connecting') then
    update public.conversation_sessions set status='connected', connected_at=coalesce(connected_at, now()) where id=_session;
    insert into public.session_events (session_id, actor_id, event_type) values (_session, uid, 'connected');
  elsif _to = 'connected' then
    null;
  elsif _to in ('ended','failed') then
    update public.conversation_sessions set status=_to, ended_at=now(), ended_by=uid, end_reason=left(_reason, 40) where id=_session;
    insert into public.session_events (session_id, actor_id, event_type, metadata) values (_session, uid, _to, jsonb_build_object('reason', left(_reason,40)));
  else
    raise exception 'Invalid transition';
  end if;
  if _to in ('ended','failed') then
    delete from public.match_queue where reserved_session_id = _session;
  else
    delete from public.match_queue where user_id = uid and reserved_session_id = _session;
  end if;
end $$;

create or replace function public.submit_report(_reported uuid, _session uuid, _category text, _note text, _block boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or uid = _reported then raise exception 'Invalid report'; end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Report limit reached, try later';
  end if;
  if _session is not null and not exists (select 1 from public.conversation_sessions
      where id = _session and ((user_a_id = uid and user_b_id = _reported) or (user_b_id = uid and user_a_id = _reported))) then
    raise exception 'Not allowed';
  end if;
  if _session is null and not exists (select 1 from public.mutual_connections
      where user_a_id = least(uid,_reported) and user_b_id = greatest(uid,_reported)) then
    raise exception 'Not allowed';
  end if;
  insert into public.reports (reporter_id, reported_user_id, session_id, category, note)
  values (uid, _reported, _session, _category, nullif(left(_note, 500), ''));
  if _block then
    insert into public.user_blocks (blocker_id, blocked_id) values (uid, _reported) on conflict do nothing;
    update public.mutual_connections set status='removed' where user_a_id = least(uid,_reported) and user_b_id = greatest(uid,_reported);
  end if;
  if _session is not null then
    update public.conversation_sessions set status='reported', ended_at=coalesce(ended_at, now()), ended_by=uid, end_reason='report'
      where id=_session and status not in ('ended','failed','reported');
    insert into public.session_events (session_id, actor_id, event_type) values (_session, uid, 'report');
  end if;
end $$;

create or replace function public.block_user(_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or uid = _target then raise exception 'Invalid'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (uid, _target) on conflict do nothing;
  update public.mutual_connections set status='removed' where user_a_id = least(uid,_target) and user_b_id = greatest(uid,_target);
  update public.conversation_sessions set status='ended', ended_at=now(), ended_by=uid, end_reason='block'
    where status in ('created','connecting','connected')
      and ((user_a_id=uid and user_b_id=_target) or (user_b_id=uid and user_a_id=_target));
end $$;

create or replace function public.set_mutual_connection_decision(_session uuid, _accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.conversation_sessions; other uuid; a uuid; b uuid; c public.mutual_connections;
begin
  select * into s from public.conversation_sessions where id=_session;
  if not found or uid not in (s.user_a_id, s.user_b_id) then raise exception 'Not allowed'; end if;
  if coalesce(s.ended_at, now()) < now() - interval '10 minutes' then return 'expired'; end if;
  if not _accept then return 'declined'; end if;
  other := case when uid = s.user_a_id then s.user_b_id else s.user_a_id end;
  if exists (select 1 from public.user_blocks where (blocker_id=uid and blocked_id=other) or (blocker_id=other and blocked_id=uid)) then
    return 'unavailable';
  end if;
  a := least(uid, other); b := greatest(uid, other);
  insert into public.mutual_connections (user_a_id, user_b_id, session_id) values (a, b, _session)
    on conflict (user_a_id, user_b_id) do nothing;
  if uid = a then
    update public.mutual_connections set user_a_accepted_at = now(), status = case when status='removed' then 'pending' else status end where user_a_id=a and user_b_id=b;
  else
    update public.mutual_connections set user_b_accepted_at = now(), status = case when status='removed' then 'pending' else status end where user_a_id=a and user_b_id=b;
  end if;
  select * into c from public.mutual_connections where user_a_id=a and user_b_id=b;
  if c.user_a_accepted_at is not null and c.user_b_accepted_at is not null
     and c.user_a_accepted_at > now() - interval '10 minutes' and c.user_b_accepted_at > now() - interval '10 minutes' then
    update public.mutual_connections set status='active', activated_at=coalesce(activated_at, now()) where id=c.id;
    return 'active';
  end if;
  return 'pending';
end $$;

create or replace function public.remove_connection(_conn uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.mutual_connections set status='removed' where id=_conn and auth.uid() in (user_a_id, user_b_id);
end $$;

create or replace function public.moderate_user(_target uuid, _action text, _reason text, _report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not public.is_staff(uid) then raise exception 'Forbidden'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'Reason required'; end if;
  if _action = 'suspend' then
    update public.profiles set banned_until = now() + interval '24 hours' where id=_target;
  elsif _action = 'ban' then
    update public.profiles set is_banned = true where id=_target;
    delete from public.match_queue where user_id=_target;
  elsif _action = 'unban' then
    update public.profiles set is_banned = false, banned_until = null where id=_target;
  elsif _action not in ('warn','dismiss','review') then
    raise exception 'Invalid action';
  end if;
  insert into public.moderation_actions (actor_id, target_user_id, action_type, reason, report_id)
  values (uid, _target, _action, left(_reason, 500), _report);
  if _report is not null then
    update public.reports set status = case when _action='dismiss' then 'dismissed' when _action='review' then 'reviewing' else 'resolved' end,
      reviewed_at=now(), reviewed_by=uid, resolution_note=left(_reason,500) where id=_report;
  end if;
end $$;

create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'active_today', (select count(*) from public.profiles where last_seen_at > now() - interval '24 hours'),
    'in_queue', (select count(*) from public.match_queue where status='waiting' and expires_at > now()),
    'active_sessions', (select count(*) from public.conversation_sessions where status in ('created','connecting','connected')),
    'open_reports', (select count(*) from public.reports where status in ('open','reviewing')),
    'failures_24h', (select count(*) from public.session_events where event_type='failed' and created_at > now() - interval '24 hours'),
    'matches_24h', (select count(*) from public.conversation_sessions where created_at > now() - interval '24 hours'),
    'ended_24h', (select count(*) from public.conversation_sessions where status='ended' and ended_at > now() - interval '24 hours'),
    'avg_wait_seconds', (select coalesce(round(avg((metadata->>'wait_seconds')::numeric),1),0) from public.session_events where event_type='created' and created_at > now() - interval '7 days'),
    'reports_24h', (select count(*) from public.reports where created_at > now() - interval '24 hours')
  );
end $$;

create or replace function public.admin_list_users(_q text)
returns table (id uuid, display_name text, country_code text, is_banned boolean, banned_until timestamptz, created_at timestamptz, report_count bigint, block_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return query select p.id, p.display_name, p.country_code, p.is_banned, p.banned_until, p.created_at,
    (select count(*) from public.reports r where r.reported_user_id = p.id),
    (select count(*) from public.user_blocks b where b.blocked_id = p.id)
  from public.profiles p
  where _q is null or _q = '' or p.display_name ilike '%'||_q||'%' or p.id::text = _q
  order by p.created_at desc limit 50;
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.join_match_queue(text, jsonb), public.leave_match_queue(), public.find_or_create_match(),
  public.session_transition(uuid, text, text), public.submit_report(uuid, uuid, text, text, boolean), public.block_user(uuid),
  public.set_mutual_connection_decision(uuid, boolean), public.remove_connection(uuid), public.moderate_user(uuid, text, text, uuid),
  public.admin_metrics(), public.admin_list_users(text), public.delete_my_account() from public, anon;
grant execute on function public.join_match_queue(text, jsonb), public.leave_match_queue(), public.find_or_create_match(),
  public.session_transition(uuid, text, text), public.submit_report(uuid, uuid, text, text, boolean), public.block_user(uuid),
  public.set_mutual_connection_decision(uuid, boolean), public.remove_connection(uuid), public.moderate_user(uuid, text, text, uuid),
  public.admin_metrics(), public.admin_list_users(text), public.delete_my_account() to authenticated;

alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.mutual_connections;
alter publication supabase_realtime add table public.conversation_sessions;
alter publication supabase_realtime add table public.match_queue;

create policy "avatar signed-in read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "avatar own upload" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar own update" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar own delete" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
