import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, BellRing, Camera, Globe2, MessageCircle, Mic, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Wifi, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VideoStage } from './VideoStage';
import { CountryPicker } from './CountryPicker';
import { Brand } from './Brand';
import { LANGUAGES, countryFlag, countryLabel, type Mode, type Prefs, type Profile, type Session } from '@/lib/jnoy';
import { searchStore } from '@/lib/search';
import { isMobileDevice } from '@/lib/device';
import clayCamera from '@/assets/clay-camera.webp';
import clayChat from '@/assets/clay-chat.webp';
import clayMic from '@/assets/clay-mic.webp';

type CamState = 'idle' | 'requesting' | 'denied' | 'ready';

export function MatchStage({ user, profile, prefs, autoStart, onAutoStarted, onSession, notify, onNeedProfile, onMessages, refresh }: { user: User; profile: Profile; prefs: Prefs | null; autoStart: boolean; onAutoStarted: () => void; onSession: (s: Session) => void; notify: (s: string) => void; onNeedProfile: () => void; onMessages: () => void; refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>((prefs?.default_mode as Mode) || 'video');
  const [cam, setCam] = useState<CamState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [countries, setCountries] = useState<string[]>(prefs?.preferred_countries || []);
  const [language, setLanguage] = useState(prefs?.languages?.[0] || 'English');
  const [similar, setSimilar] = useState(prefs?.similar_interests ?? true);
  const [broaden, setBroaden] = useState(prefs?.broaden_after_wait ?? true);
  const [autoNext, setAutoNext] = useState(prefs?.auto_next ?? true);
  const [, tick] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  void user;

  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);
  // Never request media on load. Only release media when switching to text.
  useEffect(() => { if (mode === 'text') { streamRef.current?.getTracks().forEach(t => t.stop()); setStream(null); setCam('idle'); } }, [mode]);

  // Adopt a search that was started earlier (this visit or after a reload).
  useEffect(() => { void searchStore.resume(profile.id); }, [profile.id]);
  const searching = useSyncExternalStore(searchStore.subscribe, () => searchStore.searching);
  const waited = useSyncExternalStore(searchStore.subscribe, () => searchStore.waited);

  // Keep the wait counter ticking while a search is live.
  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => tick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [searching]);

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
    const { error } = await supabase.from('user_preferences').update({ preferred_countries: countries, languages: [language], similar_interests: similar, broaden_after_wait: broaden, auto_next: autoNext, default_mode: mode }).eq('user_id', profile.id);
    if (error) notify(error.message); else { notify('Match filters saved.'); setFiltersOpen(false); void refresh(); }
  };

  const stop = () => { searchStore.stop(); };

  const start = async () => {
    if (searchStore.searching) return;
    if (!profile.onboarding_completed) { notify('Finish your profile first — it takes a few seconds.'); onNeedProfile(); return; }
    if (mode !== 'text' && cam !== 'ready' && !(await requestMedia())) { notify(mode === 'video' ? 'Allow camera and microphone to start a video chat, or pick Text.' : 'Allow microphone to start a voice chat, or pick Text.'); return; }
    const snapshot = { interests: similar ? profile.tags || [] : [], languages: [language], countries, strict: !broaden, device: isMobileDevice() ? 'mobile' : 'desktop' };
    searchStore.start({ mode, snapshot });
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
        {!searching && (mode === 'text' ? <Empty img={clayChat} title="Words make worlds." text="Text-only mode — no camera needed."/>
          : cam === 'ready' && stream && mode === 'video' ? <VideoStage stream={stream} label="Your camera · only you see this"/>
          : cam === 'ready' && mode === 'audio' ? <Empty img={clayMic} title="Microphone ready" text="Voice-only chat. Your camera stays off."/>
          : cam === 'denied' ? <Empty img={mode === 'audio' ? clayMic : clayCamera} title="Access was blocked" text="Allow camera & microphone from the lock icon in your address bar, or switch to Text.">
              <div className="jn-row"><button className="preview-activate" onClick={() => void requestMedia()}>Try again</button><button className="preview-activate" onClick={() => setMode('text')}>Use text chat</button></div></Empty>
          : <Empty img={mode === 'audio' ? clayMic : clayCamera} title={cam === 'requesting' ? 'Waiting for permission…' : mode === 'audio' ? 'Microphone is off' : 'Camera is off'} text="Nothing is shared until you connect.">
              {cam !== 'requesting' && <button className="preview-activate" onClick={() => void requestMedia()}><Camera size={16}/> Enable {mode === 'audio' ? 'microphone' : 'camera & mic'}</button>}</Empty>)}
        {searching && <div className="search-overlay"><div className="search-rings"><span/><span/><span/><Globe2 size={34}/></div><h3>Finding someone for you…</h3><p>{scope}</p><small className="jn-wait">{waited}s</small></div>}
      </div>
      <div className="jn-stage-bar">
        <div className="mode-options" role="radiogroup" aria-label="Chat mode">
          {([['video', Camera, 'Video'], ['audio', Mic, 'Voice'], ['text', MessageCircle, 'Text']] as const).map(([m, Icon, l]) =>
            <button key={m} role="radio" aria-checked={mode === m} disabled={searching} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}><Icon size={18}/> {l}</button>)}
        </div>
        <div className="jn-start-row">
          <button className="jn-filter-btn" onClick={() => setFiltersOpen(true)} aria-label="Match filters"><SlidersHorizontal size={18}/>{countries.length > 0 && <b>{countries.length}</b>}</button>
          <button className={`start-button jn-start ${searching ? 'jn-cancel' : ''}`} onClick={searching ? stop : () => void start()}>
            {searching ? <><span className="spinner"/> Cancel search <X size={19}/></> : <>Start matching <ArrowRight size={20}/></>}
          </button>
        </div>
        {!profile.onboarding_completed && <button className="jn-profile-nudge" onClick={onNeedProfile}><UserRound size={15}/> Finish your profile to start matching</button>}
      </div>
    </div>
    <aside className="jn-chat-panel">
       <div className="chat-title"><button className="jn-messages-link" onClick={onMessages} title="Open messages"><MessageCircle size={19}/><span>Messages</span><ArrowRight size={15}/></button><span>{searching ? 'SEARCHING' : 'WAITING'}</span></div>
      <div className="chat-messages"><div className="chat-welcome"><Sparkles size={24}/><h4>Chat opens when you connect.</h4><p>Each match starts a fresh, private chat. Never share phone numbers or social handles.</p></div>
        {searching && <div className="jn-mini-wait"><span className="live-dot"/> Searching in the background — {waited}s. You can open Messages or Profile; we keep looking.</div>}
        <ul className="jn-tips"><li><ShieldCheck size={15}/> Report instantly if anything feels wrong</li><li><Wifi size={15}/> Video adjusts to slow internet</li><li><Globe2 size={15}/> Nearby first, then the whole world</li></ul>
      </div>
    </aside>
    {filtersOpen && <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
      <div className="auth-modal jn-filters" role="dialog" aria-modal="true" aria-label="Match filters" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setFiltersOpen(false)} aria-label="Close"><X size={20}/></button>
        <h2>Who to meet</h2><p>Matching stays random — these just set priorities.</p>
        <section className="jn-filter-sec">
          <h3 className="jn-sub"><Globe2 size={14}/> Countries</h3>
          <CountryPicker value={countries} onChange={setCountries}/>
          {profile.detected_country && <small className="jn-muted"><Globe2 size={12}/> Network suggestion (approximate): {countryFlag(profile.detected_country)} {countryLabel(profile.detected_country)} — not saved unless you pick it.</small>}
          <div className="jn-switch-row">
            <div><h4>Widen when nobody is online</h4><p>After a short wait, meet people from anywhere. Off keeps you strictly to your picks.</p></div>
            <button type="button" role="switch" aria-checked={broaden} aria-label="Widen when nobody is online" className={`jn-switch ${broaden ? 'on' : ''}`} onClick={() => setBroaden(!broaden)}><span/></button>
          </div>
        </section>
        <section className="jn-filter-sec">
          <h3 className="jn-sub"><Sparkles size={14}/> How you talk</h3>
          <div className="two-col">
            <label>Language<select value={language} onChange={e => setLanguage(e.target.value)}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></label>
            <label>Interests<div className="jn-seg"><button type="button" className={similar ? 'on' : ''} onClick={() => setSimilar(true)}>Similar first</button><button type="button" className={!similar ? 'on' : ''} onClick={() => setSimilar(false)}>Any</button></div></label>
          </div>
        </section>
        <section className="jn-filter-sec jn-filter-auto">
          <h3 className="jn-sub"><BellRing size={14}/> Next match</h3>
          <div className="jn-switch-row">
            <div><h4>Keep matching automatically</h4><p>When your partner taps Next or leaves, we immediately look for the next person for you.</p></div>
            <button type="button" role="switch" aria-checked={autoNext} aria-label="Keep matching automatically" className={`jn-switch ${autoNext ? 'on' : ''}`} onClick={() => setAutoNext(!autoNext)}><span/></button>
          </div>
        </section>
        <button className="full-primary" onClick={() => void savePrefs()}>Save filters <ArrowRight size={17}/></button>
      </div>
    </div>}
  </div>;
}

function Empty({ img, title, text, children }: { img: string; title: string; text: string; children?: React.ReactNode }) {
  return <div className="jn-stage-empty"><img src={img} alt="" width={96} height={96} className="jn-clay-icon"/><h3>{title}</h3><p>{text}</p>{children}</div>;
}
