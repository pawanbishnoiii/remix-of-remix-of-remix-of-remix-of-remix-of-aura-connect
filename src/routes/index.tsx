import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowUpRight, BadgeCheck, Camera, CameraOff, ChevronDown, Compass, Flag, Globe2, Heart, LockKeyhole, Menu, MessageCircle, Mic, MicOff, MoreHorizontal, PhoneOff, Play, Search, Send, Settings2, ShieldCheck, Shuffle, Sparkles, Volume2, Wifi, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { Brand } from '@/components/jnoy/Brand';
import { VideoStage } from '@/components/jnoy/VideoStage';
import { COUNTRIES, INTERESTS, authSchema, countryLabel, messageSchema, profileSchema } from '@/lib/jnoy';
import world from '@/assets/jnoy-world.jpg';
import star from '@/assets/jnoy-spark.jpg';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Prefs = Database['public']['Tables']['user_preferences']['Row'];
type Session = Database['public']['Tables']['conversation_sessions']['Row'];
type Msg = Database['public']['Tables']['session_messages']['Row'];
type Section = 'discover' | 'messages' | 'profile' | 'admin';
type Mode = 'video' | 'audio' | 'text';
const ease = { duration: .35 };
const countryNames = (codes: string[]) => codes.length ? codes.map(countryLabel).join(', ') : 'Anywhere in the world';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [section, setSection] = useState<Section>('discover');
  const [authOpen, setAuthOpen] = useState(false);
  const [active, setActive] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState('');
  const notify = (v: string) => { setToast(v); setTimeout(() => setToast(''), 5000); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => { setUser(s?.user ?? null); setReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) { setProfile(null); setPrefs(null); setIsAdmin(false); setActive(null); return; }
    let canceled = false;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('is_staff', { _user_id: user.id }),
      supabase.from('conversation_sessions').select('*').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).in('status', ['created', 'connecting', 'connected']).order('created_at', { ascending: false }).limit(1),
    ]).then(([p, pref, role, sessions]) => { if (!canceled) { setProfile(p.data); setPrefs(pref.data); setIsAdmin(!!role.data); if (sessions.data?.[0]) setActive(sessions.data[0]); } });
    return () => { canceled = true; };
  }, [user]);
  const refresh = async () => { if (!user) return; const [p, pref] = await Promise.all([supabase.from('profiles').select('*').eq('id', user.id).single(), supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()]); setProfile(p.data); setPrefs(pref.data); };
  const go = (s: Section) => { if (!user) { setAuthOpen(true); return; } setSection(s); };

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><Brand light/><nav className="header-links"><button onClick={() => go('discover')} className={section === 'discover' ? 'selected' : ''}>Discover</button><button onClick={() => go('messages')} className={section === 'messages' ? 'selected' : ''}>Messages</button><button onClick={() => go('profile')} className={section === 'profile' ? 'selected' : ''}>My profile</button>{isAdmin && <button onClick={() => go('admin')} className={section === 'admin' ? 'selected' : ''}>Admin</button>}</nav><div className="header-actions"><span className="online-pill"><span className="live-dot"/> Meaningful connections start here</span><button className="header-account" onClick={() => user ? go('profile') : setAuthOpen(true)}>{user ? (profile?.display_name?.[0] || user.email?.[0] || 'J').toUpperCase() : 'Sign in'} {!user && <ArrowUpRight size={15}/>}</button></div></div></header>
    <main>{active && user ? <CallRoom key={active.id} session={active} user={user} onClose={() => { setActive(null); setSection('discover'); }} onNext={() => { setActive(null); setSection('discover'); }} notify={notify}/> : section === 'discover' ? <Discover user={user} profile={profile} prefs={prefs} onAuth={() => setAuthOpen(true)} onSession={setActive} onProfile={() => go('profile')} notify={notify}/> : section === 'messages' && user ? <Messages user={user} notify={notify}/> : section === 'profile' && user ? <ProfilePage user={user} profile={profile} prefs={prefs} refresh={refresh} notify={notify}/> : section === 'admin' && user && isAdmin ? <AdminPage notify={notify}/> : null}</main>
    {!active && <footer className="site-footer"><div><Brand light/><p>Real conversations. Unexpected connections.<br/>A little closer to everywhere.</p></div><div className="footer-side"><span>Made for curious people, everywhere.</span><span>18+ only · Be kind · Stay safe</span></div></footer>}
    {!active && <nav className="mobile-nav"><button className={section==='discover'?'active':''} onClick={() => go('discover')}><Compass size={22}/>Discover</button><button className={section==='messages'?'active':''} onClick={() => go('messages')}><MessageCircle size={22}/>Messages</button><button className={section==='profile'?'active':''} onClick={() => go('profile')}><span className="nav-avatar">{profile?.display_name?.[0] || 'J'}</span>Profile</button></nav>}
    <AnimatePresence>{authOpen && <AuthModal onClose={() => setAuthOpen(false)} notify={notify}/>}</AnimatePresence>
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
    {!ready && <div className="loading-screen">Finding your place in the world…</div>}
  </div>;
}

