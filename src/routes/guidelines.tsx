import { createFileRoute } from '@tanstack/react-router';
import { PolicyLayout } from '@/components/jnoy/PolicyLayout';

export const Route = createFileRoute('/guidelines')({
  head: () => ({ meta: [
    { title: 'Community Guidelines — Jnoy' }, { name: 'description', content: 'How to be a great part of the Jnoy community, and what gets you banned.' },
    { property: 'og:title', content: 'Community Guidelines — Jnoy' }, { property: 'og:description', content: 'How to be a great part of the Jnoy community.' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <PolicyLayout title="Community Guidelines" updated="30 SEP 2026" intro="Jnoy works because people show up curious and kind. These rules apply to every video, voice and text conversation." sections={[
    { h: 'Be kind', p: ['Say hello, be respectful, and tap Next politely if it isn’t a fit. No insults, bullying or pressure.'] },
    { h: 'Keep it clothed and clean', p: ['No nudity, sexual acts, or sexual requests. Zero tolerance for anything involving minors — this results in a permanent ban and a report to authorities.'] },
    { h: 'No hate or violence', p: ['No hate speech or symbols targeting race, religion, caste, ethnicity, nationality, gender, sexual orientation or disability. No threats, weapons displays or glorifying violence.'] },
    { h: 'Protect privacy', p: ['Don’t share contact details (phone numbers, emails, social handles) — our system blocks them automatically. Don’t record others or ask for personal information.'] },
    { h: 'No spam or scams', p: ['No advertising, links to paid content, crypto schemes, begging for money or impersonation.'] },
    { h: 'Consequences', p: [['Warning for minor issues.', '24-hour suspension for repeated or moderate violations.', 'Permanent ban for serious violations, ban evasion, or anything involving minors.']] },
  ]}/>,
});
