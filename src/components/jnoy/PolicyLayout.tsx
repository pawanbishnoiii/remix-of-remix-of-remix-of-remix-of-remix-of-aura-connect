import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Brand } from './Brand';
import { SiteFooter } from './SiteFooter';

export type PolicySection = { h: string; p: (string | string[])[] };

export function PolicyLayout({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: PolicySection[] }) {
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><Link to="/"><Brand light/></Link><nav className="header-links jn-policy-nav"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/guidelines">Guidelines</Link><Link to="/safety">Safety</Link><Link to="/cookies">Cookies</Link></nav></div></header>
    <main className="jn-policy">
      <Link to="/" className="jn-back"><ArrowLeft size={16}/> Back to Jnoy</Link>
      <span className="section-kicker">LEGAL · LAST UPDATED {updated}</span>
      <h1>{title}</h1>
      <p className="jn-policy-intro">{intro}</p>
      <nav className="jn-toc" aria-label="Contents">{sections.map((s, i) => <a key={s.h} href={`#s${i + 1}`}>{i + 1}. {s.h}</a>)}</nav>
      {sections.map((s, i) => <section key={s.h} id={`s${i + 1}`}><h2>{i + 1}. {s.h}</h2>{s.p.map((para, j) => Array.isArray(para) ? <ul key={j}>{para.map(li => <li key={li}>{li}</li>)}</ul> : <p key={j}>{para}</p>)}</section>)}
      <p className="jn-policy-note">This document is a general template and is not legal advice. Have it reviewed by a qualified lawyer in each country where you operate before launch.</p>
    </main>
    <SiteFooter/>
  </div>;
}
