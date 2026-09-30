import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "./brand";
import { useUser } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user } = useUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex">
          <a href="/#features" className="hover:text-foreground">Features</a>
          <Link to="/safety" className="hover:text-foreground">Safety</Link>
          <Link to="/help" className="hover:text-foreground">Help</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild className="rounded-full clay-btn">
              <Link to="/discover">Open Jnoy</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild className="rounded-full clay-btn">
                <Link to="/auth" search={{ mode: "signup" }}>Start meeting</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">Meet. Talk. Enjoy the moment.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold">Product</p>
          <a href="/#features" className="block text-muted-foreground hover:text-foreground">Features</a>
          <Link to="/help" className="block text-muted-foreground hover:text-foreground">Help</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold">Safety</p>
          <Link to="/safety" className="block text-muted-foreground hover:text-foreground">Safety center</Link>
          <Link to="/community-guidelines" className="block text-muted-foreground hover:text-foreground">Community guidelines</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-bold">Legal</p>
          <Link to="/terms" className="block text-muted-foreground hover:text-foreground">Terms of use</Link>
          <Link to="/privacy" className="block text-muted-foreground hover:text-foreground">Privacy policy</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Jnoy · 18+ only</p>
    </footer>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14">
        <p className="mb-3 inline-block rounded-full bg-sun/15 px-3 py-1 text-xs font-bold text-sun">
          Starter content — owner legal review required before launch
        </p>
        <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>}
        <div className="prose-jnoy mt-10 space-y-6 text-base leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
