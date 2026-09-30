import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/admin/')({ component: Dashboard });

const LABELS: Record<string, string> = { total_users: 'Total members', active_today: 'Active today', in_queue: 'Searching now', active_sessions: 'Live conversations', matches_24h: 'Matches (24h)', ended_24h: 'Ended (24h)', avg_wait_seconds: 'Avg. wait (s)', open_reports: 'Open reports', reports_24h: 'Reports (24h)', failures_24h: 'Failed calls (24h)' };

function Dashboard() {
  const [m, setM] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const load = () => supabase.rpc('admin_metrics').then(({ data, error }) => { if (error) setErr(error.message); else setM(data as Record<string, number>); });
    void load(); const t = setInterval(load, 15000); return () => clearInterval(t);
  }, []);
  return <div><div className="jn-admin-head"><h1>Dashboard</h1><p>Live overview · refreshes every 15 seconds</p></div>
    {err && <p className="jn-error">{err}</p>}
    <div className="metric-grid">{Object.keys(LABELS).map((k, i) => <div className={`surface metric jn-metric-${i % 4}`} key={k}><span>{LABELS[k]}</span><strong>{m ? (m[k] ?? 0) : '…'}</strong></div>)}</div>
  </div>;
}
