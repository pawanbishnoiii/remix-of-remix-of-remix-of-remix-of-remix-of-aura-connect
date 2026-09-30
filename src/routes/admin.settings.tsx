import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export const Route = createFileRoute('/admin/settings')({ component: SettingsPage });

type Field = { key: string; field: string; label: string; type: 'number' | 'bool' | 'text' };
const FIELDS: Field[] = [
  { key: 'matching', field: 'broaden_after_seconds', label: 'Widen to the whole world after (seconds)', type: 'number' },
  { key: 'matching', field: 'repeat_cooldown_seconds', label: 'Don’t re-match the same pair within (seconds)', type: 'number' },
  { key: 'matching', field: 'same_device_only', label: 'Match phones with phones, computers with computers', type: 'bool' },
  { key: 'safety', field: 'block_contact_sharing', label: 'Block phone numbers & contact details in chat', type: 'bool' },
  { key: 'safety', field: 'report_screenshots', label: 'Save a video snapshot when someone reports', type: 'bool' },
  { key: 'maintenance', field: 'enabled', label: 'Maintenance mode', type: 'bool' },
  { key: 'maintenance', field: 'message', label: 'Maintenance message', type: 'text' },
];

function SettingsPage() {
  const [vals, setVals] = useState<Record<string, Record<string, Json>>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => { supabase.from('app_settings').select('*').then(({ data }) => setVals(Object.fromEntries((data || []).map(r => [r.key, (r.value || {}) as Record<string, Json>])))); }, []);
  const set = (k: string, f: string, v: Json) => setVals(s => ({ ...s, [k]: { ...(s[k] || {}), [f]: v } }));
  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    for (const [key, value] of Object.entries(vals)) {
      const { error } = await supabase.from('app_settings').upsert({ key, value, updated_by: u.user?.id, updated_at: new Date().toISOString() });
      if (error) { setMsg(error.message); return; }
    }
    setMsg('Settings saved. Matching uses them immediately.');
  };
  return <div><div className="jn-admin-head"><h1>Settings</h1><p>Platform-wide controls</p></div>
    <div className="surface jn-settings">{FIELDS.map(f => { const v = vals[f.key]?.[f.field]; return <label key={f.key + f.field} className="jn-setting">
      <span>{f.label}</span>
      {f.type === 'bool' ? <input type="checkbox" checked={!!v} onChange={e => set(f.key, f.field, e.target.checked)}/>
        : f.type === 'number' ? <input type="number" min={0} max={3600} value={typeof v === 'number' ? v : ''} onChange={e => set(f.key, f.field, Number(e.target.value))}/>
        : <input value={typeof v === 'string' ? v : ''} maxLength={200} onChange={e => set(f.key, f.field, e.target.value)}/>}
    </label>; })}
      <button className="full-primary" onClick={save}>Save settings</button>{msg && <p className="jn-muted">{msg}</p>}
    </div></div>;
}
