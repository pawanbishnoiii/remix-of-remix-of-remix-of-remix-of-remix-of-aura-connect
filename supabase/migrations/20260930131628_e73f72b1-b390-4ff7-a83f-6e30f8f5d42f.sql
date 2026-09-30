CREATE OR REPLACE FUNCTION public.admin_session_messages(_session uuid)
RETURNS TABLE(id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF COALESCE((SELECT (value->>'staff_chat_review_enabled')::boolean FROM public.app_settings WHERE key = 'privacy'), true) = false THEN
    RAISE EXCEPTION 'Staff chat review is disabled in Privacy settings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_sessions WHERE conversation_sessions.id = _session) THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason)
    SELECT auth.uid(), s.user_a_id, 'review', 'Viewed session chat ' || _session FROM public.conversation_sessions s WHERE s.id = _session;
  RETURN QUERY SELECT m.id, m.sender_id, COALESCE(p.display_name,'Member'), m.body, m.created_at
    FROM public.session_messages m LEFT JOIN public.profiles p ON p.id=m.sender_id
    WHERE m.session_id=_session ORDER BY m.created_at, m.id;
END $$;

CREATE OR REPLACE FUNCTION public.guard_message_spam()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE recent_count integer; repeated_count integer; last_sent timestamptz; max_per_minute integer;
BEGIN
  SELECT COALESCE((value->>'dm_per_minute')::integer, 20) INTO max_per_minute FROM public.app_settings WHERE key='safety';
  max_per_minute := greatest(1, least(coalesce(max_per_minute,20), 120));
  -- Serialize submissions from the same sender so simultaneous inserts cannot bypass the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(new.sender_id::text, 4812));
  IF tg_table_name = 'session_messages' THEN
    SELECT count(*), count(*) FILTER (WHERE lower(trim(body)) = lower(trim(new.body))), max(created_at)
      INTO recent_count, repeated_count, last_sent FROM public.session_messages
      WHERE sender_id=new.sender_id AND created_at > now()-interval '1 minute';
  ELSE
    SELECT count(*), count(*) FILTER (WHERE lower(trim(body)) = lower(trim(new.body))), max(created_at)
      INTO recent_count, repeated_count, last_sent FROM public.direct_messages
      WHERE sender_id=new.sender_id AND created_at > now()-interval '1 minute';
  END IF;
  IF recent_count >= max_per_minute THEN RAISE EXCEPTION 'Too many messages. Please wait a moment.'; END IF;
  IF repeated_count >= 3 THEN RAISE EXCEPTION 'Please do not repeat the same message.'; END IF;
  IF recent_count >= 5 AND last_sent > now()-interval '2 seconds' THEN RAISE EXCEPTION 'Slow down before sending another message.'; END IF;
  RETURN new;
END $$;
CREATE TRIGGER session_message_spam BEFORE INSERT ON public.session_messages FOR EACH ROW EXECUTE FUNCTION public.guard_message_spam();
CREATE TRIGGER direct_message_spam BEFORE INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.guard_message_spam();