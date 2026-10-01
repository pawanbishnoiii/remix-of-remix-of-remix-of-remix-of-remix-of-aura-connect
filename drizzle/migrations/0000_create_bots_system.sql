CREATE TABLE public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  age smallint not null default 22,
  gender text not null default 'other',
  country_code text not null default 'IN',
  region text,
  city text,
  district text,
  tags text[] not null default '{}',
  avatar_url text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

COMMENT ON TABLE public.bots IS 'Filler companions used when no real user is waiting in text matching. Managed from the admin workspace.';

GRANT SELECT ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read bots"
  ON public.bots FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Client-callable: ends a session where the bot is a participant (bot decides to leave).
CREATE OR REPLACE FUNCTION public.bot_end_session(_session uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare botuid uuid;
begin
  select b.user_id into botuid
  from public.conversation_sessions s
  join public.bots b on b.user_id in (s.user_a_id, s.user_b_id)
  where s.id = _session and s.status in ('created','connecting','connected')
  limit 1;
  if botuid is null then raise exception 'Not a bot session'; end if;
  update public.conversation_sessions
    set status='ended', ended_at=now(), ended_by=botuid, end_reason=left(coalesce(_reason,'left'),40)
    where id=_session;
  delete from public.match_queue where reserved_session_id=_session;
end
$function$;

GRANT EXECUTE ON FUNCTION public.bot_end_session(uuid, text) TO authenticated, service_role;

-- Matching engine update:
-- 1) Reap abandoned sessions stuck in created/connecting so their members are
--    never locked out of matching for hours (fixes "two people waiting never match").
-- 2) When a text-mode searcher has waited long enough with no human candidate,
--    offer a compatible bot companion so the queue never feels dead.
CREATE OR REPLACE FUNCTION public.find_or_create_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); me public.match_queue; cand public.match_queue; sid uuid; mp public.profiles;
  mydevice text; mylang text; myinterests text[]; mycountries text[]; waited numeric; broaden int; cooldown int; samedev boolean; cfg jsonb; smode text;
  botrow public.bots; bot_after int; bot_chance numeric; reaped uuid[];
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO me FROM public.match_queue WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle'); END IF;
 IF me.status='reserved' AND me.reserved_session_id IS NOT NULL THEN
   IF EXISTS (SELECT 1 FROM public.conversation_sessions WHERE id=me.reserved_session_id AND status IN ('created','connecting','connected')) THEN
     RETURN jsonb_build_object('status','matched','session_id',me.reserved_session_id);
   END IF;
   DELETE FROM public.match_queue WHERE user_id=uid; RETURN jsonb_build_object('status','idle');
 END IF;
 IF me.status<>'waiting' THEN RETURN jsonb_build_object('status','idle'); END IF;
 -- Reap abandoned sessions: if a room was never opened or never connected,
 -- close it so both members are free to match again instead of waiting out a lock.
 SELECT coalesce(array_agg(id), '{}') INTO reaped FROM public.conversation_sessions
  WHERE status IN ('created','connecting') AND created_at < now() - interval '2 minutes';
 IF reaped <> '{}' THEN
   UPDATE public.conversation_sessions SET status='failed', ended_at=now(), end_reason='timeout' WHERE id = ANY(reaped);
   DELETE FROM public.match_queue WHERE reserved_session_id = ANY(reaped);
 END IF;
 UPDATE public.match_queue SET heartbeat_at=now(), expires_at=now()+interval '45 seconds' WHERE user_id=uid;
 SELECT value INTO cfg FROM public.app_settings WHERE key='matching';
 broaden := least(coalesce((cfg->>'broaden_after_seconds')::int, 6), 8);
 cooldown := coalesce((cfg->>'repeat_cooldown_seconds')::int, 90);
 samedev := coalesce((cfg->>'same_device_only')::boolean, true);
 bot_after := coalesce((cfg->>'bot_after_seconds')::int, 8);
 bot_chance := coalesce((cfg->>'bot_chance')::numeric, 0.75);
 SELECT * INTO mp FROM public.profiles WHERE id=uid;
 waited := extract(epoch FROM now()-me.queued_at);
 mydevice := coalesce(me.preference_snapshot->>'device','desktop');
 mylang := lower(coalesce(me.preference_snapshot->'languages'->>0,''));
 myinterests := coalesce(array(SELECT lower(x) FROM jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'::jsonb)) x),'{}');
 mycountries := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'countries','[]'::jsonb))),'{}');
 SELECT q.* INTO cand FROM public.match_queue q JOIN public.profiles p ON p.id=q.user_id
 WHERE q.user_id<>uid AND q.status='waiting' AND q.expires_at>now() AND q.heartbeat_at>now()-interval '15 seconds'
   AND (q.desired_mode=me.desired_mode OR waited > broaden OR extract(epoch FROM now()-q.queued_at) > broaden)
   AND (NOT samedev OR waited > broaden OR extract(epoch FROM now()-q.queued_at) > broaden OR coalesce(q.preference_snapshot->>'device','desktop')=mydevice)
   AND p.onboarding_completed AND coalesce(p.age,0)>=18 AND NOT p.is_banned AND (p.banned_until IS NULL OR p.banned_until<now())
   AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=uid AND b.blocked_id=q.user_id) OR (b.blocker_id=q.user_id AND b.blocked_id=uid))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.status IN ('created','connecting','connected') AND s.created_at > now()-interval '2 hours' AND q.user_id IN (s.user_a_id,s.user_b_id))
   AND (random() < 1.0/30 OR waited > 25 OR NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-make_interval(secs=>cooldown) AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id))))
   AND (cardinality(mycountries)=0 OR p.country_code = ANY(mycountries) OR waited > broaden)
 ORDER BY (
   (CASE WHEN q.desired_mode=me.desired_mode THEN 40 ELSE 0 END)
 + (CASE WHEN p.country_code = ANY(mycountries) THEN 50 ELSE 0 END)
 + (CASE WHEN p.country_code IS NOT DISTINCT FROM mp.country_code THEN 30 ELSE 0 END)
 + (CASE WHEN mp.detected_region IS NOT NULL AND p.detected_region = mp.detected_region THEN 15 ELSE 0 END)
 + (CASE WHEN mp.detected_city IS NOT NULL AND p.detected_city = mp.detected_city THEN 15 ELSE 0 END)
 + (CASE WHEN mp.detected_district IS NOT NULL AND p.detected_district = mp.detected_district THEN 20 ELSE 0 END)
 + (CASE WHEN coalesce(q.preference_snapshot->>'device','desktop')=mydevice THEN 30 ELSE 0 END)
 + (CASE WHEN lower(coalesce(q.preference_snapshot->'languages'->>0,''))=mylang THEN 20 ELSE 0 END)
 + 8 * coalesce((SELECT count(*) FROM jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'::jsonb)) x WHERE lower(x) = ANY(myinterests)),0)
 + 6 * coalesce((SELECT count(*) FROM unnest(coalesce(p.tags,'{}')) t WHERE lower(t) = ANY(myinterests)),0)
 - (CASE WHEN EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-make_interval(secs=>cooldown) AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id))) THEN 60 ELSE 0 END)
 + least(extract(epoch FROM now()-q.queued_at), 30)
 + random()*10
 ) DESC
 LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF FOUND THEN
  smode := CASE WHEN 'text' IN (me.desired_mode, cand.desired_mode) THEN 'text'
                WHEN 'audio' IN (me.desired_mode, cand.desired_mode) THEN 'audio' ELSE 'video' END;
  INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status) VALUES(uid,cand.user_id,smode,uid,'created') RETURNING id INTO sid;
  UPDATE public.match_queue SET status='reserved', reserved_session_id=sid WHERE user_id IN (uid,cand.user_id);
  INSERT INTO public.session_events(session_id,actor_id,event_type,metadata) VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',waited));
  RETURN jsonb_build_object('status','matched','session_id',sid);
 END IF;
 -- No human available: a compatible bot companion joins text chats after a short wait.
 IF me.desired_mode='text' AND waited >= bot_after AND random() < bot_chance THEN
   SELECT b.* INTO botrow FROM public.bots b
   WHERE b.is_active AND b.user_id IS NOT NULL
     AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s2
        WHERE s2.status IN ('created','connecting','connected')
          AND s2.created_at > now() - interval '30 minutes'
          AND b.user_id IN (s2.user_a_id, s2.user_b_id))
   ORDER BY (
     (CASE WHEN b.country_code IS NOT DISTINCT FROM mp.country_code THEN 40 ELSE 0 END)
   + (CASE WHEN mp.detected_region IS NOT NULL AND b.region = mp.detected_region THEN 20 ELSE 0 END)
   + 8 * coalesce((SELECT count(*) FROM unnest(coalesce(b.tags,'{}')) t WHERE lower(t) = ANY(myinterests)),0)
   + random()*15
   ) DESC
   LIMIT 1;
   IF botrow.user_id IS NOT NULL THEN
     INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status)
       VALUES(uid,botrow.user_id,'text',uid,'created') RETURNING id INTO sid;
     UPDATE public.match_queue SET status='reserved', reserved_session_id=sid WHERE user_id=uid;
     INSERT INTO public.session_events(session_id,actor_id,event_type,metadata)
       VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',waited,'bot',true));
     RETURN jsonb_build_object('status','matched','session_id',sid);
   END IF;
 END IF;
 RETURN jsonb_build_object('status','waiting','waited',round(waited));
END
$function$;
