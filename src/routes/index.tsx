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
import { recordActivity } from '@/lib/activity.functions';
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
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [section, setSection] = useState<Section>('discover');
  const [authOpen, setAuthOpen] = useState(false);
  const [active, setActive] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const notify = (v: string) => { setToast(v); setTimeout(() => setToast(''), 5000); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => { setUser(s?.user ?? null); setReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) { setProfile(null); setPrefs(null); setIsAdmin(false); setActive(null); return; }
    let canceled = false;
    supabase.rpc('ensure_my_profile').then(() => Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('is_staff', { _user_id: user.id }),
      supabase.from('conversation_sessions').select('*').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).in('status', ['created', 'connecting', 'connected']).order('created_at', { ascending: false }).limit(1),
    ])).then(([p, pref, role, sessions]) => { if (!canceled) { setProfile(p.data); setPrefs(pref.data); setIsAdmin(!!role.data); if (sessions.data?.[0]) setActive(sessions.data[0]); if (p.data && !p.data.onboarding_completed) setSection('profile'); } });
    return () => { canceled = true; };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let visitId: string | null = null;
    let gone = false;
    recordActivity({ data: { visitId: null, end: false } }).then(result => {
      if (gone) { void recordActivity({ data: { visitId: result.visitId, end: true } }); return; }
      visitId = result.visitId;
      if (result.country && COUNTRIES.some(c => c.code === result.country)) setDetectedCountry(result.country);
    }).catch(() => {});
    const heartbeat = setInterval(() => { if (visitId && document.visibilityState === 'visible') void recordActivity({ data: { visitId, end: false } }); }, 60000);
    return () => { gone = true; clearInterval(heartbeat); if (visitId) void recordActivity({ data: { visitId, end: true } }); };
  }, [user?.id]);
  const refresh = async () => { if (!user) return; const [p, pref] = await Promise.all([supabase.from('profiles').select('*').eq('id', user.id).single(), supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()]); setProfile(p.data); setPrefs(pref.data); };
  const go = (s: Section) => { if (!user) { setAuthOpen(true); return; } setSection(s); };

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><Brand light/><nav className="header-links"><button onClick={() => go('discover')} className={section === 'discover' ? 'selected' : ''}>Discover</button><button onClick={() => go('messages')} className={section === 'messages' ? 'selected' : ''}>Messages</button><button onClick={() => go('profile')} className={section === 'profile' ? 'selected' : ''}>My profile</button>{isAdmin && <button onClick={() => go('admin')} className={section === 'admin' ? 'selected' : ''}>Admin</button>}</nav><div className="header-actions"><span className="online-pill"><span className="live-dot"/> Meaningful connections start here</span><button className="header-account" onClick={() => user ? go('profile') : setAuthOpen(true)}>{user ? (profile?.display_name?.[0] || user.email?.[0] || 'J').toUpperCase() : 'Sign in'} {!user && <ArrowUpRight size={15}/>}</button></div></div></header>
    <main>{active && user ? <CallRoom key={active.id} session={active} user={user} onClose={() => { setAutoStart(false); setActive(null); setSection('discover'); }} onNext={() => { setAutoStart(true); setActive(null); setSection('discover'); }} notify={notify}/> : section === 'discover' ? <Discover user={user} profile={profile} prefs={prefs} detectedCountry={detectedCountry} autoStart={autoStart} onAutoStarted={() => setAutoStart(false)} onAuth={() => setAuthOpen(true)} onSession={setActive} onProfile={() => go('profile')} notify={notify}/> : section === 'messages' && user ? <Messages user={user} notify={notify}/> : section === 'profile' && user ? <ProfilePage user={user} profile={profile} prefs={prefs} detectedCountry={detectedCountry} refresh={refresh} notify={notify}/> : section === 'admin' && user && isAdmin ? <AdminPage notify={notify}/> : null}</main>
    {!active && <footer className="site-footer"><div><Brand light/><p>Real conversations. Unexpected connections.<br/>A little closer to everywhere.</p></div><div className="footer-side"><span>Made for curious people, everywhere.</span><span>18+ only · Be kind · Stay safe</span></div></footer>}
    {!active && <nav className="mobile-nav"><button className={section==='discover'?'active':''} onClick={() => go('discover')}><Compass size={22}/>Discover</button><button className={section==='messages'?'active':''} onClick={() => go('messages')}><MessageCircle size={22}/>Messages</button><button className={section==='profile'?'active':''} onClick={() => go('profile')}><span className="nav-avatar">{profile?.display_name?.[0] || 'J'}</span>Profile</button></nav>}
    <AnimatePresence>{authOpen && <AuthModal onClose={() => setAuthOpen(false)} notify={notify}/>}</AnimatePresence>
    {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
    {!ready && <div className="loading-screen">Finding your place in the world…</div>}
  </div>;
}

