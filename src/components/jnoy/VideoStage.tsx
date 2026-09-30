import { useEffect, useRef } from 'react';
import { CameraOff, WifiOff } from 'lucide-react';
export function VideoStage({ stream, label, remote = false, offline = false }: { stream: MediaStream | null; label: string; remote?: boolean; offline?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <div className={`video-stage ${remote ? 'remote-stage' : ''}`}>
    {stream ? <video ref={ref} autoPlay playsInline muted={!remote} className={remote ? '' : 'mirrored'} /> : <div className="video-empty">{offline ? <WifiOff size={34}/> : <CameraOff size={34}/>}<span>{label}</span></div>}
    <div className="video-label"><span className="live-dot"/>{label}</div>
  </div>;
}