import { motion } from 'motion/react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import world from '@/assets/clay-globe.webp';

export function Hero({ onStart }: { onStart: () => void }) {
  return <section className="hero"><div className="hero-inner">
    <motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
      <div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={14}/></span> YOUR WORLD IS ABOUT TO GET BIGGER</div>
      <h1>Meet someone<br/><em>unexpected.</em><span className="heading-spark">✳</span></h1>
      <p>One tap. A random stranger. A real conversation — video, voice or text. Tap Next anytime to meet someone new.</p>
      <button className="jn-hero-cta" onClick={onStart}>Continue with Google <ArrowUpRight size={18}/></button>
      <div className="hero-proof"><span className="proof-bubbles"><b>🌍</b><b>✳</b><b>💜</b></span><span>18+ only · Free · No searching strangers</span></div>
    </motion.div>
    <div className="hero-art"><img src={world} alt="Clay lavender globe with a coral heart and mint star in orbit" width={640} height={640} fetchPriority="high"/><div className="jn-float jn-float-a">👋 Hi from 🇮🇳</div><div className="jn-float jn-float-b">🎧 Voice · 🇧🇷</div><div className="jn-float jn-float-c">💬 New match!</div><div className="art-sticker sticker-top">✳ &nbsp; a whole world of hellos</div><div className="art-sticker sticker-bottom"><span className="live-dot"/> Connections happen here</div></div>
  </div></section>;
}