const isMobileDevice = () => typeof window !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer:coarse)').matches);
function Discover({ user, profile, prefs, detectedCountry, autoStart, onAutoStarted, onAuth, onSession, onProfile, notify }: { user: User | null; profile: Profile | null; prefs: Prefs | null; detectedCountry: string | null; autoStart: boolean; onAutoStarted: () => void; onAuth: () => void; onSession: (s: Session) => void; onProfile: () => void; notify: (s: string) => void }) {
  const [mode, setMode] = useState<Mode>('video');
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraState, setCameraState] = useState<'idle'|'requesting'|'denied'|'ready'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const searchRef = useRef(false);
  const language = prefs?.languages?.[0] || 'English';
  const location = profile?.country_code || detectedCountry;
  useEffect(() => { if (prefs?.default_mode) setMode(prefs.default_mode as Mode); }, [prefs?.default_mode]);
  useEffect(() => { return () => { stream?.getTracks().forEach(t => t.stop()); }; }, [stream]);
  useEffect(() => { if (mode === 'text' && stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); setCameraState('idle'); } }, [mode]);
  async function requestMedia() { setCameraState('requesting'); try { const s = await navigator.mediaDevices.getUserMedia({ video: mode === 'video', audio: true }); setStream(s); setCameraState('ready'); return s; } catch { setCameraState('denied'); notify('Camera or microphone access was denied. Allow access in browser settings or choose text chat.'); return null; } }
  const stop = async () => { searchRef.current = false; setSearching(false); if (user) await supabase.rpc('leave_match_queue'); };
  useEffect(() => () => { searchRef.current = false; }, []);
  const start = async () => {
    if (!user) { onAuth(); return; }
    if (!profile?.onboarding_completed) { notify('Complete your profile before matching.'); onProfile(); return; }
    if (searchRef.current) return;
    if (mode !== 'text' && !stream && !await requestMedia()) return;
    const snapshot = { interests: profile.tags || [], languages: [language], device: isMobileDevice() ? 'mobile' : 'desktop' };
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
      if (response?.status === 'idle') { await supabase.rpc('join_match_queue', { _mode: mode, _snapshot: snapshot }); }
      setTimeout(poll, 1800);
    }; poll();
  };
  useEffect(() => { if (autoStart && profile?.onboarding_completed) { onAutoStarted(); void start(); } }, [autoStart, profile?.onboarding_completed]);
  const locationBox = <><label className="field-label"><Globe2 size={16}/> Where in the world?</label><div className="input-select auto-field">{location ? `${COUNTRIES.find(c => c.code === location)?.flag ?? '📍'} ${countryLabel(location)}` : 'Detecting your location…'}<span>Auto</span></div><p className="field-hint">Set automatically when you sign in. We match nearby people first, then the whole world.</p><label className="field-label"><MessageCircle size={16}/> Language</label><div className="input-select auto-field">{language}<button className="link-btn" onClick={onProfile}>Change</button></div><p className="field-hint">Change your language anytime in your profile.</p></>;
  return <>
    <section className="hero"><div className="hero-inner"><motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={ease}><div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={14}/></span> YOUR WORLD IS ABOUT TO GET BIGGER</div><h1>Meet someone<br/><em>unexpected.</em><span className="heading-spark">✳</span></h1><p>One tap. A random stranger. A real conversation. Tap Next anytime to meet someone new.</p><div className="hero-proof"><span className="proof-bubbles"><b>🌍</b><b>✳</b><b>💜</b></span><span>Made for the beautifully curious</span></div></motion.div><div className="hero-art"><img src={world} alt="Clay illustration of a lavender planet with a heart and star" width={1280} height={1024}/><div className="art-sticker sticker-top">✳ &nbsp; a whole world of hellos</div><div className="art-sticker sticker-bottom"><span className="live-dot"/> Connections happen here</div></div></div></section>
    <section className="matching-wrap" id="matching"><div className="section-heading"><div><span className="section-kicker">THE NEXT HELLO STARTS HERE</span><h2>Your space to <em>connect.</em></h2></div><p>No searching, no scrolling. We pair you with someone at random — nearby first, then anywhere.</p></div><div className="matching-grid"><div className="preview-card"><div className="preview-head"><div><span className="preview-icon"><Camera size={18}/></span><span>Your preview</span></div><span className="private-pill"><LockKeyhole size={12}/> Just for you</span></div><div className="preview-frame">{mode === 'text' ? <div className="preview-placeholder"><div className="placeholder-orb"><MessageCircle size={40}/></div><h3>Words make worlds.</h3><p>Text-only mode is ready when you are.</p></div> : stream && mode === 'video' ? <VideoStage stream={stream} label="Your camera"/> : <div className="preview-placeholder"><div className="placeholder-orb"><Camera size={39}/></div><h3>{cameraState === 'denied' ? 'Camera access needed' : cameraState === 'requesting' ? 'Asking for access…' : 'Your camera, your call.'}</h3><p>{cameraState === 'denied' ? 'Update browser permissions or switch to text chat.' : 'Only you can see this preview until you connect.'}</p><button className="preview-activate" onClick={requestMedia}><Camera size={16}/> {cameraState === 'denied' ? 'Try again' : 'Turn on camera'}</button></div>}{searching && <div className="search-overlay"><div className="search-rings"><span/><span/><span/><Globe2 size={34}/></div><h3>Finding someone for you…</h3><p>Looking nearby first, then around the world</p></div>}<div className="preview-corner"><span className="live-dot"/> {mode === 'text' ? 'TEXT MODE' : stream ? 'PREVIEW ON' : 'CAMERA OFF'}</div></div><div className="preview-foot"><span><ShieldCheck size={17}/> You’re always in control of your camera and mic.</span><span className="quality"><Wifi size={17}/> Adjusts to your connection</span></div></div>
    <div className="prefs-card"><div className="prefs-title"><div><span className="prefs-badge"><Settings2 size={20}/></span><div><h3>Random matching</h3><p>Just like Monkey — tap start and say hi.</p></div></div><MoreHorizontal size={20}/></div><div className="prefs-body">{locationBox}<label className="field-label interest-label"><Sparkles size={16}/> Your tags</label><div className="chips">{(profile?.tags?.length ? profile.tags : ['Add tags in your profile']).map(t => <span key={t} className="chip chosen">{t}</span>)}</div><p className="field-hint">{isMobileDevice() ? 'You’ll be matched with other phone users.' : 'You’ll be matched with other computer users.'}</p></div></div></div>
    <div className="mode-and-start"><div className="mode-pick"><span className="mode-label">HOW WOULD YOU LIKE TO CONNECT?</span><div className="mode-options"><button className={mode==='video'?'active':''} onClick={() => setMode('video')}><Camera size={18}/> Video chat</button><button className={mode==='audio'?'active':''} onClick={() => setMode('audio')}><Mic size={18}/> Voice chat</button><button className={mode==='text'?'active':''} onClick={() => setMode('text')}><MessageCircle size={18}/> Text chat</button></div></div><button className="mobile-pref-button" onClick={() => setSheet(true)}><Settings2 size={17}/> My settings <ChevronDown size={15}/></button><div className="start-area"><button className="start-button" onClick={searching ? stop : start}>{searching ? <><span className="spinner"/> Looking for your person… <X size={19}/></> : <><span className="start-arrow"><ArrowRight size={20}/></span> Start matching <ArrowUpRight size={21}/></>}</button><span>{searching ? 'Connecting you automatically. Tap to cancel.' : 'No pressure. Your next conversation is one click away.'}</span></div></div></section>
    <section className="how-section"><div className="how-inner"><div className="how-heading"><span className="section-kicker">SIMPLE AS SAYING HELLO</span><h2>Good things happen<br/>when you <em>connect.</em></h2><p>Forget the endless scrolling. Here, it’s all about the moment and the person on the other side.</p></div><div className="how-cards"><article><div className="how-icon peach"><Settings2 size={28}/></div><span>01 / TAP START</span><h3>We find someone</h3><p>A random person, nearby first. No searching, no profiles to browse.</p></article><article><div className="how-icon mint"><Shuffle size={28}/></div><span>02 / CHAT OR NEXT</span><h3>Talk, or skip</h3><p>Chat and call live. Tap Next for a fresh person and a fresh chat.</p></article><article><div className="how-icon sky"><Heart size={28}/></div><span>03 / KEEP THE GOOD ONES</span><h3>Keep the connection</h3><p>If you both click Connect, you can message again later.</p></article></div></div></section>
    <section className="bottom-cta"><div><span className="section-kicker">THE WORLD IS WAITING</span><h2>One hello can change<br/><em>everything.</em></h2><p>Come as you are. Leave with a story.</p><button onClick={start}>Find your next conversation <ArrowUpRight size={19}/></button></div><img src={star} alt="Smiling coral clay star" loading="lazy" width={1024} height={1024}/></section>
     <button className="mobile-match-cta" onClick={searching ? stop : start}>{searching ? 'Cancel search' : 'Start matching'} {searching ? <X size={18}/> : <ArrowRight size={18}/>}</button>
     {sheet && <div className="sheet-backdrop" onClick={() => setSheet(false)}><div className="pref-sheet" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={() => setSheet(false)} aria-label="Close"><X/></button><h3>Your settings</h3><p>Location is set automatically.</p>{locationBox}<button className="full-primary" onClick={() => setSheet(false)}>Done <ArrowRight size={18}/></button></div></div>}
  </>;
}

