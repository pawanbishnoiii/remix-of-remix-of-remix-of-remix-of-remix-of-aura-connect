import { createFileRoute } from '@tanstack/react-router';
import { PolicyLayout } from '@/components/jnoy/PolicyLayout';

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [
    { title: 'Privacy Policy — Jnoy' }, { name: 'description', content: 'What personal data Jnoy collects, why, how long we keep it, and your rights worldwide.' },
    { property: 'og:title', content: 'Privacy Policy — Jnoy' }, { property: 'og:description', content: 'What data Jnoy collects and your privacy rights worldwide.' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <PolicyLayout title="Privacy Policy" updated="30 SEP 2026" intro="This policy explains what personal data Jnoy collects, why we use it, who we share it with, and the rights you have under laws such as the EU/UK GDPR, India’s DPDP Act 2023, California’s CCPA/CPRA, Brazil’s LGPD, Canada’s PIPEDA and Australia’s Privacy Act 1988." sections={[
    { h: 'Data we collect', p: [[
      'Account data: email address, and if you use Google sign-in, your name and profile photo from Google. (Google does not share your age or gender with us — you enter those yourself.)',
      'Profile data: first and last name, gender, age, country, language and tags. Only your first name, country, photo and tags are shown to matches.',
      'Sign-in and device data: IP address, approximate location derived from your IP address (country, region and city — never GPS or precise location), device and browser name, sign-in times, session length and last-seen time.',
      'Conversation data: chat messages sent during matches and with mutual connections, match history (who you were paired with, when, and how it ended).',
      'Safety data: reports you file or receive, and — only when someone reports a video call — a single still image of the reported person’s video, captured at the moment of the report.',
      'Video and audio: calls travel directly between devices (peer-to-peer). We do not record or store video or audio streams.',
    ]] },
    { h: 'Why we use it (and legal bases)', p: [[
      'To provide the service and match you — contract performance.',
      'Approximate location and device type to match you with nearby people first, match phones with phones, and tune call quality — legitimate interest / consent at signup.',
      'Safety, moderation, fraud and abuse prevention, and enforcing bans — legitimate interest and legal obligation.',
      'Complying with law enforcement requests where legally required — legal obligation.',
    ], 'We do not sell your personal data and do not use it for third-party advertising.'] },
    { h: 'Who can see your data', p: [[
      'Your match sees only your first name, photo, country and tags.',
      'Authorised Jnoy safety staff can view account details, sign-in history, match history and chat logs to investigate reports and keep users safe. Every access is logged.',
      'Service providers who host our infrastructure and authentication (bound by data processing agreements).',
      'Authorities when required by law, or to report child sexual abuse material.',
    ]] },
    { h: 'How long we keep it', p: [[ 'Match chat messages: up to 90 days, then deleted unless part of an open report.', 'Reports and safety snapshots: up to 1 year after resolution, longer if required by law.', 'Sign-in history: up to 12 months.', 'Account data: until you delete your account.' ]] },
    { h: 'International transfers', p: ['Your data may be processed outside your country. Where required we use safeguards such as EU Standard Contractual Clauses and the UK International Data Transfer Addendum.'] },
    { h: 'Your rights', p: ['Depending on where you live, you can access, correct, delete or export your data, object to or restrict processing, and withdraw consent. EU/UK residents may complain to their data protection authority; Indian residents to the Data Protection Board of India; California residents may exercise CCPA rights to know, delete, correct and opt out of sale/sharing (we do not sell or share). Email privacy@jnoy.app — we reply within 30 days (or sooner where local law requires).'] },
    { h: 'Security', p: ['We use encryption in transit, access controls, row-level database security and staff access logging. No system is perfectly secure; tell us at security@jnoy.app if you find a problem.'] },
    { h: 'Children', p: ['Jnoy is for adults only. We do not knowingly collect data from anyone under 18. If you believe a minor is using Jnoy, report them or email safety@jnoy.app.'] },
    { h: 'Contact', p: ['Data controller: Jnoy. Privacy: privacy@jnoy.app. Grievance Officer (India): grievance@jnoy.app.'] },
  ]}/>,
});
