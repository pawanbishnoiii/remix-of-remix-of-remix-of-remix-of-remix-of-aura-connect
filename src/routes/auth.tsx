import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/brand";
import people from "@/assets/people-cdmx.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "signup" ? ("signup" as const) : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in to Jnoy" },
      { name: "description", content: "Sign in or create your Jnoy account to start meeting new people." },
      { property: "og:title", content: "Sign in to Jnoy" },
      { property: "og:description", content: "Create an account and start a conversation in one tap." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const rules = [
  { t: "At least 8 characters", f: (p: string) => p.length >= 8 },
  { t: "One number", f: (p: string) => /\d/.test(p) },
  { t: "One letter", f: (p: string) => /[a-zA-Z]/.test(p) },
];

async function routeAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: p } = await supabase.from("profiles").select("onboarding_completed").eq("id", data.user.id).maybeSingle();
  navigate({ to: p?.onboarding_completed ? "/discover" : "/onboarding", replace: true });
}

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup" | "reset">(mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "verify" | "reset">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) routeAfterAuth(navigate); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") routeAfterAuth(navigate); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const em = emailSchema.safeParse(email);
    if (!em.success) return setError(em.error.issues[0].message);
    setBusy(true);
    try {
      if (tab === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("reset");
      } else if (tab === "signup") {
        if (!rules.every((r) => r.f(password))) throw new Error("Password doesn't meet the rules yet.");
        const { data, error } = await supabase.auth.signUp({ email: em.data, password, options: { emailRedirectTo: window.location.origin + "/onboarding" } });
        if (error) throw error;
        if (!data.session) setSent("verify");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password });
        if (error) throw new Error(error.message.includes("confirm") ? "Please confirm your email first." : "Email or password is incorrect.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in didn't work. Please try again.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {sent ? (
            <div className="clay p-8 text-center">
              <MailCheck className="mx-auto size-12 text-aqua" />
              <h1 className="mt-4 font-display text-2xl font-extrabold">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {sent === "verify" ? `We sent a confirmation link to ${email}. Click it to activate your account.` : `We sent a password reset link to ${email}.`}
              </p>
              <Button variant="outline" className="mt-6 rounded-full" onClick={() => { setSent(null); setTab("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-4xl font-extrabold">{tab === "signup" ? "Create your account" : tab === "reset" ? "Reset password" : "Welcome back"}</h1>
              <p className="mt-2 text-muted-foreground">{tab === "reset" ? "We'll email you a reset link." : "Meet. Talk. Enjoy the moment."}</p>
              {tab !== "reset" && (
                <Tabs value={tab} onValueChange={(v) => { setTab(v as "signin" | "signup"); setError(null); }} className="mt-6">
                  <TabsList className="grid h-12 w-full grid-cols-2 rounded-full p-1">
                    <TabsTrigger value="signin" className="rounded-full font-bold">Sign in</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-full font-bold">Create account</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" required />
                </div>
                {tab !== "reset" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw">Password</Label>
                      {tab === "signin" && <button type="button" onClick={() => setTab("reset")} className="text-xs font-semibold text-primary">Forgot?</button>}
                    </div>
                    <div className="relative">
                      <Input id="pw" type={show ? "text" : "password"} autoComplete={tab === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl pr-12" required />
                      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {tab === "signup" && (
                      <ul className="grid gap-1 pt-1 text-xs">
                        {rules.map((r) => (
                          <li key={r.t} className={r.f(password) ? "text-mint" : "text-muted-foreground"}>{r.f(password) ? "✓" : "•"} {r.t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {error && <p role="alert" className="rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={busy} className="h-12 w-full rounded-full text-base font-bold clay-btn">
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {tab === "signup" ? "Create account" : tab === "reset" ? "Send reset link" : "Sign in"}
                </Button>
                {tab === "reset" && <Button type="button" variant="ghost" className="w-full rounded-full" onClick={() => setTab("signin")}>Back to sign in</Button>}
              </form>
              {tab !== "reset" && (
                <>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
                  <Button variant="outline" onClick={google} className="h-12 w-full rounded-full font-bold">
                    <svg viewBox="0 0 24 24" className="mr-2 size-4" aria-hidden><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" /></svg>
                    Continue with Google
                  </Button>
                  {tab === "signup" && (
                    <p className="mt-5 text-center text-xs text-muted-foreground">
                      By creating an account you confirm you're 18+ and agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy policy</Link>.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img src={people} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10">
          <p className="font-display text-4xl font-extrabold">Every hello is a tiny trip abroad.</p>
        </div>
      </div>
    </div>
  );
}
