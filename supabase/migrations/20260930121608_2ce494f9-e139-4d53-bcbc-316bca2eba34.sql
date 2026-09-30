-- Profile & visit enrichment
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS detected_region text,
  ADD COLUMN IF NOT EXISTS detected_city text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auth_provider text;

ALTER TABLE public.login_visits
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS screenshot_path text;

-- App settings (staff managed)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.app_settings(key,value) VALUES
 ('matching', '{"broaden_after_seconds":12,"repeat_cooldown_seconds":90,"same_device_only":true}'),
 ('safety', '{"block_contact_sharing":true,"report_screenshots":true}'),
 ('maintenance', '{"enabled":false,"message":""}')
ON CONFLICT (key) DO NOTHING;

-- New users: copy Google/email metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare md jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
begin
  insert into public.profiles (id, email, first_name, last_name, display_name, avatar_url, auth_provider)
  values (new.id, new.email,
    left(nullif(coalesce(md->>'given_name', split_part(md->>'full_name',' ',1)),''),30),
    left(nullif(coalesce(md->>'family_name', nullif(substr(md->>'full_name', length(split_part(md->>'full_name',' ',1))+2),'')),''),30),
    left(nullif(coalesce(md->>'given_name', md->>'name', md->>'full_name'),''),40),
    nullif(coalesce(md->>'avatar_url', md->>'picture'),''),
    coalesce(new.raw_app_meta_data->>'provider','email'))
  on conflict (id) do update set email = excluded.email;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if coalesce(md->>'terms_accepted','') = 'true' then
    update public.profiles set terms_accepted_at = now() where id = new.id;
    insert into public.policy_acceptances(user_id, policy_type, policy_version) values (new.id,'age_18','1'),(new.id,'terms','1');
  end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill email for existing
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

-- Accept terms (for Google users, done before onboarding)
CREATE OR REPLACE FUNCTION public.accept_terms()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform public.ensure_my_profile();
  update public.profiles set terms_accepted_at = coalesce(terms_accepted_at, now()) where id = uid;
  insert into public.policy_acceptances(user_id, policy_type, policy_version)
  select uid, t, '1' from unnest(array['age_18','terms']) t
  where not exists (select 1 from public.policy_acceptances a where a.user_id=uid and a.policy_type=t and a.policy_version='1');
end $$;

-- One-step onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(_first text, _last text, _gender text, _age int, _country text, _language text, _tags text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(_first),'')='' or coalesce(trim(_last),'')='' then raise exception 'First and last name are required'; end if;
  if _gender not in ('male','female','other') then raise exception 'Choose a gender'; end if;
  if _age is null or _age < 18 or _age > 100 then raise exception 'You must be 18 or older'; end if;
  if _country !~ '^[A-Z]{2}$' then raise exception 'Choose a country'; end if;
  if coalesce(trim(_language),'')='' then raise exception 'Choose a language'; end if;
  perform public.accept_terms();
  update public.profiles set first_name=left(trim(_first),30), last_name=left(trim(_last),30), display_name=left(trim(_first),40),
    gender=_gender, age=_age, country_code=_country,
    tags=(select coalesce(array_agg(distinct left(trim(t),30)),'{}') from unnest(coalesce(_tags,'{}')) t where trim(t)<>'' limit 12),
    onboarding_completed=true where id=uid;
  update public.user_preferences set languages=array[left(_language,30)], interests=coalesce(_tags,'{}'), approximate_country=_country, discoverable=true where user_id=uid;
end $$;

