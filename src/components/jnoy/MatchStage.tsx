import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, Camera, CameraOff, Globe2, MessageCircle, Mic, ShieldCheck, Sparkles, Wifi, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VideoStage } from './VideoStage';
import { countryFlag, countryLabel, type Mode, type Prefs, type Profile, type Session } from '@/lib/jnoy';
import { isMobileDevice } from '@/lib/device';

type CamState = 'idle' | 'requesting' | 'denied' | 'ready';

export function MatchStage({ user, profile, prefs, autoStart, onAutoStarted, onSession, notify }: { user: User; profile: Profile; prefs: Prefs | null; autoStart: boolean; onAutoStarted: () => void; onSession: (s: Session) => void; notify: (s: string) => void }) {
  const [mode, setMode] = useState<Mode>((prefs?.default_mode as Mode) || 'video');
  const [searching, setSearching] = useState(false);
  const [waited, setWaited] = useState(0);
  const [cam, setCam] = useState<CamState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const searchRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const language = prefs?.languages?.[0] || 'English';

  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => () => { searchRef.current = false; streamRef.current?.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => { if (mode === 'text') { stream?.getTracks().forEach(t => t.stop()); setStream(null); setCam('idle'); } else if (!stream && cam !== 'denied') void requestMedia(); }, [mode]);

  async function requestMedia() {
    if (mode === 'text') return true;
    if (!navigator.mediaDevices?.getUserMedia) { setCam('denied'); return false; }
    setCam('requesting');
    try {
      stream?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({ video: mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: { echoCancellation: true, noiseSuppression: true } });
      setStream(s); setCam('ready'); return true;
    } catch { setCam('denied'); return false; }
  }

  const stop = async () => { searchRef.current = false; setSearching(false); setWaited(0); await supabase.rpc('leave_match_queue'); };

  const start = async () => {
    if (searchRef.current) return;
    if (mode !== 'text' && cam !== 'ready' && !(await requestMedia())) { notify(mode === 'video' ? 'Allow camera and microphone to start a video chat, or pick Text.' : 'Allow microphone to start a voice chat, or pick Text.'); return; }
    // Release preview; the call room opens its own stream.
    const snapshot = { interests: profile.tags || [], languages: [language], device: isMobileDevice() ? 'mobile' : 'desktop' };
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

  const scope = waited < 12 ? `Looking in ${countryFlag(profile.country_code)} ${countryLabel(profile.country_code)}…` : 'Widening to the whole world 🌍';

  return <div className="jn-stage">
    <div className="jn-stage-main">
      <div className="jn-video-big">
        {mode === 'text' ? <div className="jn-stage-empty"><div className="placeholder-orb"><MessageCircle size={40}/></div><h3>Words make worlds.</h3><p>Text-only mode — no camera needed.</p></div>
          : cam === 'ready' && stream && mode === 'video' ? <VideoStage stream={stream} label="Your camera · only you see this"/>
          : cam === 'ready' && mode === 'audio' ? <div className="jn-stage-empty"><div className="placeholder-orb"><Mic size={40}/></div><h3>Microphone ready</h3><p>Voice-only chat. Your camera stays off.</p></div>
          : cam === 'denied' ? <div className="jn-stage-empty"><div className="placeholder-orb jn-orb-coral"><CameraOff size={40}/></div><h3>Camera or mic blocked</h3><p>Click the lock icon in your address bar, allow camera &amp; microphone, then try again.</p><div className="jn-row"><button className="preview-activate" onClick={() => void requestMedia()}>Try again</button><button className="preview-activate" onClick={() => setMode('text')}>Use text chat</button></div></div>
          : <div className="jn-stage-empty"><div className="placeholder-orb"><Camera size={40}/></div><h3>{cam === 'requesting' ? 'Asking for permission…' : 'Turn on your camera'}</h3><p>Your browser will ask to use your camera and microphone.</p>{cam !== 'requesting' && <button className="preview-activate" onClick={() => void requestMedia()}><Camera size={16}/> Allow camera &amp; mic</button>}</div>}
        {searching && <div className="search-overlay"><div className="search-rings"><span/><span/><span/><Globe2 size={34}/></div><h3>Finding someone for you…</h3><p>{scope}</p><small className="jn-wait">{waited}s</small></div>}
        <div className="preview-corner"><span className="live-dot"/> {searching ? 'SEARCHING' : mode === 'text' ? 'TEXT MODE' : cam === 'ready' ? 'READY' : 'NOT READY'}</div>
      </div>
      <div className="jn-stage-bar">
        <div className="mode-options" role="radiogroup" aria-label="Chat mode">
          <button disabled={searching} className={mode === 'video' ? 'active' : ''} onClick={() => setMode('video')}><Camera size={18}/> Video</button>
          <button disabled={searching} className={mode === 'audio' ? 'active' : ''} onClick={() => setMode('audio')}><Mic size={18}/> Voice</button>
          <button disabled={searching} className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}><MessageCircle size={18}/> Text</button>
        </div>
        <button className={`start-button jn-start ${searching ? 'jn-cancel' : ''}`} onClick={searching ? () => void stop() : () => void start()}>
          {searching ? <><span className="spinner"/> Cancel search <X size={19}/></> : <>Start matching <ArrowRight size={20}/></>}
        </button>
      </div>
    </div>
    <aside className="jn-chat-panel">
      <div className="chat-title"><div><MessageCircle size={19}/><h3>Chat</h3></div><span>{searching ? 'SEARCHING' : 'WAITING'}</span></div>
      <div className="chat-messages"><div className="chat-welcome"><Sparkles size={24}/><h4>Chat opens when you connect.</h4><p>Each new match starts a fresh, private chat. Be kind and never share phone numbers or social handles.</p></div>
        <ul className="jn-tips"><li><ShieldCheck size={15}/> Report instantly if anything feels wrong</li><li><Wifi size={15}/> Video quality adjusts to slow internet</li><li><Globe2 size={15}/> Nearby first, then the whole world</li></ul>
      </div>
      <div className="chat-form jn-disabled"><input disabled placeholder="Connect to start chatting…" aria-label="Message"/></div>
    </aside>
  </div>;
}
