import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Camera, Globe2, MessageCircle, Mic, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Wifi, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VideoStage } from './VideoStage';
import { CountryPicker } from './CountryPicker';
import { Brand } from './Brand';
import { LANGUAGES, countryFlag, countryLabel, type Mode, type Prefs, type Profile, type Session } from '@/lib/jnoy';
import { isMobileDevice } from '@/lib/device';
import clayCamera from '@/assets/clay-camera.webp';
import clayChat from '@/assets/clay-chat.webp';
import clayMic from '@/assets/clay-mic.webp';

type CamState = 'idle' | 'requesting' | 'denied' | 'ready';

export function MatchStage({ user, profile, prefs, autoStart, onAutoStarted, onSession, notify, onNeedProfile, onMessages, refresh }: { user: User; profile: Profile; prefs: Prefs | null; autoStart: boolean; onAutoStarted: () => void; onSession: (s: Session) => void; notify: (s: string) => void; onNeedProfile: () => void; onMessages: () => void; refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>((prefs?.default_mode as Mode) || 'video');
  const [searching, setSearching] = useState(false);
  const [waited, setWaited] = useState(0);
  const [cam, setCam] = useState<CamState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [countries, setCountries] = useState<string[]>(prefs?.preferred_countries || []);
  const [language, setLanguage] = useState(prefs?.languages?.[0] || 'English');
  const [similar, setSimilar] = useState(prefs?.similar_interests ?? true);
  const [broaden, setBroaden] = useState(prefs?.broaden_after_wait ?? true);
  const searchRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  void user;

  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => () => { searchRef.current = false; streamRef.current?.getTracks().forEach(t => t.stop()); }, []);
  // Never request media on load. Only release media when switching to text.
  useEffect(() => { if (mode === 'text') { streamRef.current?.getTracks().forEach(t => t.stop()); setStream(null); setCam('idle'); } }, [mode]);

  async function requestMedia() {
    if (mode === 'text') return true;
    if (!navigator.mediaDevices?.getUserMedia) { setCam('denied'); return false; }
    setCam('requesting');
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({ video: mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: { echoCancellation: true, noiseSuppression: true } });
      setStream(s); setCam('ready'); return true;
    } catch { setCam('denied'); return false; }
  }

  const savePrefs = async () => {
    const { error } = await supabase.from('user_preferences').update({ preferred_countries: countries, languages: [language], similar_interests: similar, broaden_after_wait: broaden, default_mode: mode }).eq('user_id', profile.id);
    if (error) notify(error.message); else { notify('Match filters saved.'); setFiltersOpen(false); void refresh(); }
  };

  const stop = async () => { searchRef.current = false; setSearching(false); setWaited(0); await supabase.rpc('leave_match_queue'); };

  const start = async () => {
    if (searchRef.current) return;
    if (!profile.onboarding_completed) { notify('Finish your profile first — it takes a few seconds.'); onNeedProfile(); return; }
    if (mode !== 'text' && cam !== 'ready' && !(await requestMedia())) { notify(mode === 'video' ? 'Allow camera and microphone to start a video chat, or pick Text.' : 'Allow microphone to start a voice chat, or pick Text.'); return; }
    const snapshot = { interests: similar ? profile.tags || [] : [], languages: [language], countries, strict: !broaden, device: isMobileDevice() ? 'mobile' : 'desktop' };
    const { error } = await supabase.rpc('join_match_queue', { _mode: mode, _snapshot: snapshot });
    if (error) { notify(error.message); return; }
    searchRef.current = true; setSearching(true); setWaited(0);
    const began = Date.now();
    const poll = async () => {
      if (!searchRef.current) return;
      setWaited(Math.round((Date.now() - began) / 1000));
      const { data, error: e } = await supabase.rpc('find_or_create_match');
      if (!searchRef.current) return;
      if (e) { notify(e.message); void stop(); return; }
      const r = data as { status?: string; session_id?: string } | null;
      if (r?.status === 'matched' && r.session_id) {
        const { data: s } = await supabase.from('conversation_sessions').select('*').eq('id', r.session_id).single();
        if (s && searchRef.current) { searchRef.current = false; setSearching(false); streamRef.current?.getTracks().forEach(t => t.stop()); setStream(null); onSession(s); return; }
      }
      if (r?.status === 'idle') await supabase.rpc('join_match_queue', { _mode: mode, _snapshot: snapshot });
      setTimeout(poll, 1500);
    };
    void poll();
  };
  useEffect(() => { if (autoStart) { onAutoStarted(); void start(); } }, [autoStart]);

  const home = countries.length ? countries.map(c => countryFlag(c)).join(' ') : `${countryFlag(profile.country_code)} ${countryLabel(profile.country_code)}`;
  const scope = !broaden && countries.length
    ? (waited > 30 ? 'Nobody from your chosen countries is online right now. Try again later or allow widening.' : `Only looking in ${home}…`)
    : waited < 12 ? `Looking in ${home}…` : waited > 60 ? 'Few people online right now — still looking worldwide 🌍' : 'Widening to the whole world 🌍';
  const status = searching ? 'Searching' : mode === 'text' ? 'Text mode ready' : cam === 'ready' ? 'Camera ready' : 'Camera off';

  return <div className="jn-stage">
    <div className="jn-stage-top"><Brand/><span className={`jn-status ${searching ? 'live' : ''}`}><span className="live-dot"/> {status}</span></div>
    <div className="jn-stage-main">
      <div className="jn-video-big">
        {mode === 'text' ? <Empty img={clayChat} title="Words make worlds." text="Text-only mode — no camera needed."/>
          : cam === 'ready' && stream && mode === 'video' ? <VideoStage stream={stream} label="Your camera · only you see this"/>
          : cam === 'ready' && mode === 'audio' ? <Empty img={clayMic} title="Microphone ready" text="Voice-only chat. Your camera stays off."/>
          : cam === 'denied' ? <Empty img={mode === 'audio' ? clayMic : clayCamera} title="Access was blocked" text="Allow camera & microphone from the lock icon in your address bar, or switch to Text.">
              <div className="jn-row"><button className="preview-activate" onClick={() => void requestMedia()}>Try again</button><button className="preview-activate" onClick={() => setMode('text')}>Use text chat</button></div></Empty>
          : <Empty img={mode === 'audio' ? clayMic : clayCamera} title={cam === 'requesting' ? 'Waiting for permission…' : mode === 'audio' ? 'Microphone is off' : 'Camera is off'} text="Nothing is shared until you connect.">
              {cam !== 'requesting' && <button className="preview-activate" onClick={() => void requestMedia()}><Camera size={16}/> Enable {mode === 'audio' ? 'microphone' : 'camera & mic'}</button>}</Empty>}
        {searching && <div className="search-overlay"><div className="search-rings"><span/><span/><span/><Globe2 size={34}/></div><h3>Finding someone for you…</h3><p>{scope}</p><small className="jn-wait">{waited}s</small></div>}
      </div>
      <div className="jn-stage-bar">
        <div className="mode-options" role="radiogroup" aria-label="Chat mode">
          {([['video', Camera, 'Video'], ['audio', Mic, 'Voice'], ['text', MessageCircle, 'Text']] as const).map(([m, Icon, l]) =>
            <button key={m} role="radio" aria-checked={mode === m} disabled={searching} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}><Icon size={18}/> {l}</button>)}
        </div>
        <div className="jn-start-row">
          <button className="jn-filter-btn" onClick={() => setFiltersOpen(true)} disabled={searching} aria-label="Match filters"><SlidersHorizontal size={18}/>{countries.length > 0 && <b>{countries.length}</b>}</button>
          <button className={`start-button jn-start ${searching ? 'jn-cancel' : ''}`} onClick={searching ? () => void stop() : () => void start()}>
            {searching ? <><span className="spinner"/> Cancel search <X size={19}/></> : <>Start matching <ArrowRight size={20}/></>}
          </button>
        </div>
        {!profile.onboarding_completed && <button className="jn-profile-nudge" onClick={onNeedProfile}><UserRound size={15}/> Finish your profile to start matching</button>}
      </div>
    </div>
    <aside className="jn-chat-panel">
       <div className="chat-title"><button className="jn-messages-link" onClick={onMessages} title="Open messages"><MessageCircle size={19}/><span>Messages</span><ArrowRight size={15}/></button><span>{searching ? 'SEARCHING' : 'WAITING'}</span></div>
      <div className="chat-messages"><div className="chat-welcome"><Sparkles size={24}/><h4>Chat opens when you connect.</h4><p>Each match starts a fresh, private chat. Never share phone numbers or social handles.</p></div>
        <ul className="jn-tips"><li><ShieldCheck size={15}/> Report instantly if anything feels wrong</li><li><Wifi size={15}/> Video adjusts to slow internet</li><li><Globe2 size={15}/> Nearby first, then the whole world</li></ul>
      </div>
    </aside>
    {filtersOpen && <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
      <div className="auth-modal jn-filters" role="dialog" aria-modal="true" aria-label="Match filters" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setFiltersOpen(false)} aria-label="Close"><X size={20}/></button>
        <h2>Who to meet</h2><p>Matching stays random — these just set priorities.</p>
        <h3 className="jn-sub">Countries</h3>
        <CountryPicker value={countries} onChange={setCountries}/>
        {profile.detected_country && <small className="jn-muted"><Globe2 size={12}/> Network suggestion (approximate): {countryFlag(profile.detected_country)} {countryLabel(profile.detected_country)} — not saved unless you pick it.</small>}
        <h3 className="jn-sub">If nobody is available</h3>
        <div className="jn-seg jn-seg-wide">
          <button type="button" className={broaden ? 'on' : ''} onClick={() => setBroaden(true)}>Widen after a short wait</button>
          <button type="button" className={!broaden ? 'on' : ''} onClick={() => setBroaden(false)}>Only my picks (strict)</button>
        </div>
        <div className="two-col">
          <label>Language<select value={language} onChange={e => setLanguage(e.target.value)}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></label>
          <label>Interests<div className="jn-seg"><button type="button" className={similar ? 'on' : ''} onClick={() => setSimilar(true)}>Similar first</button><button type="button" className={!similar ? 'on' : ''} onClick={() => setSimilar(false)}>Any</button></div></label>
        </div>
        <button className="full-primary" onClick={() => void savePrefs()}>Save filters <ArrowRight size={17}/></button>
      </div>
    </div>}
  </div>;
}

function Empty({ img, title, text, children }: { img: string; title: string; text: string; children?: React.ReactNode }) {
  return <div className="jn-stage-empty"><img src={img} alt="" width={96} height={96} className="jn-clay-icon"/><h3>{title}</h3><p>{text}</p>{children}</div>;
}
