import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Camera, CameraOff, Flag, Heart, MessageCircle, Mic, MicOff, PhoneOff, Send, Shuffle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { VideoStage } from './VideoStage';
import { ReportDialog } from './ReportDialog';
import { Brand } from './Brand';
import { countryFlag, countryLabel, messageSchema, type Msg, type Profile, type Session } from '@/lib/jnoy';
import world from '@/assets/jnoy-world.jpg';

type CallState = 'connecting' | 'connected' | 'disconnected';
type PublicPartner = Pick<Profile, 'id' | 'display_name' | 'country_code' | 'avatar_url' | 'tags'>;

async function captureFrame(): Promise<Blob | null> {
  const video = document.querySelector<HTMLVideoElement>('.remote-stage video');
  if (!video || !video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 960 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.8));
}

export function CallRoom({ session, user, onClose, onNext, notify }: { session: Session; user: User; onClose: () => void; onNext: () => void; notify: (s: string) => void }) {
  const peerId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id;
  const [partner, setPartner] = useState<PublicPartner | null>(null);
  const [saved, setSaved] = useState<'idle' | 'pending' | 'active'>('idle');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [callState, setCallState] = useState<CallState>(session.mode === 'text' ? 'connected' : 'connecting');
  const [quality, setQuality] = useState<'HD' | 'SD' | 'Low'>('HD');
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [reporting, setReporting] = useState(false);
  const [pendingShot, setPendingShot] = useState<Blob | null>(null);
  const [chatOpen, setChatOpen] = useState(session.mode === 'text');
  const signalCursor = useRef({ at: '', id: '' });
  const chatEnd = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const sendSignal = async (payload: Json) => { await supabase.from('call_signals').insert({ session_id: session.id, sender_id: user.id, recipient_id: peerId, payload }); };

  useEffect(() => {
    let alive = true; let pc: RTCPeerConnection | null = null; let stream: MediaStream | null = null;
    supabase.from('profiles').select('id,display_name,country_code,avatar_url,tags').eq('id', peerId).single().then(({ data }) => { if (alive) setPartner(data); });
    const load = () => supabase.from('session_messages').select('*').eq('session_id', session.id).order('created_at', { ascending: true }).limit(200).then(({ data }) => { if (alive) setMessages(data || []); });
    void load();
    const channel = supabase.channel(`room-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_messages', filter: `session_id=eq.${session.id}` }, p => { if (alive) setMessages(m => m.some(x => x.id === (p.new as Msg).id) ? m : [...m, p.new as Msg]); setChatOpen(true); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_sessions', filter: `id=eq.${session.id}` }, p => {
        if (['ended', 'failed', 'reported'].includes((p.new as Session).status) && !leaving.current) { setCallState('disconnected'); notify('They left. Finding someone new…'); setTimeout(onNext, 1400); }
      }).subscribe();
    let timer: ReturnType<typeof setInterval> | undefined; let qualityTimer: ReturnType<typeof setInterval> | undefined; let connTimer: ReturnType<typeof setTimeout> | undefined;
    const pendingIce: RTCIceCandidateInit[] = []; let busy = false;
    async function checkSignals() {
      if (busy || !pc) return; busy = true;
      try {
        const { data } = await supabase.from('call_signals').select('*').eq('session_id', session.id).eq('recipient_id', user.id).gte('created_at', signalCursor.current.at || '1970-01-01').order('created_at').order('id').limit(100);
        for (const row of data || []) {
          const c = signalCursor.current;
          if (row.created_at < c.at || (row.created_at === c.at && row.id <= c.id)) continue;
          signalCursor.current = { at: row.created_at, id: row.id };
          const msg = row.payload as { type?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
          try {
            if (msg.type === 'offer' && msg.sdp) { await pc.setRemoteDescription(msg.sdp); for (const ice of pendingIce.splice(0)) await pc.addIceCandidate(ice); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await sendSignal({ type: 'answer', sdp: answer as unknown as Json }); }
            if (msg.type === 'answer' && msg.sdp && pc.signalingState === 'have-local-offer') { await pc.setRemoteDescription(msg.sdp); for (const ice of pendingIce.splice(0)) await pc.addIceCandidate(ice); }
            if (msg.type === 'ice' && msg.candidate) { if (pc.remoteDescription) await pc.addIceCandidate(msg.candidate); else pendingIce.push(msg.candidate); }
          } catch (e) { console.warn('negotiation', e); }
        }
      } finally { busy = false; }
    }
    async function init() {
      await supabase.rpc('session_transition', { _session: session.id, _to: 'connecting' });
      if (session.mode === 'text') { await supabase.rpc('session_transition', { _session: session.id, _to: 'connected' }); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: session.mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        setLocal(stream);
        pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] });
        stream.getTracks().forEach(t => pc!.addTrack(t, stream!));
        pc.ontrack = e => { const s = e.streams[0]; if (s) setRemote(new MediaStream(s.getTracks())); setCallState('connected'); };
        pc.onicecandidate = e => { if (e.candidate) void sendSignal({ type: 'ice', candidate: e.candidate.toJSON() as Json }); };
        pc.onconnectionstatechange = () => {
          const st = pc?.connectionState;
          if (st === 'connected') { setCallState('connected'); void supabase.rpc('session_transition', { _session: session.id, _to: 'connected' }); }
          if (st === 'failed' || st === 'disconnected') setCallState('disconnected');
        };
        if (session.mode === 'video') qualityTimer = setInterval(async () => {
          if (!pc || pc.connectionState !== 'connected') return;
          const stats = await pc.getStats(); let avail = 0; let loss = 0;
          stats.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.availableOutgoingBitrate) avail = r.availableOutgoingBitrate; if (r.type === 'remote-inbound-rtp' && r.kind === 'video') loss = r.fractionLost ?? 0; });
          if (!avail) return;
          const target = Math.max(100_000, Math.min(1_500_000, avail * (loss > 0.08 ? 0.45 : 0.7)));
          const scaleDown = target < 250_000 ? 3 : target < 600_000 ? 1.5 : 1;
          setQuality(target < 250_000 ? 'Low' : target < 600_000 ? 'SD' : 'HD');
          const sender = pc.getSenders().find(s => s.track?.kind === 'video'); if (!sender) return;
          const p = sender.getParameters(); if (!p.encodings?.length) p.encodings = [{}];
          if (p.encodings[0]) { p.encodings[0].maxBitrate = target; p.encodings[0].scaleResolutionDownBy = scaleDown; }
          try { await sender.setParameters(p); } catch { /* unsupported */ }
        }, 4000);
        await checkSignals(); timer = setInterval(() => void checkSignals(), 1000);
        connTimer = setTimeout(() => { if (pc?.connectionState !== 'connected') setCallState('disconnected'); }, 25000);
        if (session.initiator_id === user.id) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await sendSignal({ type: 'offer', sdp: offer as unknown as Json }); }
      } catch { setCallState('disconnected'); notify('Camera or microphone permission is needed. Allow it in your browser, or use text chat.'); }
    }
    void init();
    return () => { alive = false; clearInterval(timer); clearInterval(qualityTimer); clearTimeout(connTimer); supabase.removeChannel(channel); pc?.close(); stream?.getTracks().forEach(t => t.stop()); };
  }, [session.id]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length]);

  const end = async (next = false) => { leaving.current = true; await supabase.rpc('session_transition', { _session: session.id, _to: 'ended', _reason: next ? 'next' : 'left' }); if (next) onNext(); else onClose(); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = messageSchema.safeParse(draft);
    if (!parsed.success) { notify(parsed.error.issues[0]?.message || 'Invalid message'); return; }
    setDraft('');
    const { data, error } = await supabase.from('session_messages').insert({ session_id: session.id, sender_id: user.id, body: parsed.data }).select('*').single();
    if (error) { notify(error.message); setDraft(parsed.data); } else if (data) setMessages(m => m.some(x => x.id === data.id) ? m : [...m, data]);
  };
  const openReport = async () => { setPendingShot(session.mode === 'video' ? await captureFrame() : null); setReporting(true); };
  const submitReport = async (category: string, note: string) => {
    let path: string | null = null;
    if (pendingShot) {
      const p = `${user.id}/${session.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('report-evidence').upload(p, pendingShot, { contentType: 'image/jpeg' });
      if (!error) path = p;
    }
    leaving.current = true;
    const { error } = await supabase.rpc('submit_report_v2', { _reported: peerId, _session: session.id, _category: category, _note: note, _screenshot: path as string });
    if (error) { leaving.current = false; notify(error.message); return; }
    setReporting(false); notify('Reported and blocked. Thank you for keeping Jnoy safe.'); onNext();
  };
  const saveConnection = async () => {
    const { data, error } = await supabase.rpc('set_mutual_connection_decision', { _session: session.id, _accept: true });
    if (error) notify(error.message);
    else if (data === 'active' || data === 'pending') { setSaved(data); notify(data === 'active' ? 'You both connected! Find them in Messages.' : 'Saved! They’ll appear in Messages if they connect too.'); }
    else notify('This connection is no longer available.');
  };
  const toggleMic = () => { local?.getAudioTracks().forEach(t => { t.enabled = !micOn; }); setMicOn(!micOn); };
  const toggleCam = () => { local?.getVideoTracks().forEach(t => { t.enabled = !camOn; }); setCamOn(!camOn); };
  const name = partner?.display_name || 'Someone new';
  const status = callState === 'connecting' ? `Connecting to ${name}…` : callState === 'disconnected' ? 'Connection lost' : `Connected with ${name}`;

  return <div className="call-page jn-call">
    <div className="call-top"><Brand light/><div className="call-status" role="status"><span className={`live-dot ${callState !== 'connected' ? 'jn-dot-wait' : ''}`}/> {status}{session.mode === 'video' && callState === 'connected' && <span className="jn-quality">{quality}</span>}</div><button onClick={() => void openReport()} className="report-top"><Flag size={17}/> Report</button></div>
    <div className={`call-layout ${chatOpen ? '' : 'jn-chat-hidden'}`}>
      <div className="call-main">
        {session.mode === 'text' ? <div className="text-call-art"><img src={world} alt="" width={1280} height={1024}/><h2>Say hello to {name}.</h2><p>{countryFlag(partner?.country_code)} {countryLabel(partner?.country_code)}{partner?.tags?.length ? ` · ${partner.tags.slice(0, 3).join(' · ')}` : ''}</p></div>
          : <VideoStage stream={remote} label={remote ? name : callState === 'disconnected' ? 'Connection lost — tap Next' : `Connecting to ${name}…`} remote offline={callState === 'disconnected'} audioOnly={session.mode === 'audio'} avatar={partner?.avatar_url ?? null}/>}
        <div className="call-overlay-info"><span>{name}</span><small>{countryFlag(partner?.country_code)} {countryLabel(partner?.country_code)} · {session.mode} chat</small></div>
        {session.mode === 'video' && <div className="self-preview"><VideoStage stream={camOn ? local : null} label="You"/></div>}
        <div className="call-controls">
          {session.mode !== 'text' && <button aria-label={micOn ? 'Mute' : 'Unmute'} onClick={toggleMic} className={micOn ? '' : 'jn-off'}><span>{micOn ? <Mic size={22}/> : <MicOff size={22}/>}</span>Mic</button>}
          {session.mode === 'video' && <button aria-label={camOn ? 'Camera off' : 'Camera on'} onClick={toggleCam} className={camOn ? '' : 'jn-off'}><span>{camOn ? <Camera size={22}/> : <CameraOff size={22}/>}</span>Camera</button>}
          {session.mode !== 'text' && <button onClick={() => setChatOpen(!chatOpen)} className="jn-chat-toggle"><span><MessageCircle size={22}/></span>Chat</button>}
          <button onClick={saveConnection} disabled={saved !== 'idle'}><span><Heart size={22}/></span>{saved === 'active' ? 'Connected' : saved === 'pending' ? 'Saved' : 'Connect'}</button>
          <button onClick={() => void openReport()} className="jn-report-btn"><span><Flag size={22}/></span>Report</button>
          <button onClick={() => void end(true)} className="next-control"><span><Shuffle size={22}/></span>Next</button>
          <button onClick={() => void end()} className="end-control"><span><PhoneOff size={22}/></span>End</button>
        </div>
      </div>
      <div className="call-chat">
        <div className="chat-title"><div><MessageCircle size={19}/><h3>Chat with {name}</h3></div><span>LIVE</span></div>
        <div className="chat-messages">
          <div className="chat-welcome"><Sparkles size={24}/><h4>It starts with hello.</h4><p>This chat is cleared when you tap Next. Never share contact details.</p></div>
          {messages.map(m => <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'mine' : ''}`}><small>{m.sender_id === user.id ? 'You' : name}</small>{m.body}</div>)}
          <div ref={chatEnd}/>
        </div>
        <form className="chat-form" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say something nice…" maxLength={2000} aria-label="Message" autoComplete="off"/><button aria-label="Send message" disabled={!draft.trim()}><Send size={18}/></button></form>
      </div>
    </div>
    {reporting && <ReportDialog hasVideo={!!pendingShot} onCancel={() => setReporting(false)} onSubmit={submitReport}/>}
  </div>;
}
