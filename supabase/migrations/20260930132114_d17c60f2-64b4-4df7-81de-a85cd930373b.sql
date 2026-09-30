CREATE OR REPLACE FUNCTION public.admin_all_chats(_limit integer DEFAULT 100, _before timestamptz DEFAULT NULL)
RETURNS TABLE(session_id uuid, user_a_id uuid, user_b_id uuid, user_a_name text, user_b_name text, mode text, status text, started_at timestamptz, message_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF COALESCE((SELECT (value->>'staff_chat_review_enabled')::boolean FROM public.app_settings WHERE key='privacy'),true) = false THEN RAISE EXCEPTION 'Staff chat review is disabled in Privacy settings'; END IF;
 RETURN QUERY SELECT s.id,s.user_a_id,s.user_b_id,coalesce(a.display_name,'Member'),coalesce(b.display_name,'Member'),s.mode,s.status,s.created_at,
   (SELECT count(*) FROM public.session_messages m WHERE m.session_id=s.id)
 FROM public.conversation_sessions s
 LEFT JOIN public.profiles a ON a.id=s.user_a_id LEFT JOIN public.profiles b ON b.id=s.user_b_id
 WHERE _before IS NULL OR s.created_at < _before ORDER BY s.created_at DESC LIMIT greatest(1,least(coalesce(_limit,100),100));
END $$;
REVOKE ALL ON FUNCTION public.admin_all_chats(integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_all_chats(integer,timestamptz) TO authenticated;