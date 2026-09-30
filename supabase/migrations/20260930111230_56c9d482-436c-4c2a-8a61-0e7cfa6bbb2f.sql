ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS generation uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS match_queue_available_idx ON public.match_queue (desired_mode, status, expires_at, queued_at);
CREATE UNIQUE INDEX IF NOT EXISTS one_live_session_per_a ON public.conversation_sessions (user_a_id) WHERE status IN ('created','connecting','connected');
CREATE UNIQUE INDEX IF NOT EXISTS one_live_session_per_b ON public.conversation_sessions (user_b_id) WHERE status IN ('created','connecting','connected');

CREATE TABLE public.session_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE, sender_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.session_messages TO authenticated;
GRANT ALL ON public.session_messages TO service_role;
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session participants read chat" ON public.session_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id=session_id AND auth.uid() IN (s.user_a_id,s.user_b_id)));
CREATE POLICY "session participants send chat" ON public.session_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id=session_id AND s.status IN ('created','connecting','connected') AND auth.uid() IN (s.user_a_id,s.user_b_id)));
CREATE INDEX session_messages_recent_idx ON public.session_messages(session_id, created_at);

CREATE TABLE public.call_signals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE, sender_id uuid NOT NULL REFERENCES public.profiles(id), recipient_id uuid NOT NULL REFERENCES public.profiles(id), payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.call_signals TO authenticated;
GRANT ALL ON public.call_signals TO service_role;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipient reads signals" ON public.call_signals FOR SELECT TO authenticated USING (recipient_id=auth.uid() AND EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id=session_id AND auth.uid() IN (s.user_a_id,s.user_b_id)));
CREATE POLICY "participants send signals" ON public.call_signals FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND sender_id<>recipient_id AND pg_column_size(payload)<32000 AND EXISTS (SELECT 1 FROM public.conversation_sessions s WHERE s.id=session_id AND s.status IN ('created','connecting','connected') AND sender_id IN (s.user_a_id,s.user_b_id) AND recipient_id IN (s.user_a_id,s.user_b_id)));
CREATE INDEX call_signals_recipient_idx ON public.call_signals (recipient_id, session_id, created_at);

CREATE TABLE public.login_visits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, country_code text, ip_address inet, started_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.login_visits TO authenticated;
GRANT ALL ON public.login_visits TO service_role;
ALTER TABLE public.login_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff visits" ON public.login_visits FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_staff(auth.uid()));
CREATE INDEX login_visits_user_recent_idx ON public.login_visits(user_id,started_at DESC);
CREATE TRIGGER login_visits_touch BEFORE UPDATE ON public.login_visits FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.reject_contact_sharing() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE normalized text;
BEGIN
 IF length(trim(new.body)) < 1 OR length(new.body)>2000 THEN RAISE EXCEPTION 'Message must be between 1 and 2000 characters'; END IF;
 normalized := lower(translate(new.body, '０１２３４５６７８９', '0123456789'));
 normalized := regexp_replace(normalized, '(zero|oh|one|two|three|four|five|six|seven|eight|nine|shunya|ek|do|teen|char|panch|chhe|saat|aath|nau)', '0', 'gi');
 IF normalized ~ '(\+?[0-9][^0-9]{0,3}){7,}' OR new.body ~* '(whatsapp|telegram|signal\.me|t\.me|instagram|snapchat|@[a-z0-9_]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})' THEN RAISE EXCEPTION 'Contact details cannot be shared in chat'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER protect_session_messages BEFORE INSERT OR UPDATE ON public.session_messages FOR EACH ROW EXECUTE FUNCTION public.reject_contact_sharing();
CREATE TRIGGER protect_direct_messages BEFORE INSERT OR UPDATE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.reject_contact_sharing();

CREATE OR REPLACE FUNCTION public.join_match_queue(_mode text, _snapshot jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); p public.profiles;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 IF _mode NOT IN ('video','audio','text') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=uid;
 IF NOT p.onboarding_completed THEN RAISE EXCEPTION 'Finish onboarding first'; END IF;
 IF p.is_banned OR (p.banned_until IS NOT NULL AND p.banned_until>now()) THEN RAISE EXCEPTION 'Account restricted'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.policy_acceptances WHERE user_id=uid AND policy_type='age_18' AND policy_version='1') THEN RAISE EXCEPTION 'Confirm you are 18 or older first'; END IF;
 IF NOT COALESCE((SELECT discoverable FROM public.user_preferences WHERE user_id=uid),false) THEN RAISE EXCEPTION 'Turn on discoverability first'; END IF;
 IF EXISTS (SELECT 1 FROM public.conversation_sessions WHERE status IN ('created','connecting','connected') AND uid IN (user_a_id,user_b_id)) THEN RAISE EXCEPTION 'Already in a conversation'; END IF;
 IF (SELECT count(*) FROM public.session_events WHERE actor_id=uid AND event_type='queue_join' AND created_at>now()-interval '1 minute')>=15 THEN RAISE EXCEPTION 'Too many attempts'; END IF;
 INSERT INTO public.match_queue(user_id,status,desired_mode,preference_snapshot,queued_at,heartbeat_at,expires_at,reserved_session_id,generation) VALUES(uid,'waiting',_mode,coalesce(_snapshot,'{}'),now(),now(),now()+interval '45 seconds',null,gen_random_uuid()) ON CONFLICT(user_id) DO UPDATE SET status='waiting',desired_mode=excluded.desired_mode,preference_snapshot=excluded.preference_snapshot,queued_at=now(),heartbeat_at=now(),expires_at=now()+interval '45 seconds',reserved_session_id=null,generation=gen_random_uuid();
 UPDATE public.profiles SET last_seen_at=now() WHERE id=uid;
 INSERT INTO public.session_events(actor_id,event_type) VALUES(uid,'queue_join');
