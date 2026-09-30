import { Link } from '@tanstack/react-router';
import { Brand } from './Brand';

export function SiteFooter() {
  return <footer className="site-footer">
    <div><Brand light/><p>Real conversations. Unexpected connections.<br/>A little closer to everywhere.</p></div>
    <div className="footer-side">
      <nav className="jn-footer-links"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/guidelines">Community Guidelines</Link><Link to="/safety">Safety</Link><Link to="/cookies">Cookies</Link></nav>
      <span>18+ only · Be kind · Stay safe · © {new Date().getFullYear()} Jnoy</span>
    </div>
  </footer>;
}
