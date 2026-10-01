import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { ArrowRight, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Brand } from './Brand';
import { authSchema } from '@/lib/jnoy';

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}

export function AuthModal({ onClose, notify, initialSignup = true }: { onClose: () => void; notify: (s: string) => void; initialSignup?: boolean }) {
  const [signup, setSignup] = useState(initialSignup);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const all = adult && terms && privacy;
  const setAll = (v: boolean) => { setAdult(v); setTerms(v); setPrivacy(v); };
  const needsConsent = false; void all; void setAll;

  const google = async () => {
    if (needsConsent) { notify('Please confirm you are 18+ and accept the policies first.'); return; }
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
    if (result.error) { notify(result.error.message || 'Google sign-in failed'); return; }
    if (result.redirected) return;
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsConsent) { notify('Please confirm you are 18+ and accept the policies first.'); return; }
    const v = authSchema.safeParse({ email, password });
    if (!v.success) { notify('Enter a valid email and a password of at least 8 characters.'); return; }
    setBusy(true);
    if (signup) {
      const { error, data } = await supabase.auth.signUp({ ...v.data, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) notify(error.message);
      else if (!data.session) notify('Check your email to confirm your account, then sign in.');
      else onClose();
    } else {
      const { error } = await supabase.auth.signInWithPassword(v.data);
      setBusy(false);
      if (error) notify(error.message); else onClose();
    }
  };
  const Check1 = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) =>
    <label className={`jn-check ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={e => set(e.target.checked)}/><span className="jn-box">{on && <Check size={13}/>}</span><span>{children}</span></label>;

  return <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="auth-modal jn-auth" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e: React.MouseEvent) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={signup ? 'Create account' : 'Sign in'}>
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20}/></button>
      <Brand/>
      <h2>{signup ? 'Your story starts here.' : 'Welcome back, explorer.'}</h2>
      <p>{signup ? 'The fastest way in is Google — one tap and you’re ready.' : 'Sign in to keep meeting the world.'}</p>
      {false && <div className="jn-consent">
        <Check1 on={all} set={setAll}><b>Agree to all</b></Check1>
        <div className="jn-consent-list">
          <Check1 on={adult} set={setAdult}>I am 18 years or older</Check1>
          <Check1 on={terms} set={setTerms}>I have read and agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/guidelines" target="_blank">Community Guidelines</Link></Check1>
          <Check1 on={privacy} set={setPrivacy}>I agree to the <Link to="/privacy" target="_blank">Privacy Policy</Link>, including approximate location and device use for matching and safety</Check1>
        </div>
      </div>}
      <button className="jn-google" onClick={google} disabled={needsConsent}><GoogleIcon/> Continue with Google</button>
      <div className="auth-divider">or use email</div>
      <form onSubmit={submit}>
        <label>Email address<input type="email" required maxLength={255} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Password<input type="password" required minLength={8} maxLength={128} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
        <button className="full-primary" disabled={busy || needsConsent}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <ArrowRight size={18}/></button>
      </form>
      <p className="jn-muted jn-center jn-auth-note">18+ only. You’ll confirm your age and accept our <Link to="/terms" target="_blank">Terms</Link> &amp; <Link to="/privacy" target="_blank">Privacy Policy</Link> in the next step.</p>
      <p className="auth-switch">{signup ? 'Already part of Jnoy?' : 'New to Jnoy?'} <button onClick={() => setSignup(!signup)}>{signup ? 'Sign in' : 'Create an account'}</button></p>
    </motion.div>
  </motion.div>;
}
