import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { countryFlag, countryLabel } from '@/lib/jnoy';

export const Route = createFileRoute('/admin/activity')({ component: ActivityPage });

function ActivityPage() {
  const [rows, setRows] = useState<Database['public']['Tables']['login_visits']['Row'][]>([]);
  useEffect(() => { supabase.from('login_visits').select('*').order('started_at', { ascending: false }).limit(200).then(({ data }) => setRows(data || [])); }, []);
  return <div><div className="jn-admin-head"><h1>Sign-in activity</h1><p>Approximate location from network · last 200 sign-ins</p></div>
    <div className="surface jn-table-wrap"><table className="jn-table"><thead><tr><th>Member</th><th>Signed in</th><th>Duration</th><th>Location</th><th>IP</th><th>Device</th></tr></thead><tbody>
      {rows.map(v => <tr key={v.id}><td><Link to="/admin/users/$userId" params={{ userId: v.user_id }}>{v.user_id.slice(0, 8)}</Link></td><td>{new Date(v.started_at).toLocaleString()}</td><td>{Math.max(0, Math.round((new Date(v.ended_at || v.last_seen_at).getTime() - new Date(v.started_at).getTime()) / 60000))} min</td><td>{countryFlag(v.country_code)} {[v.city, v.region, v.country_code ? countryLabel(v.country_code) : null].filter(Boolean).join(', ') || '—'}</td><td>{(v.ip_address as string | null) || '—'}</td><td>{v.device_name || '—'}</td></tr>)}
    </tbody></table></div></div>;
}
