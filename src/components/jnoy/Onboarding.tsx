import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { motion } from 'motion/react';
import { ArrowRight, Check, Globe2, ShieldCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { COUNTRIES, LANGUAGES, countryFlag, onboardingSchema, type Prefs, type Profile } from '@/lib/jnoy';
import { TagPicker } from './TagPicker';

export type OnboardingValues = { first: string; last: string; gender: string; age: string; country: string; language: string; tags: string[] };

export function useProfileForm(user: User, profile: Profile | null, prefs: Prefs | null, detectedCountry: string | null) {
  const md = (user.user_metadata || {}) as Record<string, string | undefined>;
  const [v, setV] = useState<OnboardingValues>({ first: '', last: '', gender: '', age: '', country: '', language: 'English', tags: [] });
  useEffect(() => {
    setV({
      first: profile?.first_name || md['given_name'] || (md['full_name'] || md['name'] || '').split(' ')[0] || '',
      last: profile?.last_name || md['family_name'] || (md['full_name'] || '').split(' ').slice(1).join(' ') || '',
      gender: profile?.gender || '',
      age: profile?.age ? String(profile.age) : '',
      country: profile?.country_code || detectedCountry || '',
      language: prefs?.languages?.[0] || 'English',
      tags: profile?.tags || [],
    });
  }, [profile?.id, profile?.updated_at, prefs?.updated_at, detectedCountry]);
  return [v, setV] as const;
}

export async function saveProfile(v: OnboardingValues): Promise<string | null> {
  const parsed = onboardingSchema.safeParse(v);
  if (!parsed.success) return parsed.error.issues[0]?.message || 'Please complete every field';
  const d = parsed.data;
  const { error } = await supabase.rpc('complete_onboarding', { _first: d.first, _last: d.last, _gender: d.gender, _age: d.age, _country: d.country, _language: d.language, _tags: d.tags });
  if (error) return error.message;
  try { localStorage.removeItem('jnoy_terms_ok'); } catch { /* ignore */ }
  return null;
}

export function ProfileFields({ v, set, detectedCountry }: { v: OnboardingValues; set: (v: OnboardingValues) => void; detectedCountry: string | null }) {
  const up = (k: keyof OnboardingValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ ...v, [k]: e.target.value });
  return <div className="jn-form">
    <div className="two-col">
      <label>First name *<input required value={v.first} maxLength={30} onChange={up('first')} placeholder="First name" autoComplete="given-name"/></label>
      <label>Last name *<input required value={v.last} maxLength={30} onChange={up('last')} placeholder="Last name" autoComplete="family-name"/></label>
    </div>
    <div className="two-col">
      <label>Gender *
        <div className="jn-seg">{(['male', 'female', 'other'] as const).map(g => <button type="button" key={g} className={v.gender === g ? 'on' : ''} onClick={() => set({ ...v, gender: g })}>{g[0]!.toUpperCase() + g.slice(1)}</button>)}</div>
      </label>
      <label>Age *<input required type="number" inputMode="numeric" min={18} max={100} value={v.age} onChange={up('age')} placeholder="18+"/></label>
    </div>
    <div className="two-col">
      <label>Country * {detectedCountry && <small><Globe2 size={12}/> detected {countryFlag(detectedCountry)}</small>}
        <select required value={v.country} onChange={up('country')}><option value="">Choose your country</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}</select>
      </label>
      <label>Language *<select required value={v.language} onChange={up('language')}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></label>
    </div>
    <label>Your tags <small>optional</small></label>
    <TagPicker value={v.tags} onChange={tags => set({ ...v, tags })}/>
  </div>;
}

export function Onboarding({ user, profile, prefs, detectedCountry, onDone, notify }: { user: User; profile: Profile | null; prefs: Prefs | null; detectedCountry: string | null; onDone: () => void; notify: (s: string) => void }) {
  const [v, setV] = useProfileForm(user, profile, prefs, detectedCountry);
  const [agree, setAgree] = useState(!!profile?.terms_accepted_at);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile?.terms_accepted_at) setAgree(true); }, [profile?.terms_accepted_at]);
  const complete = !!(v.first.trim() && v.last.trim() && v.gender && Number(v.age) >= 18 && v.country && v.language && agree);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { notify('Please confirm you are 18+ and accept the policies.'); return; }
    setBusy(true);
    const err = await saveProfile(v);
    setBusy(false);
    if (err) notify(err); else { notify('You’re all set! Tap Start matching to meet someone.'); onDone(); }
  };
  const avatar = profile?.avatar_url || (user.user_metadata as { avatar_url?: string })?.avatar_url;
  return <div className="jn-onboard">
    <motion.form className="jn-onboard-card" onSubmit={submit} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="jn-onboard-head">
        {avatar ? <img src={avatar} alt="" className="jn-avatar-lg" referrerPolicy="no-referrer"/> : <div className="jn-avatar-lg">{(v.first[0] || 'J').toUpperCase()}</div>}
        <div><span className="section-kicker">ONE QUICK STEP</span><h1>Tell us a little <em>about you.</em></h1><p>Everything marked * is required. You only do this once.</p></div>
      </div>
      <ProfileFields v={v} set={setV} detectedCountry={detectedCountry}/>
      {!profile?.terms_accepted_at && <label className={`jn-check ${agree ? 'on' : ''}`}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}/><span className="jn-box">{agree && <Check size={13}/>}</span><span>I’m 18+ and agree to the <Link to="/terms" target="_blank">Terms</Link>, <Link to="/privacy" target="_blank">Privacy Policy</Link> and <Link to="/guidelines" target="_blank">Guidelines</Link>.</span></label>}
      <button className="full-primary" disabled={busy || !complete}>{busy ? 'Saving…' : 'Finish & start meeting people'} <ArrowRight size={18}/></button>
      <p className="jn-muted jn-center"><ShieldCheck size={14}/> Your last name is never shown to matches.</p>
    </motion.form>
  </div>;
}
