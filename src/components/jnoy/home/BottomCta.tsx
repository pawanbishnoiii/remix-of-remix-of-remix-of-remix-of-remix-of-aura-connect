import { ArrowUpRight } from 'lucide-react';
import star from '@/assets/jnoy-spark.jpg';

export function BottomCta({ onStart }: { onStart: () => void }) {
  return <section className="bottom-cta"><div><span className="section-kicker">THE WORLD IS WAITING</span><h2>One hello can change<br/><em>everything.</em></h2><p>Come as you are. Leave with a story.</p><button onClick={onStart}>Find your next conversation <ArrowUpRight size={19}/></button></div><img src={star} alt="Smiling coral clay star" loading="lazy" width={1024} height={1024}/></section>;
}