END $$;

CREATE OR REPLACE FUNCTION public.find_or_create_match() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); me public.match_queue; cand public.match_queue; sid uuid; mycountry text; candcountry text; mylangs text[]; candlangs text[]; mychoices text[]; candchoices text[]; mystrict boolean; candstrict boolean; broaden boolean;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
 SELECT * INTO me FROM public.match_queue WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','idle'); END IF;
 IF me.status='reserved' AND me.reserved_session_id IS NOT NULL THEN RETURN jsonb_build_object('status','matched','session_id',me.reserved_session_id); END IF;
 IF me.status<>'waiting' THEN RETURN jsonb_build_object('status','idle'); END IF;
 UPDATE public.match_queue SET heartbeat_at=now(),expires_at=now()+interval '45 seconds' WHERE user_id=uid;
 SELECT country_code INTO mycountry FROM public.profiles WHERE id=uid;
 mylangs := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'languages','[]'::jsonb))), '{}');
 mychoices := coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'countries','[]'::jsonb))), '{}');
 mystrict := coalesce((me.preference_snapshot->>'strict')::boolean,false);
 broaden := NOT mystrict AND coalesce((me.preference_snapshot->>'broaden')::boolean,true) AND me.queued_at<now()-interval '30 seconds';
 SELECT q.* INTO cand FROM public.match_queue q JOIN public.profiles p ON p.id=q.user_id
 WHERE q.user_id<>uid AND q.status='waiting' AND q.expires_at>now() AND q.heartbeat_at>now()-interval '45 seconds' AND q.desired_mode=me.desired_mode
 AND p.onboarding_completed AND NOT p.is_banned AND (p.banned_until IS NULL OR p.banned_until<now())
 AND EXISTS(SELECT 1 FROM public.policy_acceptances pa WHERE pa.user_id=q.user_id AND pa.policy_type='age_18' AND pa.policy_version='1')
 AND EXISTS(SELECT 1 FROM public.user_preferences up WHERE up.user_id=q.user_id AND up.discoverable)
 AND NOT EXISTS(SELECT 1 FROM public.user_blocks b WHERE (b.blocker_id=uid AND b.blocked_id=q.user_id) OR (b.blocker_id=q.user_id AND b.blocked_id=uid))
 AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.status IN ('created','connecting','connected') AND q.user_id IN (s.user_a_id,s.user_b_id))
 AND NOT EXISTS(SELECT 1 FROM public.conversation_sessions s WHERE s.created_at>now()-interval '24 hours' AND ((s.user_a_id=uid AND s.user_b_id=q.user_id) OR (s.user_b_id=uid AND s.user_a_id=q.user_id)))
 AND (cardinality(mylangs)=0 OR coalesce(array(SELECT jsonb_array_elements_text(coalesce(q.preference_snapshot->'languages','[]'::jsonb))), '{}') && mylangs)
 AND (cardinality(mychoices)=0 OR p.country_code=ANY(mychoices) OR broaden)
 AND (coalesce((q.preference_snapshot->>'strict')::boolean,false)=false OR cardinality(coalesce(array(SELECT jsonb_array_elements_text(coalesce(q.preference_snapshot->'countries','[]'::jsonb))), '{}'))=0 OR mycountry=ANY(coalesce(array(SELECT jsonb_array_elements_text(coalesce(q.preference_snapshot->'countries','[]'::jsonb))), '{}')))
 ORDER BY (p.country_code=ANY(mychoices)) DESC, (p.country_code=mycountry) DESC, (coalesce(array(SELECT jsonb_array_elements_text(coalesce(q.preference_snapshot->'interests','[]'::jsonb))), '{}') && coalesce(array(SELECT jsonb_array_elements_text(coalesce(me.preference_snapshot->'interests','[]'::jsonb))), '{}')) DESC, q.queued_at ASC
 LIMIT 1 FOR UPDATE OF q SKIP LOCKED;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','waiting','broadened',broaden); END IF;
 SELECT country_code INTO candcountry FROM public.profiles WHERE id=cand.user_id;
 candlangs := coalesce(array(SELECT jsonb_array_elements_text(coalesce(cand.preference_snapshot->'languages','[]'::jsonb))), '{}');
 candchoices := coalesce(array(SELECT jsonb_array_elements_text(coalesce(cand.preference_snapshot->'countries','[]'::jsonb))), '{}');
 candstrict := coalesce((cand.preference_snapshot->>'strict')::boolean,false);
 IF cardinality(candlangs)>0 AND NOT candlangs && mylangs THEN RETURN jsonb_build_object('status','waiting'); END IF;
 IF cardinality(candchoices)>0 AND NOT mycountry=ANY(candchoices) AND (candstrict OR cand.queued_at>now()-interval '30 seconds') THEN RETURN jsonb_build_object('status','waiting'); END IF;
 INSERT INTO public.conversation_sessions(user_a_id,user_b_id,mode,initiator_id,status) VALUES(uid,cand.user_id,me.desired_mode,uid,'created') RETURNING id INTO sid;
 UPDATE public.match_queue SET status='reserved',reserved_session_id=sid WHERE user_id IN (uid,cand.user_id);
 INSERT INTO public.session_events(session_id,actor_id,event_type,metadata) VALUES(sid,uid,'created',jsonb_build_object('wait_seconds',extract(epoch FROM now()-me.queued_at)));
 RETURN jsonb_build_object('status','matched','session_id',sid);
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_connections;