import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site-chrome";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of use · Jnoy" }, { name: "description", content: "The rules for using Jnoy." }, { property: "og:title", content: "Terms of use · Jnoy" }, { property: "og:description", content: "Rules and responsibilities for Jnoy users." }] }),
  component: () => (
    <LegalPage title="Terms of use" updated="September 2026">
      <h2>1. Eligibility</h2>
      <p><strong>You must be 18 or older.</strong> Accounts that appear to belong to minors are removed.</p>
      <h2>2. Your conduct</h2>
      <p>You agree to follow our Community Guidelines. We have zero tolerance for exploitation, threats, harassment, nudity or sexual content, impersonation, hate, scams, doxxing and illegal content.</p>
      <h2>3. Moderation</h2>
      <p>We may warn, suspend or ban accounts that break these terms. Moderation decisions are logged.</p>
      <h2>4. No recording</h2>
      <p>Jnoy does not record calls. You must not record other users without their clear consent.</p>
      <h2>5. Service availability</h2>
      <p>Direct connections may not work on every network. The service is provided as-is.</p>
      <h2>6. Termination</h2>
      <p>You can delete your account at any time from Settings.</p>
      <h2>7. Contact</h2>
      <p>legal@[your-domain] — placeholder.</p>
    </LegalPage>
  ),
});
