import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Compass, Flag, Globe2, Hash, Heart, Lock, MessageCircle, ShieldCheck, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Tag } from "@/components/chip";
import hero from "@/assets/hero-call.jpg";
import tokyo from "@/assets/people-tokyo.jpg";
import marrakech from "@/assets/people-marrakech.jpg";
import bali from "@/assets/people-bali.jpg";
import cdmx from "@/assets/people-cdmx.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jnoy — Random video & text chat with people worldwide" },
      { name: "description", content: "Meet strangers 1:1 on video, audio or text. Match by tags and country, stay safe with instant report and block." },
      { property: "og:title", content: "Jnoy — A real conversation can start in one tap" },
      { property: "og:description", content: "Random 1:1 video, audio and text chat matched by vibe, language and region." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6 } };

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute -left-32 top-10 size-96 rounded-full bg-primary/30 blur-3xl animate-orb" />
        <div aria-hidden className="pointer-events-none absolute right-0 top-40 size-80 rounded-full bg-aqua/20 blur-3xl animate-orb [animation-delay:-4s]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Sparkles className="size-3.5 text-sun" /> 18+ · Video · Audio · Text
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
              A real conversation can start in <span className="text-gradient">one tap.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Jnoy pairs you with one person at a time — matched by your tags, languages and region.
              No searching for people, no follower counts. Just a fresh hello.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-13 rounded-full px-7 text-base font-bold clay-btn">
                <Link to="/auth" search={{ mode: "signup" }}>Start meeting <ArrowRight className="ml-1 size-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-13 rounded-full px-7 text-base font-bold">
                <Link to="/safety">How Jnoy stays safer</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Travel", "Music", "Language practice", "Gaming", "Photography"].map((t, i) => (
                <Tag key={t} label={`#${t}`} index={i} />
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="clay overflow-hidden rounded-[2rem] p-2">
              <img src={hero} alt="Woman smiling during a video call on a rooftop at sunset" width={1280} height={1536} className="aspect-[4/5] w-full rounded-[1.6rem] object-cover" />
            </div>
            <div className="clay absolute -left-4 bottom-10 flex items-center gap-3 rounded-2xl p-3 pr-5 sm:-left-10">
              <span className="relative grid size-10 place-items-center rounded-full bg-mint/20">
                <span className="absolute inset-0 rounded-full bg-mint/40 animate-pulse-ring" />
                <Video className="size-5 text-mint" />
              </span>
              <div>
                <p className="text-sm font-bold">Matched on #Travel</p>
                <p className="text-xs text-muted-foreground">Same language · nearby region</p>
              </div>
            </div>
            <div className="clay absolute -right-3 top-8 rounded-2xl p-3 sm:-right-6">
              <p className="flex items-center gap-2 text-sm font-bold"><Lock className="size-4 text-aqua" /> Not recorded</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...fade} className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-widest text-aqua">Why Jnoy</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold sm:text-5xl">Built for good first conversations.</h2>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: Hash, title: "Choose your vibe", body: "Add tags like #Music or #Study. We use them to find people who share them — you can't search or browse anyone.", img: tokyo, color: "text-primary bg-primary/15" },
            { icon: Video, title: "Meet face-to-face", body: "Video, audio or text-first. Private 1:1 calls with a clean stage, easy controls and conversation starters.", img: marrakech, color: "text-coral bg-coral/15" },
            { icon: ShieldCheck, title: "Keep control", body: "Next, End, Report and Block are always one tap away. Blocked people are never matched with you again.", img: cdmx, color: "text-aqua bg-aqua/15" },
          ].map((f, i) => (
            <motion.article key={f.title} {...fade} transition={{ duration: 0.6, delay: i * 0.1 }} className="clay group overflow-hidden p-2">
              <img src={f.img} alt="" loading="lazy" width={1024} height={1280} className="aspect-[4/3] w-full rounded-[1.1rem] object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="p-5">
                <span className={`grid size-11 place-items-center rounded-2xl ${f.color}`}><f.icon className="size-5" /></span>
                <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Matching explainer */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="clay grid gap-10 overflow-hidden p-8 md:grid-cols-2 md:p-12">
          <motion.div {...fade}>
            <p className="text-sm font-bold uppercase tracking-widest text-coral">Smart random</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold">Random, but with a compass.</h2>
            <p className="mt-4 text-muted-foreground">Our matchmaker looks at who's online right now and prefers people who share your tags, language and region. If it takes a while, it can gently widen the circle — only if you allow it.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { icon: Hash, t: "Shared tags first" },
                { icon: Globe2, t: "Country preference, never exact location" },
                { icon: Compass, t: "Nearby region suggestions, optional" },
                { icon: Heart, t: "Stay connected only if you both say yes" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-3"><x.icon className="size-4 text-aqua" /> {x.t}</li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...fade} className="relative">
            <img src={bali} alt="Friends talking on a beach at sunset" loading="lazy" width={1280} height={960} className="h-full w-full rounded-3xl object-cover" />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="font-display text-4xl font-extrabold">How it works</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", t: "Set your vibe", b: "Pick 3–8 tags, your languages and whether you prefer video, audio or text." },
            { n: "02", t: "Tap Start", b: "Camera and mic are only requested when you press Start. We look for a compatible match." },
            { n: "03", t: "Talk, next, or connect", b: "Chat freely. Tap Next anytime. If you both want to stay in touch, you'll unlock messages." },
          ].map((s, i) => (
            <motion.div key={s.n} {...fade} transition={{ duration: 0.5, delay: i * 0.1 }} className="rounded-3xl border border-border bg-surface/40 p-6">
              <span className="font-display text-5xl font-extrabold text-gradient">{s.n}</span>
              <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand p-10 text-primary-foreground md:p-14">
          <div aria-hidden className="absolute -right-10 -top-10 size-64 rounded-full bg-coral/40 blur-3xl" />
          <h2 className="relative font-display text-4xl font-extrabold sm:text-5xl">Our safety promise</h2>
          <div className="relative mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: ShieldCheck, t: "18+ community", b: "Adults only, with clear guidelines and zero tolerance for abuse." },
              { icon: Flag, t: "Report & block", b: "Instant tools in every call and chat, reviewed by real moderators." },
              { icon: MessageCircle, t: "No public counts", b: "No followers, likes or popularity scores. Just conversations." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-background/15 p-5 backdrop-blur-sm">
                <x.icon className="size-6" />
                <p className="mt-3 font-bold">{x.t}</p>
                <p className="mt-1 text-sm opacity-90">{x.b}</p>
              </div>
            ))}
          </div>
          <Button asChild size="lg" variant="secondary" className="relative mt-10 rounded-full px-7 font-bold">
            <Link to="/auth" search={{ mode: "signup" }}>Create your account</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
