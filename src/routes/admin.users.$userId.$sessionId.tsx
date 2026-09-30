import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const Route = createFileRoute('/admin/users/$userId/$sessionId')({ component: SessionChat });

function SessionChat() {
  const { userId, sessionId } = Route.useParams();
  const [rows, setRows] = useState<Database['public']['Functions']['admin_session_messages']['Returns']>([]);
  const [err, setErr] = useState('');
  useEffect(() => { supabase.rpc('admin_session_messages', { _session: sessionId }).then(({ data, error }) => { if (error) setErr(error.message); else setRows(data || []); }); }, [sessionId]);
  return <div>
    <Link to="/admin/users/$userId" params={{ userId }} className="jn-back"><ArrowLeft size={15}/> Back to member</Link>
    <div className="jn-admin-head"><h1>Match chat</h1><p><Eye size={14}/> This view is logged for accountability. Session {sessionId.slice(0, 8)}</p></div>
    {err && <p className="jn-error">{err}</p>}
    <div className="surface jn-admin-chat">{rows.length ? rows.map(m => <div key={m.id} className={`bubble ${m.sender_id === userId ? 'mine' : ''}`}><small>{m.sender_name} · {new Date(m.created_at).toLocaleTimeString()}</small>{m.body}</div>) : <p className="jn-muted">No messages in this match.</p>}</div>
  </div>;
}
