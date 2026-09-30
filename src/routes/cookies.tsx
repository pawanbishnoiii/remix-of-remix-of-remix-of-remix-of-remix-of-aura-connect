import { createFileRoute } from '@tanstack/react-router';
import { PolicyLayout } from '@/components/jnoy/PolicyLayout';

export const Route = createFileRoute('/cookies')({
  head: () => ({ meta: [
    { title: 'Cookie Policy — Jnoy' }, { name: 'description', content: 'How Jnoy uses cookies and local storage.' },
    { property: 'og:title', content: 'Cookie Policy — Jnoy' }, { property: 'og:description', content: 'How Jnoy uses cookies and local storage.' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <PolicyLayout title="Cookie Policy" updated="30 SEP 2026" intro="Jnoy uses only strictly necessary storage. We do not use advertising or cross-site tracking cookies." sections={[
    { h: 'What we store', p: [['Sign-in session tokens so you stay logged in.', 'A temporary flag recording that you accepted our terms before Google sign-in.', 'Your browser’s camera/microphone permission (managed by your browser, not us).']] },
    { h: 'Your choices', p: ['Because this storage is strictly necessary, consent is not required under the EU ePrivacy Directive or UK PECR. You can clear it any time in your browser settings; you will be signed out.'] },
  ]}/>,
});