function AuthModal({ onClose, notify }: { onClose: () => void; notify: (s: string) => void }) {
  const [signup, setSignup] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const v = authSchema.safeParse({ email, password }); if (!v.success) { notify('Enter a valid email and a password of at least 8 characters.'); return; } setBusy(true); const { error, data } = signup ? await supabase.auth.signUp(v.data) : await supabase.auth.signInWithPassword(v.data); setBusy(false); if (error) notify(error.message); else { if (signup && !data.session) notify('Check your email to confirm your account, then sign in.'); else onClose(); } };
  return <motion.div className="modal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}><motion.div className="auth-modal" initial={{y:30,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sign in"><button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button><span className="modal-ornament">✳</span><Brand/><h2>{signup ? 'Your story starts here.' : 'Welcome back, explorer.'}</h2><p>More world. More wonder. More wonderful people.</p><form onSubmit={submit}><label>Email address<input type="email" required maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} maxLength={128} autoComplete={signup?'new-password':'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label><button className="full-primary" disabled={busy}>{busy?'Please wait…':signup?'Create my account':'Sign in'} <ArrowRight size={18}/></button></form><div className="auth-divider">or</div><button className="google-button" onClick={async () => { const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options: { redirectTo: window.location.origin } }); if (error) notify(error.message); }}>Continue with Google <ArrowUpRight size={16}/></button><p className="auth-switch">{signup ? 'Already part of Jnoy?' : 'New to Jnoy?'} <button onClick={() => setSignup(!signup)}>{signup?'Sign in':'Create an account'}</button></p><small>By joining, you agree to be kind, stay safe and be 18 or older.</small></motion.div></motion.div>;
}

