import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LegalPage } from "@/components/site-chrome";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & troubleshooting · Jnoy" }, { name: "description", content: "Fix camera, microphone and connection issues on Jnoy." }, { property: "og:title", content: "Help · Jnoy" }, { property: "og:description", content: "Answers to common questions and connection fixes." }] }),
  component: () => (
    <LegalPage title="Help & troubleshooting">
      <Accordion type="single" collapsible className="text-foreground">
        {[
          ["My camera or mic isn't working", "Click the lock icon in your browser's address bar, allow Camera and Microphone for this site, then reload. Close other apps that may be using the camera."],
          ["The call says it can't connect", "Some networks (offices, schools, strict mobile carriers) block direct connections. Try Wi-Fi instead of mobile data or vice versa, or continue in text chat."],
          ["Can I search for a specific person?", "No. Jnoy is random by design — you're matched by tags, language and region. If you both tap “Stay connected” after a call, you can message each other."],
          ["Why is it taking a while to match?", "We only match people who are online and compatible. Allow “Broaden after 30 seconds” to widen your preferences."],
          ["Testing with two accounts", "Open two different browsers (or one normal + one private window), sign in with two accounts, finish onboarding on both and press Start matching in both."],
          ["How do I delete my account?", "Settings → Account → Delete account. This is permanent."],
        ].map(([q, a], i) => (
          <AccordionItem key={i} value={String(i)}>
            <AccordionTrigger className="text-left text-base font-bold">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </LegalPage>
  ),
});
