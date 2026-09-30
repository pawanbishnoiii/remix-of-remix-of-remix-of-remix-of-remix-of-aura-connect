import { Heart, Settings2, Shuffle } from 'lucide-react';

export function HowItWorks() {
  return <section className="how-section"><div className="how-inner">
    <div className="how-heading"><span className="section-kicker">SIMPLE AS SAYING HELLO</span><h2>Good things happen<br/>when you <em>connect.</em></h2><p>Forget endless scrolling. Here it’s all about the moment and the person on the other side.</p></div>
    <div className="how-cards">
      <article><div className="how-icon peach"><Settings2 size={28}/></div><span>01 / TAP START</span><h3>We find someone</h3><p>A random person, nearby first. No searching, no profiles to browse.</p></article>
      <article><div className="how-icon mint"><Shuffle size={28}/></div><span>02 / CHAT OR NEXT</span><h3>Talk, or skip</h3><p>Video, voice and chat live. Tap Next for a fresh person and a fresh chat.</p></article>
      <article><div className="how-icon sky"><Heart size={28}/></div><span>03 / KEEP THE GOOD ONES</span><h3>Keep the connection</h3><p>If you both tap Connect, you can message again later.</p></article>
    </div>
  </div></section>;
}
