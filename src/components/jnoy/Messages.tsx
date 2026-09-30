import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Heart, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { countryLabel, messageSchema, type Profile } from '@/lib/jnoy';
import star from '@/assets/clay-star.webp';

type Conn = Database['public']['Tables']['mutual_connections']['Row'];
type DM = Database['public']['Tables']['direct_messages']['Row'];

export function Messages({ user, notify, onMeet }: { user: User; notify: (s: string) => void; onMeet?: () => void }) {
  const [connections, setConnections] = useState<Conn[]>([]);
  const [names, setNames] = useState<Record<string, Pick<Profile, 'id' | 'display_name' | 'country_code' | 'avatar_url'>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState('');
  const other = (c: Conn) => c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
  useEffect(() => {
    supabase.from('mutual_connections').select('*').eq('status', 'active').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).then(async ({ data }) => {
      setConnections(data || []);
      const ids = (data || []).map(other);
      if (ids.length) { const { data: ps } = await supabase.from('profiles').select('id,display_name,country_code,avatar_url').in('id', ids); setNames(Object.fromEntries((ps || []).map(p => [p.id, p]))); }
    });
  }, [user.id]);
  useEffect(() => {
    if (!selected) return;
    const load = () => supabase.from('direct_messages').select('*').eq('connection_id', selected).order('created_at').then(({ data }) => setMessages(data || []));
    void load();
    const ch = supabase.channel('direct-' + selected).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `connection_id=eq.${selected}` }, () => void load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const r = messageSchema.safeParse(draft);
    if (!r.success) { notify(r.error.issues[0]?.message || 'Invalid message'); return; }
    const { error } = await supabase.from('direct_messages').insert({ connection_id: selected!, sender_id: user.id, body: r.data });
    if (error) notify(error.message); else { setDraft(''); const { data } = await supabase.from('direct_messages').select('*').eq('connection_id', selected!).order('created_at'); setMessages(data || []); }
  };
  const sel = connections.find(c => c.id === selected); const partner = sel ? names[other(sel)] : undefined;
  return <div className="interior-page"><div className="interior-header"><span className="section-kicker">KEEP THE CONVERSATION GOING</span><h1>The people you <em>clicked with.</em></h1><p>Only mutual connections appear here.</p></div>
    <div className="messages-layout surface"><div className="connection-list"><h3>Connections <span>{connections.length}</span></h3>
      {connections.length ? connections.map(c => { const p = names[other(c)]; return <button key={c.id} className={selected === c.id ? 'active' : ''} onClick={() => setSelected(c.id)}><span className="connection-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt="" referrerPolicy="no-referrer"/> : p?.display_name?.[0] || <Heart size={18}/>}</span><span>{p?.display_name || 'Connection'} <small>{countryLabel(p?.country_code)}</small></span><ArrowRight size={16}/></button>; })
        : <div className="empty-connections"><img src={star} alt="" loading="lazy" width={110} height={110}/><h4>Good things take a hello.</h4><p>Tap Connect together during a chat to find each other here.</p>{onMeet && <button className="full-primary jn-sm-btn" onClick={onMeet}>Meet someone <ArrowRight size={16}/></button>}</div>}
    </div>
      <div className="message-panel">{selected ? <><div className="message-panel-head"><span className="connection-avatar">{partner?.display_name?.[0] || 'J'}</span><div><h3>{partner?.display_name || 'Connection'}</h3><small>{countryLabel(partner?.country_code)}</small></div></div><div className="direct-bubbles">{messages.map(m => <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'mine' : ''}`}>{m.body}</div>)}</div><form className="chat-form" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="Write a message…"/><button aria-label="Send"><Send size={18}/></button></form></>
        : <div className="message-empty"><MessageCircle size={36}/><h3>Your next chapter starts with a hello.</h3><p>Select a connection to pick up where you left off.</p></div>}</div>
    </div></div>;
}
