import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Download, Globe2, LogOut, MapPin, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { useServerFn } from '@tanstack/react-start';
import { exportMyData } from '@/lib/activity.functions';
import frame from '@/assets/clay-shield.webp';
import { supabase } from '@/integrations/supabase/client';
import { countryFlag, countryLabel, type Prefs, type Profile } from '@/lib/jnoy';
import { ProfileFields, saveProfile, useProfileForm } from './Onboarding';

export function ProfilePage({ user, profile, prefs, detectedCountry, refresh, notify, onStart }: { user: User; profile: Profile | null; prefs: Prefs | null; detectedCountry: string | null; refresh: () => Promise<void>; notify: (s: string) => void; onStart: () => void }) {
  const [v, setV] = useProfileForm(user, profile, prefs, detectedCountry);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const save = async () => { setBusy(true); const err = await saveProfile(v); setBusy(false); if (err) notify(err); else { notify('Profile saved.'); setJustSaved(true); await refresh(); } };
  const signOut = async () => { await supabase.auth.signOut(); };
  const [consents, setConsents] = useState<{ policy_type: string; policy_version: string; accepted_at: string; source: string }[]>([]);
  useEffect(() => { supabase.from('policy_acceptances').select('policy_type,policy_version,accepted_at,source').eq('user_id', user.id).order('accepted_at', { ascending: false }).then(({ data }) => setConsents(data || [])); }, [user.id]);
  const exportFn = useServerFn(exportMyData);
  const doExport = async () => {
    try { const d = await exportFn(); const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'jnoy-my-data.json'; a.click(); URL.revokeObjectURL(url); }
    catch { notify('Could not export right now. Please try again.'); }
  };
  const doDelete = async () => {
    if (window.prompt('This permanently deletes your account and data. Type DELETE to confirm.') !== 'DELETE') return;
    const { error } = await supabase.rpc('delete_my_account'); if (error) { notify(error.message); return; }
    await supabase.auth.signOut(); notify('Your account has been deleted.');
  };
  const loc = [profile?.detected_district, profile?.detected_region, countryLabel(profile?.detected_country)].filter(Boolean);
  const LABEL: Record<string, string> = { age_18: '18+ confirmation', terms: 'Terms of Service', privacy: 'Privacy Policy', guidelines: 'Community Guidelines', location: 'Approximate location use' };
  const avatar = profile?.avatar_url;
  return <div className="interior-page">
    <div className="interior-header"><span className="section-kicker">A LITTLE ABOUT YOU</span><h1>Your corner of <em>Jnoy.</em></h1><p>Update anything, any time. Changes apply to your next match.</p></div>
    <div className="profile-layout">
      <div className="surface profile-card">
        {avatar ? <img className="profile-avatar jn-img-avatar" src={avatar} alt="" referrerPolicy="no-referrer"/> : <div className="profile-avatar">{(v.first[0] || 'J').toUpperCase()}<span>✳</span></div>}
        <h2>{v.first ? `${v.first} ${v.last}` : 'Your story starts here'}</h2><p>{profile?.email || user.email}</p>
        <div className="profile-facts"><span><Globe2 size={17}/>{countryFlag(v.country)} {countryLabel(v.country)}</span><span><MessageCircle size={17}/>{v.language}</span><span><ShieldCheck size={17}/>18+ confirmed at signup</span>{profile?.detected_country && <span title="Approximate, from your network — used for safety and nearby-first matching"><MapPin size={17}/>Signed in near {loc.join(', ')}</span>}</div>
        <div className="tag-row">{v.tags.map(t => <span key={t}>✳ {t}</span>)}</div>
        <button className="full-primary jn-mt" onClick={onStart}>Start matching <ArrowRight size={17}/></button>
      </div>
      <div className="surface edit-card"><h2>Make it yours</h2>
        <ProfileFields v={v} set={x => { setV(x); setJustSaved(false); }} detectedCountry={detectedCountry}/>
        <button className="full-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <ArrowRight size={17}/></button>
        {justSaved && <button className="full-primary jn-start-after" onClick={onStart}>Saved — start matching now <ArrowRight size={17}/></button>}
        <button className="subtle-action" onClick={signOut}><LogOut size={14}/> Sign out</button>
      </div>
      <div className="surface edit-card jn-privacy-card"><img src={frame} alt="" width={120} height={120} loading="lazy" className="jn-deco"/><h2>Privacy &amp; your data</h2>
        <h3 className="jn-sub">Consent history</h3>
        {consents.length ? <ul className="jn-consents">{consents.map(c => <li key={c.policy_type + c.policy_version}><span>{LABEL[c.policy_type] || c.policy_type} <small>v{c.policy_version}</small></span><time>{new Date(c.accepted_at).toLocaleDateString()}</time></li>)}</ul> : <p className="jn-muted">No consent recorded yet.</p>}
        <div className="jn-row"><button className="preview-activate" onClick={doExport}><Download size={15}/> Download my data</button><button className="preview-activate jn-danger" onClick={doDelete}><Trash2 size={15}/> Delete account</button></div>
      </div>
    </div>
  </div>;
}
