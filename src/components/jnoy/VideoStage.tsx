import { useEffect, useRef } from 'react';
import { CameraOff, Mic, WifiOff } from 'lucide-react';

export function VideoStage({ stream, label, remote = false, offline = false, audioOnly = false, avatar }: { stream: MediaStream | null; label: string; remote?: boolean; offline?: boolean; audioOnly?: boolean; avatar?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) { ref.current.srcObject = stream; void ref.current.play().catch(() => {}); }
    if (audioRef.current) { audioRef.current.srcObject = stream; void audioRef.current.play().catch(() => {}); }
  }, [stream, audioOnly]);
  return <div className={`video-stage ${remote ? 'remote-stage' : ''}`}>
    {stream && !audioOnly ? <video ref={ref} autoPlay playsInline muted={!remote} className={remote ? '' : 'mirrored'}/>
      : <div className="video-empty">
        {audioOnly && stream ? (avatar ? <img src={avatar} alt="" className="jn-avatar-lg" referrerPolicy="no-referrer"/> : <Mic size={40}/>) : offline ? <WifiOff size={34}/> : <CameraOff size={34}/>}
        <span>{label}</span>
      </div>}
    {remote && audioOnly && <audio ref={audioRef} autoPlay/>}
    <div className="video-label"><span className="live-dot"/>{label}</div>
  </div>;
}
