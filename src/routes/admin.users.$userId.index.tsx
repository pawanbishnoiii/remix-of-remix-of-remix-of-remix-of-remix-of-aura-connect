import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { countryFlag, countryLabel } from '@/lib/jnoy';
import { ago } from './admin.users.index';

export const Route = createFileRoute('/admin/users/$userId/')({ component: UserDetail });
type Fn = Database['public']['Functions'];

function UserDetail() {
  const { userId } = Route.useParams();
  const [u, setU] = useState<Fn['admin_list_users_v2']['Returns'][number] | null>(null);
  const [sessions, setSessions] = useState<Fn['admin_user_sessions']['Returns']>([]);
  const [visits, setVisits] = useState<Fn['admin_user_visits']['Returns']>([]);
  const [msg, setMsg] = useState('');
  const [consents, setConsents] = useState<Fn['admin_user_consents']['Returns']>([]);
  useEffect(() => { supabase.rpc('admin_user_consents', { _user: userId }).then(({ data }) => setConsents(data || [])); }, [userId]);
  const load = async () => {
    const [a, b, c] = await Promise.all([supabase.rpc('admin_list_users_v2', { _q: userId }), supabase.rpc('admin_user_sessions', { _user: userId }), supabase.rpc('admin_user_visits', { _user: userId })]);
    setU(a.data?.[0] ?? null); setSessions(b.data || []); setVisits(c.data || []);
  };
  useEffect(() => { void load(); }, [userId]);
  const moderate = async (action: string) => {
    const reason = window.prompt(`Reason for ${action}?`); if (!reason) return;
    const { error } = await supabase.rpc('moderate_user', { _target: userId, _action: action, _reason: reason.slice(0, 500) });
    setMsg(error ? error.message : `${action} recorded`); void load();
  };
  if (!u) return <p>Loading…</p>;
  return <div>
    <Link to="/admin/users" className="jn-back"><ArrowLeft size={15}/> All users</Link>
    <div className="jn-admin-head jn-user-head">{u.avatar_url ? <img src={u.avatar_url} alt="" referrerPolicy="no-referrer"/> : null}<div><h1>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name}</h1><p>{u.email} · {u.gender} · {u.age} · {countryFlag(u.country_code)} {countryLabel(u.country_code)}</p></div>
      <div className="jn-row"><button onClick={() => moderate('warn')}>Warn</button><button onClick={() => moderate('suspend')}>Suspend 24h</button>{u.is_banned ? <button onClick={() => moderate('unban')}>Unban</button> : <button className="jn-danger" onClick={() => moderate('ban')}>Ban</button>}</div></div>
    {msg && <p className="jn-muted">{msg}</p>}
    <div className="metric-grid"><div className="surface metric"><span>Last seen</span><strong>{ago(u.last_seen_at)}</strong></div><div className="surface metric"><span>Matches</span><strong>{u.session_count}</strong></div><div className="surface metric"><span>Reports against</span><strong>{u.report_count}</strong></div><div className="surface metric"><span>Device</span><strong className="jn-sm">{u.device_name || '—'}</strong></div></div>
    <h2 className="jn-h2">Match history</h2>
    <div className="surface jn-table-wrap"><table className="jn-table"><thead><tr><th>When</th><th>Partner</th><th>Mode</th><th>Outcome</th><th>Chat</th></tr></thead><tbody>
      {sessions.length ? sessions.map(s => <tr key={s.id}><td>{new Date(s.created_at).toLocaleString()}</td><td><Link to="/admin/users/$userId" params={{ userId: s.partner_id }}>{s.partner_name}</Link></td><td>{s.mode}</td><td>{s.status}{s.end_reason ? ` · ${s.end_reason}` : ''}</td><td><Link to="/admin/users/$userId/$sessionId" params={{ userId, sessionId: s.id }} className="jn-link"><MessageCircle size={14}/> {s.message_count} messages</Link></td></tr>) : <tr><td colSpan={5}>No matches yet.</td></tr>}
    </tbody></table></div>
    <h2 className="jn-h2">Sign-in history</h2>
    <div className="surface jn-table-wrap"><table className="jn-table"><thead><tr><th>Signed in</th><th>Duration</th><th>Location</th><th>IP</th><th>Device</th></tr></thead><tbody>
      {visits.map(v => <tr key={v.id}><td>{new Date(v.started_at).toLocaleString()}</td><td>{Math.max(0, Math.round((new Date(v.ended_at || v.last_seen_at).getTime() - new Date(v.started_at).getTime()) / 60000))} min{v.ended_at ? '' : ' (open)'}</td><td>{countryFlag(v.country_code)} {[v.city, v.region, countryLabel(v.country_code)].filter(Boolean).join(', ')}</td><td>{v.ip || '—'}</td><td>{v.device_name || '—'}</td></tr>)}
    </tbody></table></div>
    <h2 className="jn-sub">Consent history</h2>
    <div className="surface jn-table-wrap"><table className="jn-table"><thead><tr><th>Policy</th><th>Version</th><th>Where</th><th>Accepted</th></tr></thead><tbody>
      {consents.length ? consents.map(c => <tr key={c.policy_type + c.policy_version}><td>{c.policy_type}</td><td>{c.policy_version}</td><td>{c.source}</td><td>{new Date(c.accepted_at).toLocaleString()}</td></tr>) : <tr><td colSpan={4} className="jn-muted">No consent recorded.</td></tr>}
    </tbody></table></div>
  </div>;
}
