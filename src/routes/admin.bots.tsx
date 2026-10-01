import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { Bot, Plus, RefreshCw, Trash2, UserRoundCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { saveBot, deleteBot, seedBots } from '@/lib/bots.functions';

export const Route = createFileRoute('/admin/bots')({ component: BotsPage });

type BotRow = {
  id: string; user_id: string | null; name: string; age: number; gender: string;
  country_code: string; region: string | null; city: string | null; district: string | null;
  tags: string[]; avatar_url: string | null; bio: string | null; is_active: boolean;
};

const AVATARS = ['aarav', 'priya', 'rohan', 'ananya', 'kabir', 'isha', 'vihaan', 'meera', 'arjun', 'diya', 'aditya', 'kavya', 'nikhil', 'pooja', 'rahul'].map(n => `/bots/${n}.jpg`);

const emptyForm = { name: '', age: 22, gender: 'female', region: '', city: '', tags: '', avatar_url: AVATARS[1]!, is_active: true };

function BotsPage() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => { supabase.from('bots').select('*').order('name').then(({ data }) => setBots((data || []) as BotRow[])); }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, note: string) => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(note); load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const addBot = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12);
    await act(() => saveBot({ data: {
      name: form.name, age: Number(form.age), gender: form.gender as 'male' | 'female' | 'other', country_code: 'IN',
      region: form.region, city: form.city, district: form.city, tags,
      avatar_url: form.avatar_url, is_active: form.is_active,
    } }), 'Companion added. Create its account with "Create accounts".');
    setForm(emptyForm); setShowForm(false);
  };

  return <div>
    <div className="jn-admin-head">
      <h1><Bot size={20}/> Companions</h1>
      <p>Bot companions that keep text matching lively when no real member is waiting. Real members are always matched first.</p>
    </div>
    <div className="jn-admin-actions" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <button className="full-primary" onClick={() => setShowForm(s => !s)}><Plus size={15}/> Add companion</button>
      <button className="full-secondary" disabled={busy} onClick={() => void act(() => seedBots(), 'Accounts created for new companions.')}><UserRoundCheck size={15}/> Create accounts</button>
      <button className="full-secondary" disabled={busy} onClick={() => void load()}><RefreshCw size={15}/> Refresh</button>
    </div>
    {msg && <p className="jn-muted" role="status">{msg}</p>}
    {showForm && <form className="surface jn-bot-form" onSubmit={addBot} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <label>Name <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={40} required/></label>
      <label>Age <input type="number" min={18} max={99} value={form.age} onChange={e => setForm({ ...form, age: Number(e.target.value) })}/></label>
      <label>Gender
        <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
          <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
        </select>
      </label>
      <label>State / region <input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} maxLength={80} placeholder="Karnataka"/></label>
      <label>City <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} maxLength={80} placeholder="Bengaluru"/></label>
      <label>Interests (comma separated) <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="music, movies, travel"/></label>
      <label>Profile photo
        <select value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })}>
          {AVATARS.map(a => <option key={a} value={a}>{a.split('/').pop()!.replace('.jpg', '')}</option>)}
        </select>
      </label>
      <img src={form.avatar_url} alt="Selected companion photo" width={72} height={72} style={{ borderRadius: 12 }}/>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}/> Active
      </label>
      <button className="full-primary" type="submit" disabled={busy || !form.name.trim()}>Save companion</button>
    </form>}
    <div className="surface">
      {!bots.length && <p className="jn-muted">No companions yet. Add a few, then create their accounts.</p>}
      {bots.map(b => <div key={b.id} className="jn-bot-row" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border, rgba(255,255,255,.08))' }}>
        <img src={b.avatar_url || AVATARS[0]} alt="" width={48} height={48} loading="lazy" style={{ borderRadius: 12, objectFit: 'cover' }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{b.name}</b>, {b.age} · {b.city || '—'}{b.region ? `, ${b.region}` : ''}
          <br/><small className="jn-muted">{b.tags.join(' · ') || 'no interests'} · {b.user_id ? 'account ready' : 'no account yet'} · {b.is_active ? 'active' : 'paused'}</small>
        </div>
        <button className="full-secondary" disabled={busy} onClick={() => void act(() => saveBot({ data: { id: b.id, name: b.name, age: b.age, gender: b.gender as 'male' | 'female' | 'other', country_code: b.country_code, region: b.region || undefined, city: b.city || undefined, district: b.district || undefined, tags: b.tags, avatar_url: b.avatar_url || undefined, bio: b.bio || undefined, is_active: !b.is_active } }), b.is_active ? `${b.name} paused.` : `${b.name} active again.`)}>
          {b.is_active ? 'Pause' : 'Activate'}
        </button>
        <button className="full-secondary jn-danger" disabled={busy} onClick={() => { if (window.confirm(`Delete ${b.name}?`)) void act(() => deleteBot({ data: { id: b.id } }), `${b.name} deleted.`); }} aria-label={`Delete ${b.name}`}><Trash2 size={15}/></button>
      </div>)}
    </div>
  </div>;
}
