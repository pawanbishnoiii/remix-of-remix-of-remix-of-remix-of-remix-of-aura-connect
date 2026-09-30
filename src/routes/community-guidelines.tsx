import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site-chrome";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({ meta: [{ title: "Community guidelines · Jnoy" }, { name: "description", content: "How to be a good conversation partner on Jnoy." }, { property: "og:title", content: "Community guidelines · Jnoy" }, { property: "og:description", content: "Kindness, consent and zero tolerance for abuse." }] }),
  component: () => (
    <LegalPage title="Community guidelines">
      <p>Jnoy works when everyone feels safe to say hello. Keep it kind, keep it consensual.</p>
      <h2>Do</h2>
      <ul><li>Be respectful and curious</li><li>Keep your face and clothing appropriate on camera</li><li>Tap Next if a conversation isn't for you — no explanation needed</li><li>Report anything that breaks these rules</li></ul>
      <h2>Never</h2>
      <ul><li>Nudity, sexual content or sexual solicitation</li><li>Anything involving minors — you must be 18+</li><li>Threats, harassment, bullying or hate</li><li>Scams, spam, or selling</li><li>Impersonation or sharing someone's personal info (doxxing)</li><li>Recording others without consent</li><li>Illegal content of any kind</li></ul>
      <h2>Consequences</h2>
      <p>Violations lead to warnings, 24-hour suspensions or permanent bans depending on severity.</p>
    </LegalPage>
  ),
});
