import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Ban, Flag, LogOut, MapPinOff, VideoOff } from "lucide-react";
import { LegalPage } from "@/components/site-chrome";

export const Route = createFileRoute("/safety")({
  head: () => ({ meta: [{ title: "Safety center · Jnoy" }, { name: "description", content: "Tools and guidance to stay safe on Jnoy." }, { property: "og:title", content: "Safety center · Jnoy" }, { property: "og:description", content: "Leave, report and block instantly." }] }),
  component: () => (
    <LegalPage title="Safety center">
      <div className="rounded-3xl border border-coral/40 bg-coral/10 p-6 text-foreground">
        <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-5 text-coral" /> In immediate danger?</p>
        <p className="mt-2 text-muted-foreground">Leave the call right away and contact your local emergency services (for example 112 in India/EU, 911 in the US).</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { i: LogOut, t: "Leave instantly", b: "End or Next closes the call immediately." },
          { i: Flag, t: "Report", b: "Pick a reason, add a note, and we'll review it." },
          { i: Ban, t: "Block", b: "Blocked people are never matched with you again." },
          { i: VideoOff, t: "Never recorded", b: "Video and audio aren't stored anywhere." },
          { i: MapPinOff, t: "Location stays private", b: "Only an optional country preference is used." },
        ].map((x) => (
          <div key={x.t} className="clay p-5">
            <x.i className="size-5 text-aqua" />
            <p className="mt-2 font-bold text-foreground">{x.t}</p>
            <p className="text-sm">{x.b}</p>
          </div>
        ))}
      </div>
      <h2>Tips</h2>
      <ul><li>Don't share your full name, address, school or workplace</li><li>Never send money to someone you met on Jnoy</li><li>Trust your instincts — Next is always okay</li></ul>
    </LegalPage>
  ),
});