function Discover({ user, profile, prefs, onAuth, onSession, onProfile, notify }: { user: User | null; profile: Profile | null; prefs: Prefs | null; onAuth: () => void; onSession: (s: Session) => void; onProfile: () => void; notify: (s: string) => void }) {
  const [mode, setMode] = useState<Mode>('video');
  const [countries, setCountries] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState('English');
  const [strict, setStrict] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraState, setCameraState] = useState<'idle'|'requesting'|'denied'|'ready'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const searchRef = useRef(false);
  useEffect(() => { if (prefs) { setCountries(prefs.preferred_countries || []); setInterests(prefs.interests || []); setMode((prefs.default_mode as Mode) || 'video'); setLanguage(prefs.languages?.[0] || 'English'); } }, [prefs]);
  useEffect(() => { return () => { stream?.getTracks().forEach(t => t.stop()); }; }, [stream]);
  useEffect(() => { if (mode === 'text' && stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); setCameraState('idle'); } }, [mode]);
  async function requestMedia() { setCameraState('requesting'); try { const s = await navigator.mediaDevices.getUserMedia({ video: mode === 'video', audio: true }); setStream(s); setCameraState('ready'); return s; } catch { setCameraState('denied'); notify('Camera or microphone access was denied. Allow access in browser settings or choose text chat.'); return null; } }
  const stop = async () => { searchRef.current = false; setSearching(false); if (user) await supabase.rpc('leave_match_queue'); };
  useEffect(() => () => { searchRef.current = false; if (user) void supabase.rpc('leave_match_queue'); }, [user]);
  const start = async () => {
    if (!user) { onAuth(); return; }
    if (!profile?.onboarding_completed) { notify('Complete your profile before matching.'); onProfile(); return; }
    if (mode !== 'text' && !stream && !await requestMedia()) return;
    const snapshot = { countries, interests, languages: [language], strict, broaden: !strict };
    const { error } = await supabase.rpc('join_match_queue', { _mode: mode, _snapshot: snapshot });
    if (error) { notify(error.message); return; }
    setSearching(true); searchRef.current = true;
    const poll = async () => {
      if (!searchRef.current) return;
      const { data, error: e } = await supabase.rpc('find_or_create_match');
      if (!searchRef.current) return;
      if (e) { notify(e.message); stop(); return; }
      const response = data as { status?: string; session_id?: string } | null;
      if (response?.status === 'matched' && response.session_id) {
        const { data: s } = await supabase.from('conversation_sessions').select('*').eq('id', response.session_id).single();
        if (s && searchRef.current) { searchRef.current = false; setSearching(false); onSession(s); return; }
      }
      if (response?.status === 'idle') { stop(); return; }
      setTimeout(poll, 2200);
    }; poll();
  };
  const toggle = (v: string, arr: string[], fn: (a: string[]) => void) => fn(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  return <>
    <section className="hero"><div className="hero-inner"><motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={ease}><div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={14}/></span> YOUR WORLD IS ABOUT TO GET BIGGER</div><h1>Meet someone<br/><em>unexpected.</em><span className="heading-spark">✳</span></h1><p>New places. Different perspectives. Great conversations. Connect with someone new, wherever life takes you.</p><div className="hero-proof"><span className="proof-bubbles"><b>🌍</b><b>✳</b><b>💜</b></span><span>Made for the beautifully curious</span></div></motion.div><div className="hero-art"><img src={world} alt="Clay illustration of a lavender planet with a heart and star" width={1280} height={1024}/><div className="art-sticker sticker-top">✳ &nbsp; a whole world of hellos</div><div className="art-sticker sticker-bottom"><span className="live-dot"/> Connections happen here</div></div></div></section>
    <section className="matching-wrap" id="matching"><div className="section-heading"><div><span className="section-kicker">THE NEXT HELLO STARTS HERE</span><h2>Your space to <em>connect.</em></h2></div><p>Set the vibe, get comfortable, and let us bring the right conversation your way.</p></div><div className="matching-grid"><div className="preview-card"><div className="preview-head"><div><span className="preview-icon"><Camera size={18}/></span><span>Your preview</span></div><span className="private-pill"><LockKeyhole size={12}/> Just for you</span></div><div className="preview-frame">{mode === 'text' ? <div className="preview-placeholder"><div className="placeholder-orb"><MessageCircle size={40}/></div><h3>Words make worlds.</h3><p>Text-only mode is ready when you are.</p></div> : stream && mode === 'video' ? <VideoStage stream={stream} label="Your camera"/> : <div className="preview-placeholder"><div className="placeholder-orb"><Camera size={39}/></div><h3>{cameraState === 'denied' ? 'Camera access needed' : cameraState === 'requesting' ? 'Asking for access…' : 'Your camera, your call.'}</h3><p>{cameraState === 'denied' ? 'Update browser permissions or switch to text chat.' : 'Only you can see this preview until you connect.'}</p><button className="preview-activate" onClick={requestMedia}><Camera size={16}/> {cameraState === 'denied' ? 'Try again' : 'Turn on camera'}</button></div>}<div className="preview-corner"><span className="live-dot"/> {mode === 'text' ? 'TEXT MODE' : stream ? 'PREVIEW ON' : 'CAMERA OFF'}</div></div><div className="preview-foot"><span><ShieldCheck size={17}/> You’re always in control of your camera and mic.</span><span className="quality"><Wifi size={17}/> Adaptive quality</span></div></div>
    <div className="prefs-card"><div className="prefs-title"><div><span className="prefs-badge"><Settings2 size={20}/></span><div><h3>Make it your kind of chat</h3><p>A few preferences go a long way.</p></div></div><MoreHorizontal size={20}/></div><div className="prefs-body"><label className="field-label"><Globe2 size={16}/> Where in the world?</label><select className="input-select" value={countries[0] || ''} onChange={e => setCountries(e.target.value ? [e.target.value] : [])}><option value="">Anywhere — surprise me</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}</select><p className="field-hint">We'll look nearby first, then open up the world.</p><label className="field-label"><MessageCircle size={16}/> Language</label><select className="input-select" value={language} onChange={e => setLanguage(e.target.value)}>{['English','Hindi','Spanish','French','German','Portuguese','Arabic','Japanese'].map(l => <option key={l}>{l}</option>)}</select><label className="field-label interest-label"><Sparkles size={16}/> What are you into? <span>optional</span></label><div className="chips">{INTERESTS.slice(0,8).map((tag, i) => <button key={tag} onClick={() => toggle(tag, interests, setInterests)} className={`chip ${interests.includes(tag) ? 'chosen' : ''}`}><span>{['✈','♫','✿','✺','▤','✦','◈','☼'][i]}</span>{tag}</button>)}</div><button className={`strict-toggle ${strict ? 'on' : ''}`} onClick={() => setStrict(!strict)}><span className="toggle-track"/><span>Only match my selected country <small>May take longer to find a match</small></span></button></div></div></div>
    <div className="mode-and-start"><div className="mode-pick"><span className="mode-label">HOW WOULD YOU LIKE TO CONNECT?</span><div className="mode-options"><button className={mode==='video'?'active':''} onClick={() => setMode('video')}><Camera size={18}/> Video chat</button><button className={mode==='audio'?'active':''} onClick={() => setMode('audio')}><Mic size={18}/> Voice chat</button><button className={mode==='text'?'active':''} onClick={() => setMode('text')}><MessageCircle size={18}/> Text chat</button></div></div><button className="mobile-pref-button" onClick={() => setSheet(true)}><Settings2 size={17}/> Preferences <ChevronDown size={15}/></button><div className="start-area"><button className="start-button" onClick={searching ? stop : start}>{searching ? <><span className="spinner"/> Looking for your person… <X size={19}/></> : <><span className="start-arrow"><ArrowRight size={20}/></span> Start matching <ArrowUpRight size={21}/></>}</button><span>{searching ? 'Matching by interests, country and language. Tap to cancel.' : 'No pressure. Your next conversation is one click away.'}</span></div></div></section>
    <section className="how-section"><div className="how-inner"><div className="how-heading"><span className="section-kicker">SIMPLE AS SAYING HELLO</span><h2>Good things happen<br/>when you <em>connect.</em></h2><p>Forget the endless scrolling. Here, it’s all about the moment and the person on the other side.</p></div><div className="how-cards"><article><div className="how-icon peach"><Settings2 size={28}/></div><span>01 / MAKE IT YOURS</span><h3>Set your vibe</h3><p>Pick your interests and how you want to chat. We’ll take it from there.</p></article><article><div className="how-icon mint"><Shuffle size={28}/></div><span>02 / LET THE MAGIC HAPPEN</span><h3>Meet someone new</h3><p>Our matching finds people with shared interests, near or far.</p></article><article><div className="how-icon sky"><Heart size={28}/></div><span>03 / KEEP THE GOOD ONES</span><h3>Keep the connection</h3><p>If you both click, save your connection and say hello again later.</p></article></div></div></section>
    <section className="bottom-cta"><div><span className="section-kicker">THE WORLD IS WAITING</span><h2>One hello can change<br/><em>everything.</em></h2><p>Come as you are. Leave with a story.</p><button onClick={start}>Find your next conversation <ArrowUpRight size={19}/></button></div><img src={star} alt="Smiling coral clay star" loading="lazy" width={1024} height={1024}/></section>
    {sheet && <div className="sheet-backdrop" onClick={() => setSheet(false)}><div className="pref-sheet" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={() => setSheet(false)} aria-label="Close preferences"><X/></button><h3>Your preferences</h3><p>Tell us what kind of hello you’re looking for.</p><label className="field-label">Country</label><select className="input-select" value={countries[0] || ''} onChange={e => setCountries(e.target.value ? [e.target.value] : [])}><option value="">Anywhere</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select><label className="field-label">Language</label><select className="input-select" value={language} onChange={e => setLanguage(e.target.value)}>{['English','Hindi','Spanish','French','German','Portuguese','Arabic','Japanese'].map(l => <option key={l}>{l}</option>)}</select><label className="field-label">Interests</label><div className="chips">{INTERESTS.map(t => <button key={t} className={`chip ${interests.includes(t)?'chosen':''}`} onClick={() => toggle(t, interests, setInterests)}>{t}</button>)}</div><button className="strict-toggle" onClick={() => setStrict(!strict)}><span className={`toggle-track ${strict?'on':''}`}/>Only selected country</button><button className="full-primary" onClick={() => setSheet(false)}>Save preferences <ArrowRight size={18}/></button></div></div>}
  </>;
}

