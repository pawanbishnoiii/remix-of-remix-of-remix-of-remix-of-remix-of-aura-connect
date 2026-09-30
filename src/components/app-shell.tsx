import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Compass, LogOut, MessageCircle, Settings, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAvatar, useMyProfile } from "@/hooks/use-auth";
import { Logo, UserAvatar } from "./brand";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children, requireOnboarding = true }: { children: React.ReactNode; requireOnboarding?: boolean }) {
  const { data: me } = useMyProfile();
  const { data: avatar } = useAvatar(me?.profile?.avatar_url);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (requireOnboarding && me && me.profile && !me.profile.onboarding_completed) navigate({ to: "/onboarding", replace: true });
  }, [me, requireOnboarding, navigate]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar p-5 md:flex">
        <Logo to="/discover" />
        <nav className="mt-10 space-y-1.5">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors", path.startsWith(n.to) ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              <n.icon className="size-5" /> {n.label}
            </Link>
          ))}
          <Link to="/settings" className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors", path.startsWith("/settings") ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
            <Settings className="size-5" /> Settings
          </Link>
          {me?.isStaff && (
            <Link to="/admin" className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors", path.startsWith("/admin") ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              <Shield className="size-5" /> Admin
            </Link>
          )}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-sidebar-accent/50 p-3">
          <UserAvatar url={avatar} name={me?.profile?.display_name} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me?.profile?.display_name ?? "You"}</p>
            <p className="truncate text-xs text-muted-foreground">{me?.user.email}</p>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="rounded-xl p-2 text-muted-foreground hover:bg-background hover:text-foreground"><LogOut className="size-4" /></button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col pb-24 md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-md md:hidden">
          <Logo to="/discover" />
          <div className="flex items-center gap-1">
            {me?.isStaff && <Link to="/admin" aria-label="Admin" className="rounded-xl p-2 text-muted-foreground"><Shield className="size-5" /></Link>}
            <Link to="/settings" aria-label="Settings" className="rounded-xl p-2 text-muted-foreground"><Settings className="size-5" /></Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 rounded-3xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-md md:hidden">
        {nav.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              <n.icon className="size-5" /> {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="clay flex flex-col items-center p-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary"><Icon className="size-6" /></span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
