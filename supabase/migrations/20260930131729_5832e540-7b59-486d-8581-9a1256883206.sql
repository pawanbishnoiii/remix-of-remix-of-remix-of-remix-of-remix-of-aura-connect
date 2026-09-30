DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='session_messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='direct_messages') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='conversation_sessions') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_sessions; END IF;
END $$;