function AuthModal({ onClose, notify }: { onClose: () => void; notify: (s: string) => void }) {
  const [signup, setSignup] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const v = authSchema.safeParse({ email, password }); if (!v.success) { notify('Enter a valid email and a password of at least 8 characters.'); return; } setBusy(true); const { error, data } = signup ? await supabase.auth.signUp(v.data) : await supabase.auth.signInWithPassword(v.data); setBusy(false); if (error) notify(error.message); else { if (signup && !data.session) notify('Check your email to confirm your account, then sign in.'); else onClose(); } };
  return <motion.div className="modal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}><motion.div className="auth-modal" initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sign in"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button><span className="modal-ornament">✳</span><Brand/><h2>{signup ? 'Your story starts here.' : 'Welcome back, explorer.'}</h2><p>More world. More wonder. More wonderful people.</p><form onSubmit={submit}><label>Email address<input type="email" required maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} maxLength={128} autoComplete={signup?'new-password':'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="full-primary" disabled={busy}>{busy?'Please wait…':signup?'Create my account':'Sign in'} <ArrowRight size={18}/></button></form><div className="auth-divider">or</div><button className="google-button" onClick={async () => { const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options: { redirectTo: window.location.origin } }); if (error) notify(error.message); }}>Continue with Google <ArrowUpRight size={16}/></button><p className="auth-switch">{signup ? 'Already part of Jnoy?' : 'New to Jnoy?'} <button onClick={() => setSignup(!signup)}>{signup?'Sign in':'Create an account'}</button></p><small>By joining, you agree to be kind, stay safe and be 18 or older.</small></motion.div></motion.div>;
}