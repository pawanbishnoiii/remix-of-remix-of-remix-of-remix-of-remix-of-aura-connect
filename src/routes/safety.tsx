import { createFileRoute } from '@tanstack/react-router';
import { PolicyLayout } from '@/components/jnoy/PolicyLayout';

export const Route = createFileRoute('/safety')({
  head: () => ({ meta: [
    { title: 'Safety Center — Jnoy' }, { name: 'description', content: 'Tips and tools to stay safe while meeting strangers on Jnoy.' },
    { property: 'og:title', content: 'Safety Center — Jnoy' }, { property: 'og:description', content: 'Tips and tools to stay safe on Jnoy.' },
    { property: 'og:type', content: 'article' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <PolicyLayout title="Safety Center" updated="30 SEP 2026" intro="You are always in control. Here’s how to stay safe and what we do behind the scenes." sections={[
    { h: 'Your tools', p: [['Next — leave any conversation instantly.', 'Report — blocks the person, ends the call and sends our team a snapshot and the chat.', 'Mic and camera toggles — turn them off at any time.', 'Text mode — chat without a camera.']] },
    { h: 'Stay safe', p: [['Never share your phone number, address, school, workplace or social accounts.', 'Never send money or gift cards to anyone you meet.', 'Be careful with anything shown on camera behind you.', 'If someone threatens you, report them and contact local police.']] },
    { h: 'What we do', p: ['Automatic contact-detail blocking in chat, device-based matching, reporting with evidence, human safety review of reports, and bans that follow the account.'] },
    { h: 'Emergency help', p: ['If you are in danger, contact local emergency services (112 in India and the EU, 911 in the US and Canada, 999 in the UK, 000 in Australia).'] },
  ]}/>,
});