-- Queue join no longer re-asks for 18+ each time
CREATE OR REPLACE FUNCTION public.join_match_queue(_mode text, _snapshot jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); p public.profiles;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 IF _mode NOT IN ('video','audio','text') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=uid;
 IF NOT FOUND OR NOT p.onboarding_completed THEN RAISE EXCEPTION 'Finish onboarding first'; END IF;
 IF coalesce(p.age,0) < 18 THEN RAISE EXCEPTION 'Jnoy is for adults 18+ only'; END IF;
 IF p.is_banned OR (p.banned_until IS NOT NULL AND p.banned_until>now()) THEN RAISE EXCEPTION 'Account restricted'; END IF;
 PERFORM public.accept_terms();
 UPDATE public.user_preferences SET discoverable=true WHERE user_id=uid AND NOT discoverable;
 -- Clean up any stale session of mine
 UPDATE public.conversation_sessions SET status='ended', ended_at=now(), end_reason='stale'
   WHERE status IN ('created','connecting','connected') AND uid IN (user_a_id,user_b_id) AND created_at < now()-interval '3 hours';
 IF EXISTS (SELECT 1 FROM public.conversation_sessions WHERE status IN ('created','connecting','connected') AND uid IN (user_a_id,user_b_id)) THEN RAISE EXCEPTION 'Already in a conversation'; END IF;
 IF (SELECT count(*) FROM public.session_events WHERE actor_id=uid AND event_type='queue_join' AND created_at>now()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Too many attempts, wait a moment'; END IF;
 INSERT INTO public.match_queue(user_id,status,desired_mode,preference_snapshot,queued_at,heartbeat_at,expires_at,reserved_session_id,generation)
 VALUES(uid,'waiting',_mode,coalesce(_snapshot,'{}'),now(),now(),now()+interval '45 seconds',null,gen_random_uuid())
 ON CONFLICT(user_id) DO UPDATE SET status='waiting',desired_mode=excluded.desired_mode,preference_snapshot=excluded.preference_snapshot,queued_at=now(),heartbeat_at=now(),expires_at=now()+interval '45 seconds',reserved_session_id=null,generation=gen_random_uuid();
 UPDATE public.profiles SET last_seen_at=now() WHERE id=uid;
 INSERT INTO public.session_events(actor_id,event_type) VALUES(uid,'queue_join');
END $$;

-- Scored matching: country > region > language > shared tags > wait time; broadens after wait
CREATE OR REPLACE FUNCTION public.find_or_create_match()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); me public.match_queue; cand public.match_queue; sid uuid; mp public.profiles;
  mydevice text; mylang text; myinterests text[]; waited numeric; broaden int; cooldown int; samedev boolean; cfg jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO me FROM public.match_queue WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle'); END IF;
 IF me.status='reserved' AND me.reserved_session_id IS NOT NULL THEN RETURN jsonb_build_object('status','matched','session_id',me.reserved_session_id); END IF;
 IF me.status<>'waiting' THEN RETURN jsonb_build_object('status','idle'); END IF;
 UPDATE public.match_queue SET heartbeat_at=now(), expires_at=now()+interval '45 seconds' WHERE user_id=uid;
 SELECT value INTO cfg FROM public.app_settings WHERE key='matching';
 broaden := coalesce((cfg->>'broaden_after_seconds')::int, 12);
 cooldown := coalesce((cfg->>'repeat_cooldown_seconds')::int, 90);
 samedev := coalesce((cfg->>'same_device_only')::boolean, true);
 SELECT * INTO mp FROM public.profiles WHERE id=uid;
 waited := extract(epoch FROM now()-me.queued_at);
 mydevice := coalesce(me.preference_snapshot->>'device','desktop');
 mylang := lower(coalesce(me.preference_snapshot->'languages'->>0,''));
 myinterests := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'::jsonb))),'{}');
 SELECT q.* INTO cand FROM public.match_queue q JOIN public.profiles p ON p.id=q.user_id
 WHERE q.user_id<>uid AND q.status='waiting' AND q.expires_at>now() AND q.heartbeat_at>now()-interval '20 seconds'
   AND q.desired_mode=me.desired_mode
   AND (NOT samedev OR waited > broaden*4 OR coalesce(q.preference_snapshot->>'device','desktop')=mydevice)
   AND p.onboarding_completed AND coalesce(p.age,0)>=18 AND NOT p.is_banned AND (p.banned_until IS NULL OR p.banned_until<now())
   AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=uid AND b.blocked_id=q.user_id) OR (b.blocker_id=q.user_id AND b.blocked_id=uid))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.status IN ('created','connecting','connected') AND q.user_id IN (s.user_a_id,s.user_b_id))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-make_interval(secs=>cooldown) AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id)))
   AND (waited > broaden OR p.country_code IS NOT DISTINCT FROM mp.country_code OR extract(epoch FROM now()-q.queued_at) > broaden)
 ORDER BY (
   (CASE WHEN p.country_code IS NOT DISTINCT FROM mp.country_code THEN 40 ELSE 0 END)
 + (CASE WHEN mp.detected_region IS NOT NULL AND p.detected_region = mp.detected_region THEN 10 ELSE 0 END)
 + (CASE WHEN lower(coalesce(q.preference_snapshot->'languages'->>0,''))=mylang THEN 20 ELSE 0 END)
 + 6 * coalesce((SELECT count(*) FROM jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'::jsonb)) x WHERE x = ANY(myinterests)),0)
 + least(extract(epoch FROM now()-q.queued_at), 30)
 + random()*8
 ) DESC
 LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','waiting','waited',round(waited)); END IF;
 INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status) VALUES(uid,cand.user_id,me.desired_mode,uid,'created') RETURNING id INTO sid;
 UPDATE public.match_queue SET status='reserved', reserved_session_id=sid WHERE user_id IN (uid,cand.user_id);
 INSERT INTO public.session_events(session_id,actor_id,event_type,metadata) VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',waited));
 RETURN jsonb_build_object('status','matched','session_id',sid);
END $$;

-- Reports with optional screenshot evidence
CREATE OR REPLACE FUNCTION public.submit_report_v2(_reported uuid, _session uuid, _category text, _note text, _screenshot text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null or uid = _reported then raise exception 'Invalid report'; end if;
  if _category not in ('harassment','nudity','hate','spam','underage','violence','other') then raise exception 'Invalid category'; end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'Report limit reached, try later'; end if;
  if not exists (select 1 from public.conversation_sessions where id=_session and ((user_a_id=uid and user_b_id=_reported) or (user_b_id=uid and user_a_id=_reported))) then raise exception 'Not allowed'; end if;
  if _screenshot is not null and _screenshot not like uid::text || '/%' then raise exception 'Invalid evidence'; end if;
  insert into public.reports (reporter_id, reported_user_id, session_id, category, note, screenshot_path)
  values (uid, _reported, _session, _category, nullif(left(_note,500),''), _screenshot) returning id into rid;
  insert into public.user_blocks (blocker_id, blocked_id) values (uid, _reported) on conflict do nothing;
  update public.conversation_sessions set status='reported', ended_at=coalesce(ended_at, now()), ended_by=uid, end_reason='report'
    where id=_session and status not in ('ended','failed','reported');
  delete from public.match_queue where reserved_session_id=_session;
  insert into public.session_events (session_id, actor_id, event_type) values (_session, uid, 'report');
  return rid;
end $$;

-- Admin helpers
CREATE OR REPLACE FUNCTION public.admin_list_users_v2(_q text)
 RETURNS TABLE(id uuid, display_name text, first_name text, last_name text, email text, gender text, age smallint, country_code text, detected_city text, device_name text, last_ip text, is_banned boolean, banned_until timestamptz, created_at timestamptz, last_seen_at timestamptz, last_login_at timestamptz, report_count bigint, session_count bigint, avatar_url text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return query select p.id, p.display_name, p.first_name, p.last_name, p.email, p.gender, p.age, p.country_code, p.detected_city, p.device_name, host(p.last_ip),
    p.is_banned, p.banned_until, p.created_at, p.last_seen_at, p.last_login_at,
    (select count(*) from public.reports r where r.reported_user_id=p.id),
    (select count(*) from public.conversation_sessions s where p.id in (s.user_a_id,s.user_b_id)), p.avatar_url
  from public.profiles p
  where coalesce(_q,'')='' or p.display_name ilike '%'||_q||'%' or p.email ilike '%'||_q||'%' or p.id::text=_q
  order by p.created_at desc limit 200;
end $$;

CREATE OR REPLACE FUNCTION public.admin_user_sessions(_user uuid)
 RETURNS TABLE(id uuid, partner_id uuid, partner_name text, mode text, status text, created_at timestamptz, ended_at timestamptz, end_reason text, message_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return query select s.id, case when s.user_a_id=_user then s.user_b_id else s.user_a_id end,
    (select coalesce(pp.display_name,'Member') from public.profiles pp where pp.id = case when s.user_a_id=_user then s.user_b_id else s.user_a_id end),
    s.mode, s.status, s.created_at, s.ended_at, s.end_reason,
    (select count(*) from public.session_messages m where m.session_id=s.id)
  from public.conversation_sessions s where _user in (s.user_a_id,s.user_b_id) order by s.created_at desc limit 200;
end $$;

CREATE OR REPLACE FUNCTION public.admin_session_messages(_session uuid)
 RETURNS TABLE(id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  insert into public.moderation_actions(actor_id, target_user_id, action_type, reason)
    select auth.uid(), s.user_a_id, 'review', 'Viewed session chat '||_session from public.conversation_sessions s where s.id=_session;
  return query select m.id, m.sender_id, coalesce(p.display_name,'Member'), m.body, m.created_at
  from public.session_messages m left join public.profiles p on p.id=m.sender_id where m.session_id=_session order by m.created_at;
end $$;

CREATE OR REPLACE FUNCTION public.admin_user_visits(_user uuid)
 RETURNS TABLE(id uuid, started_at timestamptz, last_seen_at timestamptz, ended_at timestamptz, country_code text, region text, city text, ip text, device_name text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return query select v.id, v.started_at, v.last_seen_at, v.ended_at, v.country_code, v.region, v.city, host(v.ip_address), v.device_name
  from public.login_visits v where v.user_id=_user order by v.started_at desc limit 100;
end $$;

GRANT EXECUTE ON FUNCTION public.accept_terms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text,text,text,int,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report_v2(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_v2(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_session_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_visits(uuid) TO authenticated;

-- Report evidence storage policies (bucket created separately)
CREATE POLICY "Reporters upload own evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='report-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Staff read evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='report-evidence' AND public.is_staff(auth.uid()));