function CallRoom({ session, user, onClose, onNext, notify }: { session: Session; user: User; onClose: () => void; onNext: () => void; notify: (s: string) => void }) {
  const peerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id;
  const [partner, setPartner] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<'idle'|'pending'|'active'>('idle');
  const [messages, setMessages] = useState<Msg[]>([]); const [draft, setDraft] = useState(''); const [micOn, setMicOn] = useState(true); const [camOn, setCamOn] = useState(true); const [connected, setConnected] = useState(false); const [callState, setCallState] = useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [local, setLocal] = useState<MediaStream | null>(null); const [remote, setRemote] = useState<MediaStream | null>(null); const pcRef = useRef<RTCPeerConnection | null>(null); const signalId = useRef(''); const signalLastId = useRef(''); const chatEnd = useRef<HTMLDivElement>(null);
  const sendSignal = async (payload: Json) => { await supabase.from('call_signals').insert({ session_id: session.id, sender_id: user.id, recipient_id: peerId, payload }); };
  useEffect(() => {
    let alive = true; let pc: RTCPeerConnection | null = null; let stream: MediaStream | null = null;
    supabase.from('profiles').select('*').eq('id', peerId).single().then(({data}) => { if (alive) setPartner(data); });
    const load = () => supabase.from('session_messages').select('*').eq('session_id', session.id).order('created_at', {ascending:true}).limit(150).then(({data}) => { if (alive) setMessages(data||[]); }); load();
    const channel = supabase.channel(`room-${session.id}`).on('postgres_changes', {event:'INSERT', schema:'public',table:'session_messages',filter:`session_id=eq.${session.id}`}, () => void load()).on('postgres_changes', {event:'UPDATE',schema:'public',table:'conversation_sessions',filter:`id=eq.${session.id}`}, p => { if (['ended','failed','reported'].includes((p.new as Session).status)) { setCallState('disconnected'); setTimeout(onNext,1500); } }).subscribe();
    let timer: ReturnType<typeof setInterval> | undefined;
    let connectionTimer: ReturnType<typeof setTimeout> | undefined;
    let qualityTimer: ReturnType<typeof setInterval> | undefined;
    const pendingIce: RTCIceCandidateInit[] = [];
    let signalBusy = false;
    async function checkSignals() {
      if (signalBusy) return;
      signalBusy = true;
      try {
      const { data } = await supabase.from('call_signals').select('*').eq('session_id', session.id).eq('recipient_id', user.id).gte('created_at', signalId.current || '1970-01-01').order('created_at').order('id').limit(100);
      for (const row of data||[]) {
        if (row.id === signalLastId.current || (row.created_at === signalId.current && row.id <= signalLastId.current)) continue;
        signalId.current = row.created_at; signalLastId.current = row.id; const msg = row.payload as { type?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
        if (!pc) continue;
        try {
           if (msg.type === 'offer' && msg.sdp) { await pc.setRemoteDescription(msg.sdp); for (const ice of pendingIce.splice(0)) await pc.addIceCandidate(ice); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await sendSignal({type:'answer',sdp:answer as unknown as Json}); }
           if (msg.type === 'answer' && msg.sdp && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(msg.sdp); for (const ice of pendingIce.splice(0)) await pc.addIceCandidate(ice); }
           if (msg.type === 'ice' && msg.candidate) { if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate); else pendingIce.push(msg.candidate); }
        } catch (e) { console.warn('Connection negotiation failed', e); }
      }
      } finally { signalBusy = false; }
    }
    async function initialize() {
      if (session.mode === 'text') { setCallState('connected'); setConnected(true); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({video: session.mode==='video',audio:true}); if (!alive) { stream.getTracks().forEach(t=>t.stop()); return; } setLocal(stream);
        pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]}); pcRef.current = pc;
        stream.getTracks().forEach(t => pc!.addTrack(t,stream!));
        pc.ontrack = e => { setRemote(e.streams[0] ?? null); setConnected(true); setCallState('connected'); };
        pc.onicecandidate = e => { if (e.candidate) void sendSignal({type:'ice',candidate:e.candidate.toJSON() as Json}); };
        pc.onconnectionstatechange = () => { if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') setCallState('disconnected'); if (pc?.connectionState === 'connected') {setCallState('connected');setConnected(true);} };
        if (session.mode === 'video') qualityTimer = setInterval(async () => {
          if (!pc || pc.connectionState !== 'connected') return;
          const stats = await pc.getStats();
          let bitrate = 700_000;
          stats.forEach(report => { if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.availableOutgoingBitrate) bitrate = Math.max(120_000, Math.min(850_000, report.availableOutgoingBitrate * .65)); });
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (!sender) return;
          const parameters = sender.getParameters();
          if (!parameters.encodings?.length) parameters.encodings = [{}];
          if (parameters.encodings[0]) parameters.encodings[0].maxBitrate = bitrate;
          try { await sender.setParameters(parameters); } catch { /* Browser may not support bitrate control. */ }
        }, 6000);
        await checkSignals(); timer = setInterval(() => void checkSignals(), 1200);
        connectionTimer = setTimeout(() => { if (pc?.connectionState !== 'connected') setCallState('disconnected'); }, 25000);
        if (session.initiator_id === user.id) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await sendSignal({type:'offer',sdp:offer as unknown as Json}); }
      } catch { setCallState('disconnected'); notify('Camera or microphone permission is needed for this call. Check browser settings or try text chat.'); }
    }
    void initialize();
    return () => { alive=false; clearInterval(timer); clearInterval(qualityTimer); clearTimeout(connectionTimer); supabase.removeChannel(channel); pc?.close(); stream?.getTracks().forEach(t => t.stop()); pcRef.current=null; };
  }, [session.id]);
  useEffect(() => chatEnd.current?.scrollIntoView({behavior:'smooth'}), [messages.length]);
  const end = async (next=false) => { await supabase.rpc('session_transition',{_session:session.id,_to:'ended',_reason:next?'next':'left'}); next?onNext():onClose(); };
  const send = async (e: React.FormEvent) => { e.preventDefault(); const parsed=messageSchema.safeParse(draft); if (!parsed.success) { notify(parsed.error.issues[0]?.message || 'Invalid message'); return; } const {error}=await supabase.from('session_messages').insert({session_id:session.id,sender_id:user.id,body:parsed.data}); if (error) notify(error.message); else {setDraft(''); const {data}=await supabase.from('session_messages').select('*').eq('session_id',session.id).order('created_at');setMessages(data||[]);} };
  const report = async () => { const reason=window.prompt('What happened? (harassment, inappropriate content, spam, other)'); if (!reason) return; const {error}=await supabase.rpc('submit_report',{_block:true,_category:'other',_note:reason.slice(0,500),_reported:peerId,_session:session.id}); if (error) notify(error.message); else {notify('Reported and blocked. Thank you for helping keep Jnoy safe.'); await end();} };
  const saveConnection = async () => { const { data, error } = await supabase.rpc('set_mutual_connection_decision', { _session: session.id, _accept: true }); if (error) notify(error.message); else if (data === 'active' || data === 'pending') { setSaved(data); notify(data === 'active' ? 'You both connected! Find them in Messages.' : 'Saved! They’ll appear in Messages if you both choose to connect.'); } else notify('This connection is no longer available.'); };
  const toggleMic = () => {local?.getAudioTracks().forEach(t => t.enabled=!micOn);setMicOn(!micOn);}; const toggleCamera=()=>{local?.getVideoTracks().forEach(t=>t.enabled=!camOn);setCamOn(!camOn);};
  return <div className="call-page"><div className="call-top"><Brand light/><div className="call-status"><span className="live-dot"/> {callState === 'connecting' ? 'Connecting you…' : callState === 'disconnected' ? 'Connection lost' : 'Connected · Say hello!'}</div><button onClick={report} className="report-top"><Flag size={17}/> Report</button></div><div className="call-layout"><div className="call-main">{session.mode === 'text' ? <div className="text-call-art"><img src={world} alt="Colorful clay globe" width={1280} height={1024}/><h2>Say hello to {partner?.display_name || 'someone new'}.</h2><p>A great conversation can start with just a few words.</p></div> : <VideoStage stream={remote} label={remote ? partner?.display_name || 'New connection' : callState==='disconnected' ? 'Connection lost — try another match' : `Connecting to ${partner?.display_name || 'your match'}…`} remote offline={callState==='disconnected'}/>}<div className="call-overlay-info"><span>{partner?.display_name || 'New connection'}</span><small>{countryLabel(partner?.country_code)} · {session.mode} chat</small></div>{session.mode!=='text' && <div className="self-preview"><VideoStage stream={session.mode==='video' && camOn ? local : null} label="You"/></div>}<div className="call-controls">{session.mode !== 'text' && <><button aria-label={micOn?'Mute microphone':'Unmute microphone'} onClick={toggleMic}><span>{micOn?<Mic size={22}/>:<MicOff size={22}/>}</span>Mic</button>{session.mode==='video' && <button aria-label={camOn?'Turn camera off':'Turn camera on'} onClick={toggleCamera}><span>{camOn?<Camera size={22}/>:<CameraOff size={22}/>}</span>Camera</button>}</>}<button onClick={saveConnection} disabled={saved !== 'idle'}><span><Heart size={22}/></span>{saved === 'active' ? 'Connected' : saved === 'pending' ? 'Saved' : 'Connect'}</button><button onClick={report}><span><Flag size={22}/></span>Report</button><button onClick={() => end(true)} className="next-control"><span><Shuffle size={22}/></span>Next</button><button onClick={() => end()} className="end-control"><span><PhoneOff size={22}/></span>End</button></div></div><div className="call-chat"><div className="chat-title"><div><MessageCircle size={19}/><h3>Conversation</h3></div><span>LIVE CHAT</span></div><div className="chat-messages"><div className="chat-welcome"><Sparkles size={24}/><h4>It starts with hello.</h4><p>Be kind, stay curious. Never share personal contact details.</p></div>{messages.map(m => <div key={m.id} className={`bubble ${m.sender_id===user.id?'mine':''}`}><small>{m.sender_id===user.id?'You':partner?.display_name||'Match'}</small>{m.body}</div>)}<div ref={chatEnd}/></div><form className="chat-form" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Say something nice…" maxLength={2000} aria-label="Message"/><button aria-label="Send message"><Send size={18}/></button></form></div></div></div>;
}

