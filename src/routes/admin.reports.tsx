import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const Route = createFileRoute('/admin/reports')({ component: Reports });
type R = Database['public']['Tables']['reports']['Row'];

function Reports() {
  const [rows, setRows] = useState<R[]>([]);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const load = async () => {
    let q = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter === 'open') q = q.in('status', ['open', 'reviewing']);
    const { data } = await q; setRows(data || []);
    const paths = (data || []).map(r => r.screenshot_path).filter((p): p is string => !!p);
    if (paths.length) { const { data: urls } = await supabase.storage.from('report-evidence').createSignedUrls(paths, 600); setShots(Object.fromEntries((urls || []).filter(u => u.signedUrl).map(u => [u.path!, u.signedUrl]))); }
  };
  useEffect(() => { void load(); }, [filter]);
  const act = async (r: R, action: string) => {
    const reason = window.prompt(`Reason for ${action}?`); if (!reason) return;
    const { error } = await supabase.rpc('moderate_user', { _target: r.reported_user_id, _action: action, _reason: reason.slice(0, 500), _report: r.id });
    if (error) alert(error.message); else void load();
  };
  return <div><div className="jn-admin-head"><h1>Reports</h1><div className="admin-tabs"><button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button></div></div>
    <div className="jn-report-grid">{rows.length ? rows.map(r => <div key={r.id} className="surface jn-report-card">
      {r.screenshot_path && shots[r.screenshot_path] ? <a href={shots[r.screenshot_path]} target="_blank" rel="noreferrer"><img src={shots[r.screenshot_path]} alt="Reported video snapshot"/></a> : <div className="jn-noshot">No snapshot</div>}
      <div><b className="jn-pill warn">{r.category}</b> <span className="jn-muted">{r.status} · {new Date(r.created_at).toLocaleString()}</span></div>
      <p>{r.note || 'No note'}</p>
      <p className="jn-muted"><Link to="/admin/users/$userId" params={{ userId: r.reported_user_id }}>Reported member</Link>{r.session_id && <> · <Link to="/admin/users/$userId/$sessionId" params={{ userId: r.reported_user_id, sessionId: r.session_id }}>View chat</Link></>}</p>
      {['open', 'reviewing'].includes(r.status) && <div className="jn-row"><button onClick={() => act(r, 'dismiss')}>Dismiss</button><button onClick={() => act(r, 'warn')}>Warn</button><button onClick={() => act(r, 'suspend')}>Suspend</button><button className="jn-danger" onClick={() => act(r, 'ban')}>Ban</button></div>}
    </div>) : <p className="jn-muted">Nothing to review. 🎉</p>}</div>
  </div>;
}
