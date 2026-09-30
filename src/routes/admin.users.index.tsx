import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { countryFlag, countryLabel } from '@/lib/jnoy';

export const Route = createFileRoute('/admin/users/')({ component: UsersPage });
type Row = Database['public']['Functions']['admin_list_users_v2']['Returns'][number];

export const ago = (d?: string | null) => {
  if (!d) return 'never'; const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 90) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86400)} d ago`;
};

function UsersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setLoading(true); supabase.rpc('admin_list_users_v2', { _q: q }).then(({ data }) => { setRows(data || []); setLoading(false); }); }, 250); return () => clearTimeout(t); }, [q]);
  return <div><div className="jn-admin-head"><h1>Users</h1><p>{rows.length} shown</p></div>
    <div className="jn-admin-search"><Search size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or ID"/></div>
    <div className="surface jn-table-wrap"><table className="jn-table"><thead><tr><th>Member</th><th>Details</th><th>Location / device</th><th>Last seen</th><th>Status</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={5}>Loading…</td></tr> : rows.map(u => <tr key={u.id}>
        <td><Link to="/admin/users/$userId" params={{ userId: u.id }} className="jn-user-cell">{u.avatar_url ? <img src={u.avatar_url} alt="" referrerPolicy="no-referrer"/> : <span>{(u.display_name || '?')[0]}</span>}<div><b>{[u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || 'Unnamed'}</b><small>{u.email}</small></div></Link></td>
        <td>{u.gender || '—'} · {u.age || '—'}<br/><small>{u.session_count} matches · {u.report_count} reports</small></td>
        <td>{countryFlag(u.country_code)} {countryLabel(u.country_code)}{u.detected_city ? `, ${u.detected_city}` : ''}<br/><small>{u.device_name || '—'} · {u.last_ip || 'no IP'}</small></td>
        <td>{ago(u.last_seen_at)}<br/><small>login {ago(u.last_login_at)}</small></td>
        <td>{u.is_banned ? <span className="jn-pill bad">Banned</span> : u.banned_until && new Date(u.banned_until) > new Date() ? <span className="jn-pill warn">Suspended</span> : <span className="jn-pill ok">Active</span>}</td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