const LANGUAGES = ['English','Hindi','Spanish','French','German','Portuguese','Arabic','Japanese'];
function ProfilePage({user,profile,prefs,detectedCountry,refresh,notify}:{user:User;profile:Profile|null;prefs:Prefs|null;detectedCountry:string|null;refresh:()=>Promise<void>;notify:(s:string)=>void}) {
  const [first,setFirst]=useState(''); const [last,setLast]=useState(''); const [gender,setGender]=useState(''); const [ageNum,setAgeNum]=useState(''); const [country,setCountry]=useState(''); const [language,setLanguage]=useState('English'); const [tags,setTags]=useState<string[]>([]); const [age,setAge]=useState(false); const [discoverable,setDiscoverable]=useState(true); const [busy,setBusy]=useState(false);
  useEffect(()=>{setFirst(profile?.first_name||'');setLast(profile?.last_name||'');setGender(profile?.gender||'');setAgeNum(profile?.age?String(profile.age):'');setCountry(profile?.country_code||detectedCountry||'');setTags(profile?.tags||[]);setLanguage(prefs?.languages?.[0]||'English');setDiscoverable(prefs?.discoverable??true)},[profile,prefs,detectedCountry]);
  const save=async()=>{
    const n=Number(ageNum);
    if(first.trim().length<1||last.trim().length<1){notify('Please enter your first and last name.');return;}
    if(!gender){notify('Please choose your gender.');return;}
    if(!Number.isInteger(n)||n<18||n>100){notify('You must be 18 or older to use Jnoy.');return;}
    if(!country){notify('Please choose your country.');return;}
    if(!profile?.onboarding_completed&&!age){notify('Confirm that you are at least 18 to continue.');return;}
    setBusy(true);
    await supabase.rpc('ensure_my_profile');
    const {error}=await supabase.from('profiles').update({first_name:first.trim().slice(0,30),last_name:last.trim().slice(0,30),display_name:first.trim().slice(0,40),gender,age:n,country_code:country,tags:tags.slice(0,12),onboarding_completed:true}).eq('id',user.id);
    if(error){notify(error.message);setBusy(false);return;}
    if(!profile?.onboarding_completed){await supabase.from('policy_acceptances').insert({user_id:user.id,policy_type:'age_18',policy_version:'1'});}
    const p=await supabase.from('user_preferences').update({discoverable,interests:tags,languages:[language],approximate_country:country}).eq('user_id',user.id);
    if(p.error)notify(p.error.message);else notify('Your profile is ready! Head to Discover to start matching.');
    await refresh();setBusy(false);
  };
  return <div className="interior-page"><div className="interior-header"><span className="section-kicker">{profile?.onboarding_completed?'A LITTLE ABOUT YOU':'STEP 1 · FINISH YOUR PROFILE'}</span><h1>Your corner of <em>Jnoy.</em></h1><p>All fields are required before you can start matching.</p></div><div className="profile-layout"><div className="surface profile-card"><div className="profile-avatar">{(first?.[0]||user.email?.[0]||'J').toUpperCase()}<span>✳</span></div><h2>{first?`${first} ${last}`:'Your story starts here'}</h2><p>{user.email}</p><div className="profile-facts"><span><Globe2 size={17}/>{countryLabel(country)}</span><span><MessageCircle size={17}/>{language}</span><span><ShieldCheck size={17}/>18+ community</span></div><div className="tag-row">{tags.map(t=><span key={t}>✳ {t}</span>)}</div></div><div className="surface edit-card"><h2>Make it yours</h2><div className="two-col"><label>First name<input value={first} maxLength={30} onChange={e=>setFirst(e.target.value)} placeholder="First name"/></label><label>Last name<input value={last} maxLength={30} onChange={e=>setLast(e.target.value)} placeholder="Last name"/></label></div><div className="two-col"><label>Gender<select value={gender} onChange={e=>setGender(e.target.value)}><option value="">Choose</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label><label>Age<input type="number" min={18} max={100} value={ageNum} onChange={e=>setAgeNum(e.target.value)} placeholder="18+"/></label></div><label>Country <small>{detectedCountry?'Detected automatically':''}</small><select value={country} onChange={e=>setCountry(e.target.value)}><option value="">Choose your country</option>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}</select></label><label>Language<select value={language} onChange={e=>setLanguage(e.target.value)}>{LANGUAGES.map(l=><option key={l}>{l}</option>)}</select></label><label>Your tags <small>Helps us pair you with like-minded people</small></label><div className="chips">{INTERESTS.map(t=><button key={t} className={`chip ${tags.includes(t)?'chosen':''}`} onClick={()=>setTags(tags.includes(t)?tags.filter(x=>x!==t):[...tags,t])}>{t}</button>)}</div><label className="check-row"><input type="checkbox" checked={discoverable} onChange={e=>setDiscoverable(e.target.checked)}/> Let others match with me</label>{!profile?.onboarding_completed&&<label className="check-row"><input type="checkbox" checked={age} onChange={e=>setAge(e.target.checked)}/> I confirm I am 18 or older</label>}<button className="full-primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save my profile'}<ArrowRight size={17}/></button><button className="subtle-action" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></div></div>;
}

