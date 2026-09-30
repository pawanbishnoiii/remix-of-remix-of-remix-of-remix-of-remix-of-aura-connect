import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence } from 'motion/react';
import { ArrowUpRight, Shield, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Brand } from '@/components/jnoy/Brand';
import { AuthModal } from '@/components/jnoy/AuthModal';
import { Onboarding } from '@/components/jnoy/Onboarding';
import { MatchStage } from '@/components/jnoy/MatchStage';
import { CallRoom } from '@/components/jnoy/CallRoom';
import { Messages } from '@/components/jnoy/Messages';
import { ProfilePage } from '@/components/jnoy/ProfilePage';
import { SiteFooter } from '@/components/jnoy/SiteFooter';
import { Hero } from '@/components/jnoy/home/Hero';
import { GuestPreview } from '@/components/jnoy/home/GuestPreview';
import { HowItWorks } from '@/components/jnoy/home/HowItWorks';
import { BottomCta } from '@/components/jnoy/home/BottomCta';
import { recordActivity } from '@/lib/activity.functions';
import { searchStore } from '@/lib/search';
import { TERMS_FLAG, type Prefs, type Profile, type Session } from '@/lib/jnoy';

type Section = 'discover' | 'messages' | 'profile';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Jnoy — Random video chat with strangers, worldwide' },
    { name: 'description', content: 'Meet someone unexpected. Random 18+ video, voice and text chat — nearby first, then the whole world.' },
    { property: 'og:title', content: 'Jnoy — Meet someone unexpected' },
    { property: 'og:description', content: 'Random 18+ video, voice and text chat with strangers around the world.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Home,
});

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [section, setSection] = useState<Section>('discover');
  const [authOpen, setAuthOpen] = useState(false);
  const [authSignup, setAuthSignup] = useState(true);
  const openAuth = (signup: boolean) => { setAuthSignup(signup); setAuthOpen(true); };
  const [active, setActive] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const notify = (v: string) => { setToast(v); setTimeout(() => setToast(t => (t === v ? '' : t)), 5000); };

  // One store subscription for the whole app: a match that lands while the
  // user is on Messages, Profile or another route still opens the call.
  useEffect(() => searchStore.subscribe(() => {
    const m = searchStore.matched;
    if (m) { searchStore.clearMatched(); setActive(m); setSection('discover'); setAutoStart(false); }
    const err = searchStore.error;
    if (err) { searchStore.clearError(); notify(err); }
  }), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (!user) return;
    const [p, pref] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    setProfile(p.data); setPrefs(pref.data);
  };

  useEffect(() => {
    if (!user) { setProfile(null); setPrefs(null); setIsAdmin(false); setActive(null); setLoaded(false); return; }
    let canceled = false;
    (async () => {
      await supabase.rpc('ensure_my_profile');
      let consented = false; try { consented = localStorage.getItem(TERMS_FLAG) === '1'; } catch { /* ignore */ }
      if (consented) { await supabase.rpc('accept_terms'); try { localStorage.removeItem(TERMS_FLAG); } catch { /* ignore */ } }
      const [p, pref, role, sessions] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('is_staff', { _user_id: user.id }),
        supabase.from('conversation_sessions').select('*').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).in('status', ['created', 'connecting', 'connected']).gte('created_at', new Date(Date.now() - 30 * 60000).toISOString()).order('created_at', { ascending: false }).limit(1),
      ]);
      if (canceled) return;
      setProfile(p.data); setPrefs(pref.data); setIsAdmin(!!role.data);
      if (sessions.data?.[0]) setActive(sessions.data[0]);
      setLoaded(true);
    })();
    return () => { canceled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let visitId: string | null = null; let gone = false;
    recordActivity({ data: { visitId: null, end: false } }).then(r => {
      if (gone) { void recordActivity({ data: { visitId: r.visitId, end: true } }); return; }
      visitId = r.visitId; if (r.country) setDetectedCountry(r.country);
    }).catch(() => {});
    const hb = setInterval(() => { if (visitId && document.visibilityState === 'visible') void recordActivity({ data: { visitId, end: false } }); }, 60000);
    return () => { gone = true; clearInterval(hb); if (visitId) void recordActivity({ data: { visitId, end: true } }); };
  }, [user?.id]);

  const go = (s: Section) => { if (!user) { openAuth(false); return; } setSection(s); };
  const startFromAnywhere = () => { setSection('discover'); };
  useEffect(() => { try { setSkipOnboarding(sessionStorage.getItem('jnoy_onb_skip') === '1'); } catch { /* ignore */ } }, [user?.id]);
  const needsOnboarding = !!user && loaded && !profile?.onboarding_completed && !skipOnboarding;
  useEffect(() => { if (needsOnboarding) void supabase.rpc('mark_onboarding_seen'); }, [needsOnboarding]);
  const skip = () => { try { sessionStorage.setItem('jnoy_onb_skip', '1'); } catch { /* ignore */ } setSkipOnboarding(true); setSection('discover'); };
  const inCall = !!(active && user);

  return <div className={`app-shell ${user ? 'jn-member' : ''}`}>
    {!inCall && <header className="site-header"><div className="header-inner">
      <Brand light/>
      {user && !needsOnboarding && isAdmin && <nav className="header-links"><Link to="/admin" className="jn-admin-link"><Shield size={14}/> Admin</Link></nav>}
      <div className="header-actions">
        {!user && <span className="online-pill"><span className="live-dot"/> 18+ · Free · Worldwide</span>}
        <button className="header-account" onClick={() => (user ? go(section === 'profile' ? 'discover' : 'profile') : openAuth(false))}>
          {user ? (profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="jn-head-avatar" referrerPolicy="no-referrer"/> : (profile?.display_name?.[0] || user.email?.[0] || 'J').toUpperCase()) : <>Sign in <ArrowUpRight size={15}/></>}
        </button>
      </div>
    </div></header>}

    <main>
      {!ready || (user && !loaded) ? <div className="jn-loading"><div className="search-rings"><span/><span/><span/></div><p>Finding your place in the world…</p></div>
        : !user ? <><Hero onStart={() => openAuth(true)}/><GuestPreview onStart={() => openAuth(true)}/><HowItWorks/><BottomCta onStart={() => openAuth(true)}/></>
        : needsOnboarding ? <Onboarding user={user} profile={profile} prefs={prefs} detectedCountry={detectedCountry ?? profile?.detected_country ?? null} notify={notify} onSkip={skip} onDone={async () => { await refresh(); setSection('discover'); }}/>
        : inCall ? <CallRoom key={active!.id} session={active!} user={user} notify={notify} autoNext={prefs?.auto_next ?? true} onClose={() => { setAutoStart(false); setActive(null); setSection('discover'); }} onNext={() => { setActive(null); setSection('discover'); setAutoStart(true); }}/>
        : section === 'messages' ? <Messages user={user} notify={notify} onMeet={() => setSection('discover')}/>
        : section === 'profile' ? <ProfilePage user={user} profile={profile} prefs={prefs} detectedCountry={detectedCountry ?? profile?.detected_country ?? null} refresh={refresh} notify={notify} onStart={startFromAnywhere}/>
        : profile ? <MatchStage user={user} profile={profile} prefs={prefs} autoStart={autoStart} onAutoStarted={() => setAutoStart(false)} onSession={setActive} notify={notify} onNeedProfile={() => setSection('profile')} onMessages={() => setSection('messages')} refresh={refresh}/> : null}
    </main>

    {!user && ready && <SiteFooter/>}
    {!user && ready && <button className="mobile-match-cta" onClick={() => openAuth(true)}>Continue with Google</button>}
    <AnimatePresence>{authOpen && <AuthModal initialSignup={authSignup} onClose={() => setAuthOpen(false)} notify={notify}/>}</AnimatePresence>
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>;
}
