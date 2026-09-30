import { ArrowRight, ArrowUpRight, Camera, LockKeyhole, MessageCircle, Mic, Settings2, ShieldCheck, Wifi } from 'lucide-react';

export function GuestPreview({ onStart }: { onStart: () => void }) {
  return <section className="matching-wrap" id="matching">
    <div className="section-heading"><div><span className="section-kicker">THE NEXT HELLO STARTS HERE</span><h2>Your space to <em>connect.</em></h2></div><p>No searching, no scrolling. We pair you with someone at random — nearby first, then anywhere.</p></div>
    <div className="matching-grid">
      <div className="preview-card"><div className="preview-head"><div><span className="preview-icon"><Camera size={18}/></span><span>Your preview</span></div><span className="private-pill"><LockKeyhole size={12}/> Just for you</span></div>
        <div className="preview-frame"><div className="preview-placeholder"><div className="placeholder-orb"><Camera size={39}/></div><h3>Your camera, your call.</h3><p>Only you see this preview until you connect.</p></div><div className="preview-corner"><span className="live-dot"/> CAMERA OFF</div></div>
        <div className="preview-foot"><span><ShieldCheck size={17}/> You’re always in control of your camera and mic.</span><span className="quality"><Wifi size={17}/> Adjusts to slow internet</span></div>
      </div>
      <div className="prefs-card"><div className="prefs-title"><div><span className="prefs-badge"><Settings2 size={20}/></span><div><h3>Random matching</h3><p>Tap start and say hi — nearby first, then the world.</p></div></div></div>
        <div className="prefs-body jn-feature-list">
          <p><Camera size={16}/> Video chat with live audio</p><p><Mic size={16}/> Voice-only calls</p><p><MessageCircle size={16}/> Text chat alongside every call</p><p><ShieldCheck size={16}/> One-tap report &amp; block</p>
        </div>
      </div>
    </div>
    <div className="mode-and-start"><div/><div className="start-area"><button className="start-button" onClick={onStart}><span className="start-arrow"><ArrowRight size={20}/></span> Start matching <ArrowUpRight size={21}/></button><span>Sign in with Google to begin.</span></div></div>
  </section>;
}