function Messages({user,notify}:{user:User;notify:(s:string)=>void}) {
  const [connections,setConnections]=useState<Database['public']['Tables']['mutual_connections']['Row'][]>([]);const [selected,setSelected]=useState<string|null>(null);const [partner,setPartner]=useState<Profile|null>(null);const [messages,setMessages]=useState<Database['public']['Tables']['direct_messages']['Row'][]>([]);const [draft,setDraft]=useState('');
  useEffect(()=>{supabase.from('mutual_connections').select('*').eq('status','active').or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`).then(({data})=>setConnections(data||[]))},[user.id]);
  useEffect(()=>{const c=connections.find(x=>x.id===selected);if(!c)return;const other=c.user_a_id===user.id?c.user_b_id:c.user_a_id;supabase.from('profiles').select('*').eq('id',other).single().then(({data})=>setPartner(data));const load=()=>supabase.from('direct_messages').select('*').eq('connection_id',c.id).order('created_at').then(({data})=>setMessages(data||[]));load();const channel=supabase.channel('direct-'+c.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:`connection_id=eq.${c.id}`},()=>void load()).subscribe();return()=>{supabase.removeChannel(channel)}},[selected,connections,user.id]);
  const send=async(e:React.FormEvent)=>{e.preventDefault();const result=messageSchema.safeParse(draft);if(!result.success){notify(result.error.issues[0]?.message||'Invalid message');return}const {error}=await supabase.from('direct_messages').insert({connection_id:selected!,sender_id:user.id,body:result.data});if(error)notify(error.message);else{setDraft('');const {data}=await supabase.from('direct_messages').select('*').eq('connection_id',selected!).order('created_at');setMessages(data||[])}};
  return <div className="interior-page"><div className="interior-header"><span className="section-kicker">KEEP THE CONVERSATION GOING</span><h1>The people you <em>clicked with.</em></h1><p>Only mutual connections appear here. No searching strangers.</p></div><div className="messages-layout surface"><div className="connection-list"><h3>Connections <span>{connections.length}</span></h3>{connections.length?connections.map(c=><button key={c.id} className={selected===c.id?'active':''} onClick={()=>setSelected(c.id)}><span className="connection-avatar"><Heart size={18}/></span><span>Connection <small>{new Date(c.created_at).toLocaleDateString()}</small></span><ArrowRight size={16}/></button>):<div className="empty-connections"><img src={star} alt="Friendly clay star" loading="lazy" width={1024} height={1024}/><h4>Good things take a hello.</h4><p>When you both choose to stay connected after a chat, you’ll find each other here.</p></div>}</div><div className="message-panel">{selected?<><div className="message-panel-head"><span className="connection-avatar">{partner?.display_name?.[0]||'J'}</span><div><h3>{partner?.display_name||'Connection'}</h3><small>{countryLabel(partner?.country_code)}</small></div></div><div className="direct-bubbles">{messages.map(m=><div key={m.id} className={`bubble ${m.sender_id===user.id?'mine':''}`}>{m.body}</div>)}</div><form className="chat-form" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} placeholder="Write a message…"/><button aria-label="Send"><Send size={18}/></button></form></>:<div className="message-empty"><MessageCircle size={36}/><h3>Your next chapter starts with a hello.</h3><p>Select a connection to pick up where you left off.</p></div>}</div></div></div>;
}

function AdminPage({notify}:{notify:(s:string)=>void}) {
  const [metrics,setMetrics]=useState<Json|null>(null);const [reports,setReports]=useState<Database['public']['Tables']['reports']['Row'][]>([]);const [users,setUsers]=useState<Database['public']['Functions']['admin_list_users']['Returns']>([]);const [tab,setTab]=useState<'overview'|'reports'|'users'|'activity'>('overview');
  const [visits,setVisits]=useState<Database['public']['Tables']['login_visits']['Row'][]>([]);
  const load=async()=>{const [m,r,u,v]=await Promise.all([supabase.rpc('admin_metrics'),supabase.from('reports').select('*').order('created_at',{ascending:false}).limit(50),supabase.rpc('admin_list_users',{_q:''}),supabase.from('login_visits').select('*').order('started_at',{ascending:false}).limit(100)]);setMetrics(m.data);setReports(r.data||[]);setUsers(u.data||[]);setVisits(v.data||[])};
  useEffect(()=>{void load()},[]);
  const moderate=async(id:string,action:string,report?:string)=>{const reason=window.prompt(`Reason for ${action}?`);if(!reason)return;const {error}=await supabase.rpc('moderate_user',{_target:id,_action:action,_reason:reason.slice(0,500),...(report?{_report:report}:{})});if(error)notify(error.message);else{notify('Moderation action recorded.');void load()}};
  return <div className="interior-page admin-page"><div className="interior-header"><span className="section-kicker">COMMUNITY CARE</span><h1>Admin <em>workspace.</em></h1><p>Keep Jnoy welcoming, safe and accountable.</p></div><div className="admin-tabs">{(['overview','reports','users','activity'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>{tab==='activity'?<div className="surface admin-table"><h2>Recent sign-in activity</h2><p>Country is inferred from the hosting network when available; session length is approximate.</p>{visits.map(v=><div className="admin-row" key={v.id}><div><strong>Member {v.user_id.slice(0,8)}</strong><span>{v.country_code ? countryLabel(v.country_code) : 'Country unavailable'} · {new Date(v.started_at).toLocaleString()}</span><small>Last active {new Date(v.last_seen_at).toLocaleString()} · {v.ended_at ? `${Math.max(0,Math.round((new Date(v.ended_at).getTime()-new Date(v.started_at).getTime())/60000))} min` : 'Session not closed'}</small></div></div>)}</div>:tab==='overview'?<div className="metric-grid">{Object.entries(metrics&&typeof metrics==='object'&&!Array.isArray(metrics)?metrics:{}).map(([k,v])=><div className="surface metric" key={k}><span>{k.replaceAll('_',' ')}</span><strong>{typeof v==='number'||typeof v==='string'?v:'—'}</strong></div>)}</div>:tab==='reports'?<div className="surface admin-table"><h2>Recent reports</h2>{reports.length?reports.map(r=><div className="admin-row" key={r.id}><div><strong>{r.category}</strong><span>{r.status} · {new Date(r.created_at).toLocaleString()}</span><small>{r.note||'No note'} · User {r.reported_user_id.slice(0,8)}</small></div><div><button onClick={()=>moderate(r.reported_user_id,'warn',r.id)}>Warn</button><button onClick={()=>moderate(r.reported_user_id,'ban',r.id)}>Ban</button></div></div>):<p>No reports yet.</p>}</div>:<div className="surface admin-table"><h2>Community members</h2>{users.map(u=><div className="admin-row" key={u.id}><div><strong>{u.display_name||'Unnamed member'}</strong><span>{countryLabel(u.country_code)} · Joined {new Date(u.created_at).toLocaleDateString()}</span><small>{u.is_banned?'Restricted · ':''}{u.report_count} reports · {u.block_count} blocks</small></div><div><button onClick={()=>moderate(u.id,u.is_banned?'unban':'ban')}>{u.is_banned?'Unban':'Ban'}</button></div></div>)}</div>}</div>;
}