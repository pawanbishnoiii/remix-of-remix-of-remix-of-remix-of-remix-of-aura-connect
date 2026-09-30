ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age smallint,
  ADD COLUMN IF NOT EXISTS last_ip inet,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS detected_country text;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_preferences (user_id) SELECT id FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'user' FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  INSERT INTO public.profiles (id) VALUES (uid) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'user') ON CONFLICT DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- Random, Monkey-style matcher: same mode + same device class, nearby country first, then the world.
CREATE OR REPLACE FUNCTION public.find_or_create_match()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); me public.match_queue; cand public.match_queue; sid uuid; mycountry text; mydevice text; mylang text; myinterests text[];
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO me FROM public.match_queue WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle'); END IF;
 IF me.status='reserved' AND me.reserved_session_id IS NOT NULL THEN RETURN jsonb_build_object('status','matched','session_id',me.reserved_session_id); END IF;
 IF me.status<>'waiting' THEN RETURN jsonb_build_object('status','idle'); END IF;
 UPDATE public.match_queue SET heartbeat_at=now(), expires_at=now()+interval '45 seconds' WHERE user_id=uid;
 SELECT country_code INTO mycountry FROM public.profiles WHERE id=uid;
 mydevice := coalesce(me.preference_snapshot->>'device','desktop');
 mylang := coalesce(me.preference_snapshot->'languages'->>0,'');
 myinterests := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'::jsonb))),'{}');
 SELECT q.* INTO cand FROM public.match_queue q JOIN public.profiles p ON p.id=q.user_id
 WHERE q.user_id<>uid AND q.status='waiting' AND q.expires_at>now() AND q.heartbeat_at>now()-interval '30 seconds'
   AND q.desired_mode=me.desired_mode
   AND coalesce(q.preference_snapshot->>'device','desktop')=mydevice
   AND p.onboarding_completed AND NOT p.is_banned AND (p.banned_until IS NULL OR p.banned_until<now())
   AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=uid AND b.blocked_id=q.user_id) OR (b.blocker_id=q.user_id AND b.blocked_id=uid))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.status IN ('created','connecting','connected') AND q.user_id IN (s.user_a_id,s.user_b_id))
   AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-interval '90 seconds' AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id)))
 ORDER BY (p.country_code IS NOT DISTINCT FROM mycountry) DESC,
          (coalesce(q.preference_snapshot->'languages'->>0,'')=mylang) DESC,
          (coalesce(array(SELECT jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'::jsonb))),'{}') && myinterests) DESC,
          q.queued_at ASC
 LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','waiting'); END IF;
 INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status) VALUES(uid,cand.user_id,me.desired_mode,uid,'created') RETURNING id INTO sid;
 UPDATE public.match_queue SET status='reserved', reserved_session_id=sid WHERE user_id IN (uid,cand.user_id);
 INSERT INTO public.session_events(session_id,actor_id,event_type,metadata) VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',extract(epoch FROM now()-me.queued_at)));
 RETURN jsonb_build_object('status','matched','session_id',sid);
END $$;