import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Camera, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useAvatar } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip, toggleIn } from "@/components/chip";
import { Logo, UserAvatar } from "@/components/brand";
import { COUNTRIES, INTERESTS, LANGUAGES, POLICY_VERSION, type Mode } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile · Jnoy" }, { name: "description", content: "Tell us your vibe to get better matches." }, { property: "og:title", content: "Onboarding · Jnoy" }, { property: "og:description", content: "Set up your Jnoy profile." }] }),
  component: Onboarding,
});

const nameSchema = z.string().trim().min(3, "At least 3 characters").max(24, "Max 24 characters").regex(/^[\p{L}\p{N}_ .-]+$/u, "Letters, numbers, spaces, _ . - only");

function Onboarding() {
  const { data: me, isLoading } = useMyProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [q, setQ] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [country, setCountry] = useState<string>("");
  const [prefCountries, setPrefCountries] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("video");
  const [similar, setSimilar] = useState(true);
  const [consents, setConsents] = useState({ terms: false, privacy: false, guidelines: false });
  const [region, setRegion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: avatarUrl } = useAvatar(avatarPath);

  useEffect(() => {
    if (!me?.profile) return;
    if (me.profile.onboarding_completed) navigate({ to: "/discover", replace: true });
    setName(me.profile.display_name ?? "");
    setBio(me.profile.bio ?? "");
    setPronouns(me.profile.pronouns ?? "");
    setAvatarPath(me.profile.avatar_url);
    setCountry(me.profile.country_code ?? "");
    setTags((me.profile.tags ?? []).join(", "));
    if (me.prefs) {
      if (me.prefs.interests.length) setInterests(me.prefs.interests);
      if (me.prefs.languages.length) setLanguages(me.prefs.languages);
      setPrefCountries(me.prefs.preferred_countries);
      setMode(me.prefs.default_mode as Mode);
      setSimilar(me.prefs.similar_interests);
    }
    const saved = Number(localStorage.getItem("jnoy-onb-step") ?? 0);
    if (saved > 0 && saved < 5) setStep(saved);
  }, [me, navigate]);

  useEffect(() => { localStorage.setItem("jnoy-onb-step", String(step)); }, [step]);

  const uid = me?.user.id;

  const upload = async (f: File) => {
    if (!uid) return;
    if (!f.type.startsWith("image/") || f.size > 2 * 1024 * 1024) return toast.error("Use an image under 2 MB.");
    const path = `${uid}/avatar-${Date.now()}.${f.name.split(".").pop() ?? "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (error) return toast.error("Upload failed");
    setAvatarPath(path);
  };

  const saveStep = async (): Promise<boolean> => {
    if (!uid) return false;
    if (step === 0 && !age) { toast.error("Please confirm you are 18 or older."); return false; }
    if (step === 1) {
      const r = nameSchema.safeParse(name);
      if (!r.success) { toast.error(r.error.issues[0].message); return false; }
      const { error } = await supabase.from("profiles").update({ display_name: r.data, bio: bio.trim().slice(0, 160) || null, pronouns: pronouns.trim().slice(0, 24) || null, avatar_url: avatarPath }).eq("id", uid);
      if (error) { toast.error(error.code === "23505" ? "That name is taken — try another." : "Couldn't save profile"); return false; }
    }
    if (step === 2) {
      if (interests.length < 3) { toast.error("Pick at least 3 interests."); return false; }
      const tagList = tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 10).map((t) => t.slice(0, 20));
      await supabase.from("user_preferences").update({ interests }).eq("user_id", uid);
      await supabase.from("profiles").update({ tags: tagList }).eq("id", uid);
    }
    if (step === 3) {
      if (!languages.length) { toast.error("Pick at least one language."); return false; }
      await supabase.from("user_preferences").update({ languages, preferred_countries: prefCountries, default_mode: mode, similar_interests: similar }).eq("user_id", uid);
      await supabase.from("profiles").update({ country_code: country || null }).eq("id", uid);
    }
    return true;
  };

  const next = async () => {
    setBusy(true);
    const ok = await saveStep();
    setBusy(false);
    if (ok) setStep((s) => s + 1);
  };

  const locate = async () => {
    try {
      const r = await fetch("https://ipapi.co/json/");
      const j = await r.json();
      if (j.country_code) {
        setCountry(j.country_code);
        setRegion(j.region ?? null);
        toast.success(`Approximate region set: ${j.region ?? j.country_name}`);
      }
    } catch { toast.error("Couldn't detect your region. You can pick it manually."); }
  };

  const finish = async () => {
    if (!uid) return;
    if (!consents.terms || !consents.privacy || !consents.guidelines) return toast.error("Please accept all three to continue.");
    setBusy(true);
    const rows = (["terms", "privacy", "guidelines", "age"] as const).map((policy_type) => ({ user_id: uid, policy_type, policy_version: POLICY_VERSION }));
    await supabase.from("policy_acceptances").upsert(rows, { onConflict: "user_id,policy_type,policy_version", ignoreDuplicates: true });
    await supabase.from("user_preferences").update({ approximate_country: region ? country : null, approximate_region: region, location_enabled: !!region }).eq("user_id", uid);
    if (country) await supabase.from("profiles").update({ country_code: country }).eq("id", uid);
    const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", uid);
    setBusy(false);
    if (error) return toast.error("Couldn't finish setup");
    localStorage.removeItem("jnoy-onb-step");
    await qc.invalidateQueries({ queryKey: ["me"] });
    navigate({ to: "/discover", replace: true });
  };

  if (isLoading) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  const filtered = INTERESTS.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
  const titles = ["Welcome to Jnoy", "Your profile", "Your vibe", "Matching preferences", "Control & consent"];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="text-sm font-bold text-muted-foreground">Step {step + 1} of 5</span>
      </div>
      <Progress value={((step + 1) / 5) * 100} className="mt-5 h-2" />
      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="clay mt-8 flex-1 p-6 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold">{titles[step]}</h1>

          {step === 0 && (
            <div className="mt-5 space-y-5">
              <p className="text-muted-foreground">Jnoy connects you 1:1 with people around the world for spontaneous, friendly conversations. You can't search for people — you're matched by vibe.</p>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface/50 p-4">
                <Checkbox checked={age} onCheckedChange={(v) => setAge(!!v)} className="mt-0.5" />
                <span className="font-semibold">I confirm I am 18 or older.</span>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-4">
                <UserAvatar url={avatarUrl} name={name} className="size-20 text-2xl" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-surface">
                  <Camera className="size-4" /> {avatarPath ? "Replace photo" : "Add photo (optional)"}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              </div>
              <div className="space-y-1.5"><Label htmlFor="dn">Display name</Label><Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="h-12 rounded-2xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="bio">Bio <span className="text-muted-foreground">({bio.length}/160)</span></Label><Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} className="rounded-2xl" rows={3} /></div>
              <div className="space-y-1.5"><Label htmlFor="pn">Pronouns (optional)</Label><Input id="pn" value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={24} className="h-12 rounded-2xl" /></div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-5">
              <p className="text-sm text-muted-foreground">Choose 3–8 interests ({interests.length} selected).</p>
              <div className="relative"><Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search interests" placeholder="Search interests" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 rounded-full pl-10" /></div>
              <div className="flex flex-wrap gap-2">
                {filtered.map((i) => <Chip key={i} label={i} index={INTERESTS.indexOf(i)} selected={interests.includes(i)} onClick={() => setInterests(toggleIn(interests, i, 8))} />)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Your own tags (comma separated, optional)</Label>
                <Input id="tags" placeholder="#kpop, #chess, #backpacking" value={tags} onChange={(e) => setTags(e.target.value)} className="h-12 rounded-2xl" />
                <p className="text-xs text-muted-foreground">Tags help matching. Nobody can search you by them.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-6">
              <div><Label>Conversation languages</Label><div className="mt-2 flex flex-wrap gap-2">{LANGUAGES.map((l, i) => <Chip key={l} label={l} index={i} selected={languages.includes(l)} onClick={() => setLanguages(toggleIn(languages, l, 5))} />)}</div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Your country (server region)</Label>
                  <Select value={country || "none"} onValueChange={(v) => setCountry(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Prefer not to say</SelectItem>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                    <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="video">Video</SelectItem><SelectItem value="audio">Audio only</SelectItem><SelectItem value="text">Text first</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Prefer people from (optional — all countries by default)</Label><div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{COUNTRIES.map((c, i) => <Chip key={c.code} label={`${c.flag} ${c.name}`} index={i} selected={prefCountries.includes(c.code)} onClick={() => setPrefCountries(toggleIn(prefCountries, c.code, 5))} />)}</div></div>
              <label className="flex items-center justify-between rounded-2xl border border-border bg-surface/50 p-4"><span className="font-semibold">Match people with similar interests</span><Switch checked={similar} onCheckedChange={setSimilar} /></label>
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-4">
              {([["terms", "I accept the Terms of use", "/terms"], ["privacy", "I accept the Privacy policy", "/privacy"], ["guidelines", "I'll follow the Community guidelines", "/community-guidelines"]] as const).map(([k, t, href]) => (
                <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface/50 p-4">
                  <Checkbox checked={consents[k]} onCheckedChange={(v) => setConsents({ ...consents, [k]: !!v })} />
                  <span className="flex-1 font-semibold">{t}</span>
                  <a href={href} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary">Read</a>
                </label>
              ))}
              <div className="rounded-2xl bg-aqua/10 p-4 text-sm">
                <p className="font-bold text-aqua">Camera & microphone</p>
                <p className="mt-1 text-muted-foreground">We only ask for access when you press Start. Calls are never recorded.</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="font-bold">Regional suggestions (optional)</p>
                <p className="mt-1 text-sm text-muted-foreground">Stores only your country and a coarse region. Never shown to others.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={locate}><MapPin className="mr-1 size-4" /> Use my approximate location</Button>
                  {region && <span className="self-center text-sm text-mint">✓ {region}</span>}
                </div>
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      <div className="mt-6 flex justify-between gap-3">
        <Button variant="ghost" className="rounded-full" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="mr-1 size-4" /> Back</Button>
        {step < 4 ? (
          <Button onClick={next} disabled={busy} className="h-12 rounded-full px-7 font-bold clay-btn">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Continue <ArrowRight className="ml-1 size-4" /></Button>
        ) : (
          <Button onClick={finish} disabled={busy} className="h-12 rounded-full px-7 font-bold clay-btn">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Start using Jnoy</Button>
        )}
      </div>
    </div>
  );
}
