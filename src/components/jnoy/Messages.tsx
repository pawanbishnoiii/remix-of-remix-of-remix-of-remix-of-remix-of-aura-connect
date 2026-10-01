import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Search, Send, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { countryFlag, countryLabel, messageSchema, type Profile } from '@/lib/jnoy';
import star from '@/assets/clay-star.webp';

type Conn = Database['public']['Tables']['mutual_connections']['Row'];
type DM = Database['public']['Tables']['direct_messages']['Row'];
type Mini = Pick<Profile, 'id' | 'display_name' | 'country_code' | 'avatar_url'>;

// Soft two-note chime made with Web Audio — no audio file needed.
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, now + i * 0.12); g.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
      o.connect(g).connect(ctx.destination); o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.4);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch { /* audio unavailable */ }
}
const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function Messages({ user, notify, onMeet }: { user: User; notify: (s: string) => void; onMeet?: () => void }) {
  const [connections, setConnections] = useState<Conn[]>([]);
  const [names, setNames] = useState<Record<string, Mini>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(false);
  const [sound, setSound] = useState(true);
  const seen = useRef<Set<string>>(new Set());
  const chimed = useRef<Set<string>>(new Set());
  const bottom = useRef<HTMLDivElement>(null);
  const other = (c: Conn) => c.user_a_id === user.id ? c.user_b_id : c.user_a_id;

  useEffect(() => { try { setSound(localStorage.getItem('jnoy_dm_sound') !== '0'); } catch { /* ignore */ } }, []);
  const toggleSound = () => { const v = !sound; setSound(v); try { localStorage.setItem('jnoy_dm_sound', v ? '1' : '0'); } catch { /* ignore */ } };

  useEffect(() => {
    const load = () => supabase.from('mutual_connections').select('*').eq('status', 'active').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).order('activated_at', { ascending: false }).then(async ({ data }) => {
      setConnections(data || []);
      const ids = (data || []).map(other);
      if (ids.length) { const { data: ps } = await supabase.from('profiles').select('id,display_name,country_code,avatar_url').in('id', ids); setNames(Object.fromEntries((ps || []).map(p => [p.id, p]))); }
    });
    void load();
    const ch = supabase.channel('conns-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'mutual_connections' }, () => void load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  useEffect(() => {
    if (!selected) return;
    let alive = true; let first = true;
    const load = () => supabase.from('direct_messages').select('*').eq('connection_id', selected).order('created_at').then(({ data, error }) => {
      if (!alive || error) return;
      const rows = data || [];
      const fresh = rows.filter(m => !seen.current.has(m.id));
      rows.forEach(m => seen.current.add(m.id));
      // Play the chime once, for the first new message from the other person in this conversation.
      if (!first && sound && fresh.some(m => m.sender_id !== user.id) && !chimed.current.has(selected)) { chimed.current.add(selected); chime(); }
      first = false;
      setMessages(rows);
      const unread = rows.filter(m => m.sender_id !== user.id && !m.read_at).map(m => m.id);
      if (unread.length) void supabase.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unread);
    });
    void load();
    const ch = supabase.channel('direct-' + selected).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `connection_id=eq.${selected}` }, () => void load()).subscribe(status => { if (status === 'SUBSCRIBED') void load(); });
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 3000);
    return () => { alive = false; clearInterval(timer); supabase.removeChannel(ch); };
  }, [selected, sound]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, selected]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const r = messageSchema.safeParse(draft);
    if (!r.success) { notify(r.error.issues[0]?.message || 'Invalid message'); return; }
    if (!selected || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('direct_messages').insert({ connection_id: selected, sender_id: user.id, body: r.data }).select().single();
    setSending(false);
    if (error) notify(error.message);
    else { setDraft(''); seen.current.add(data.id); setMessages(m => [...m, data]); }
  };

  const sel = connections.find(c => c.id === selected); const partner = sel ? names[other(sel)] : undefined;
  const list = connections.filter(c => !q.trim() || (names[other(c)]?.display_name || '').toLowerCase().includes(q.trim().toLowerCase()));
  const Avatar = ({ p }: { p?: Mini | undefined }) => <span className="connection-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt="" referrerPolicy="no-referrer"/> : p?.display_name?.[0] || <Heart size={18}/>}</span>;

  return <div className="interior-page jn-dm"><div className="interior-header"><span className="section-kicker">KEEP THE CONVERSATION GOING</span><h1>The people you <em>clicked with.</em></h1><p>Only mutual connections appear here.</p></div>
    <div className={`messages-layout surface ${selected ? 'has-chat' : ''}`}>
      <div className="connection-list">
        <h3>Connections <span>{connections.length}</span></h3>
        {connections.length > 3 && <label className="jn-csearch"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search connections…" aria-label="Search connections"/></label>}
        {list.length ? list.map(c => { const p = names[other(c)]; return <button key={c.id} className={selected === c.id ? 'active' : ''} onClick={() => setSelected(c.id)}><Avatar p={p}/><span>{p?.display_name || 'Connection'} <small>{countryFlag(p?.country_code)} {countryLabel(p?.country_code)}</small></span><ArrowRight size={16}/></button>; })
          : <div className="empty-connections"><img src={star} alt="" loading="lazy" width={110} height={110}/><h4>Good things take a hello.</h4><p>Tap Connect together during a chat to find each other here.</p>{onMeet && <button className="full-primary jn-sm-btn" onClick={onMeet}>Meet someone <ArrowRight size={16}/></button>}</div>}
      </div>
      <div className="message-panel">{selected ? <>
        <div className="message-panel-head">
          <button className="jn-dm-back" onClick={() => setSelected(null)} aria-label="Back to connections"><ArrowLeft size={18}/></button>
          <Avatar p={partner}/><div><h3>{partner?.display_name || 'Connection'}</h3><small>{countryFlag(partner?.country_code)} {countryLabel(partner?.country_code)}</small></div>
          <button className="jn-dm-sound" onClick={toggleSound} aria-label={sound ? 'Mute message sound' : 'Turn on message sound'}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
        </div>
        <div className="direct-bubbles">
          {messages.length === 0 && <p className="jn-muted jn-dm-hint">Say hi to {partner?.display_name || 'your connection'} 👋</p>}
          {messages.map(m => <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'mine' : ''}`}>{m.body}<small className="jn-dm-time">{time(m.created_at)}{m.sender_id === user.id && m.read_at ? ' · Seen' : ''}</small></div>)}
          <div ref={bottom}/>
        </div>
        <form className="chat-form" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="Write a message…" aria-label="Message"/><button aria-label="Send" disabled={sending || !draft.trim()}><Send size={18}/></button></form>
      </> : <div className="message-empty"><MessageCircle size={36}/><h3>Your next chapter starts with a hello.</h3><p>Select a connection to pick up where you left off.</p></div>}</div>
    </div></div>;
}
