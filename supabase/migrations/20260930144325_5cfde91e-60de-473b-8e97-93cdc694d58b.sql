CREATE OR REPLACE FUNCTION public.find_or_create_match()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); me public.match_queue; cand public.match_queue; sid uuid; mp public.profiles;
  mydevice text; mylang text; myinterests text[]; mycountries text[]; waited numeric; broaden int; cooldown int; samedev boolean; cfg jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO me FROM public.match_queue WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle'); END IF;
 IF me.status='reserved' AND me.reserved_session_id IS NOT NULL THEN RETURN jsonb_build_object('status','matched','session_id',me.reserved_session_id); END IF;
 IF me.status<>'waiting' THEN RETURN jsonb_build_object('status','idle'); END IF;
 UPDATE public.match_queue SET heartbeat_at=now(), expires_at=now()+interval '45 seconds' WHERE user_id=uid;
 SELECT value INTO cfg FROM public.app_settings WHERE key='matching';
 broaden := least(coalesce((cfg->>'broaden_after_seconds')::int, 6), 8);
 cooldown := coalesce((cfg->>'repeat_cooldown_seconds')::int, 90);
 samedev := coalesce((cfg->>'same_device_only')::boolean, true);
 SELECT * INTO mp FROM public.profiles WHERE id=uid;
 waited := extract(epoch FROM now()-me.queued_at);
 mydevice := coalesce(me.preference_snapshot->>'device','desktop');
 mylang := lower(coalesce(me.preference_snapshot->'languages'->>0,''));
 myinterests := coalesce(array(SELECT lower(x) FROM jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'::jsonb)) x),'{}');
 mycountries := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'countries','[]'::jsonb))),'{}');
 SELECT q.* INTO cand FROM public.match_queue q JOIN public.profiles p ON p.id=q.user_id
 WHERE q.user_id<>uid AND q.status='waiting' AND q.expires_at>now() AND q.heartbeat_at>now()-interval '15 seconds'
   AND q.desired_mode=me.desired_mode
   AND (NOT samedev OR waited > broaden OR extract(epoch FROM now()-q.queued_at) > broaden OR coalesce(q.preference_snapshot->>'device','desktop')=mydevice)
   AND p.onboarding_completed AND coalesce(p.age,0)>=18 AND NOT p.is_banned AND (p.banned_until IS NULL OR p.banned_until<now())
   AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=uid AND b.blocked_id=q.user_id) OR (b.blocker_id=q.user_id AND b.blocked_id=uid))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.status IN ('created','connecting','connected') AND q.user_id IN (s.user_a_id,s.user_b_id))
   AND (random() < 1.0/30 OR waited > 25 OR NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-make_interval(secs=>cooldown) AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id))))
   AND (cardinality(mycountries)=0 OR p.country_code = ANY(mycountries) OR waited > broaden)
 ORDER BY (
   (CASE WHEN p.country_code = ANY(mycountries) THEN 50 ELSE 0 END)
 + (CASE WHEN p.country_code IS NOT DISTINCT FROM mp.country_code THEN 30 ELSE 0 END)
 + (CASE WHEN mp.detected_region IS NOT NULL AND p.detected_region = mp.detected_region THEN 15 ELSE 0 END)
 + (CASE WHEN mp.detected_city IS NOT NULL AND p.detected_city = mp.detected_city THEN 15 ELSE 0 END)
 + (CASE WHEN mp.detected_district IS NOT NULL AND p.detected_district = mp.detected_district THEN 20 ELSE 0 END)
 + (CASE WHEN coalesce(q.preference_snapshot->>'device','desktop')=mydevice THEN 30 ELSE 0 END)
 + (CASE WHEN lower(coalesce(q.preference_snapshot->'languages'->>0,''))=mylang THEN 20 ELSE 0 END)
 + 8 * coalesce((SELECT count(*) FROM jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'::jsonb)) x WHERE lower(x) = ANY(myinterests)),0)
 - (CASE WHEN EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-make_interval(secs=>cooldown) AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id))) THEN 60 ELSE 0 END)
 + least(extract(epoch FROM now()-q.queued_at), 30)
 + random()*10
 ) DESC
 LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','waiting','waited',round(waited)); END IF;
 INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status) VALUES(uid,cand.user_id,me.desired_mode,uid,'created') RETURNING id INTO sid;
 UPDATE public.match_queue SET status='reserved', reserved_session_id=sid WHERE user_id IN (uid,cand.user_id);
 INSERT INTO public.session_events(session_id,actor_id,event_type,metadata) VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',waited));
 RETURN jsonb_build_object('status','matched','session_id',sid);
END $function$;

CREATE INDEX IF NOT EXISTS match_queue_waiting_idx ON public.match_queue(desired_mode, status, heartbeat_at);
CREATE INDEX IF NOT EXISTS sessions_pair_recent_idx ON public.conversation_sessions(user_a_id, user_b_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_conn_idx ON public.direct_messages(connection_id, created_at);