import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Globe2, LogOut, MessageCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { countryFlag, countryLabel, type Prefs, type Profile } from '@/lib/jnoy';
import { ProfileFields, saveProfile, useProfileForm } from './Onboarding';

export function ProfilePage({ user, profile, prefs, detectedCountry, refresh, notify, onStart }: { user: User; profile: Profile | null; prefs: Prefs | null; detectedCountry: string | null; refresh: () => Promise<void>; notify: (s: string) => void; onStart: () => void }) {
  const [v, setV] = useProfileForm(user, profile, prefs, detectedCountry);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const save = async () => { setBusy(true); const err = await saveProfile(v); setBusy(false); if (err) notify(err); else { notify('Profile saved.'); setJustSaved(true); await refresh(); } };
  const signOut = async () => { await supabase.auth.signOut(); };
  const avatar = profile?.avatar_url;
  return <div className="interior-page">
    <div className="interior-header"><span className="section-kicker">A LITTLE ABOUT YOU</span><h1>Your corner of <em>Jnoy.</em></h1><p>Update anything, any time. Changes apply to your next match.</p></div>
    <div className="profile-layout">
      <div className="surface profile-card">
        {avatar ? <img className="profile-avatar jn-img-avatar" src={avatar} alt="" referrerPolicy="no-referrer"/> : <div className="profile-avatar">{(v.first[0] || 'J').toUpperCase()}<span>✳</span></div>}
        <h2>{v.first ? `${v.first} ${v.last}` : 'Your story starts here'}</h2><p>{profile?.email || user.email}</p>
        <div className="profile-facts"><span><Globe2 size={17}/>{countryFlag(v.country)} {countryLabel(v.country)}</span><span><MessageCircle size={17}/>{v.language}</span><span><ShieldCheck size={17}/>18+ verified by you</span></div>
        <div className="tag-row">{v.tags.map(t => <span key={t}>✳ {t}</span>)}</div>
        <button className="full-primary jn-mt" onClick={onStart}>Start matching <ArrowRight size={17}/></button>
      </div>
      <div className="surface edit-card"><h2>Make it yours</h2>
        <ProfileFields v={v} set={x => { setV(x); setJustSaved(false); }} detectedCountry={detectedCountry}/>
        <button className="full-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <ArrowRight size={17}/></button>
        {justSaved && <button className="full-primary jn-start-after" onClick={onStart}>Saved — start matching now <ArrowRight size={17}/></button>}
        <button className="subtle-action" onClick={signOut}><LogOut size={14}/> Sign out</button>
      </div>
    </div>
  </div>;
}
