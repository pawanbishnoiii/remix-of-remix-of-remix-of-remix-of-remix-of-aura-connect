import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy policy · Jnoy" }, { name: "description", content: "How Jnoy handles your data, location and calls." }, { property: "og:title", content: "Privacy policy · Jnoy" }, { property: "og:description", content: "What we store, what we never store, and your controls." }] }),
  component: () => (
    <LegalPage title="Privacy policy" updated="September 2026">
      <p>This policy explains what Jnoy collects and why. We collect as little as possible.</p>
      <h2>What we store</h2>
      <ul><li>Account email and sign-in details</li><li>Your profile: display name, optional bio, avatar, pronouns, tags and languages</li><li>Matching preferences and an optional country / coarse region</li><li>Operational events (a call was created, connected, ended) and reports you file</li><li>Direct messages with mutual connections</li></ul>
      <h2>What we never store</h2>
      <ul><li><strong>Video and audio are never recorded</strong>, uploaded or stored. Calls go directly between browsers.</li><li>Your precise location. If you allow it, we keep only a country code and a coarse region label.</li><li>IP addresses in our app database.</li></ul>
      <h2>Who can see what</h2>
      <p>During a call, the other person sees only your display name, avatar, selected language and shared tags. Your email and location are never shown.</p>
      <h2>Your controls</h2>
      <p>You can edit your profile, clear preferences, delete conversations from your view and permanently delete your account from Settings.</p>
      <h2>Contact</h2>
      <p>privacy@[your-domain] — placeholder, replace before launch.</p>
    </LegalPage>
  ),
});
