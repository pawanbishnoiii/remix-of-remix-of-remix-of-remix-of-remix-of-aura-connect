import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function JnoyMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-grid size-9 place-items-center rounded-2xl bg-brand clay-btn font-display text-lg font-extrabold text-primary-foreground",
        className,
      )}
    >
      J
      <span className="absolute -right-1 -top-1 size-3 rounded-full bg-coral ring-2 ring-background" />
    </span>
  );
}

export function Logo({ to = "/" }: { to?: "/" | "/discover" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Jnoy home">
      <JnoyMark />
      <span className="font-display text-xl font-extrabold tracking-tight">Jnoy</span>
    </Link>
  );
}

export function UserAvatar({
  url,
  name,
  className,
}: {
  url?: string | null;
  name?: string | null;
  className?: string;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const hues = ["bg-primary", "bg-aqua", "bg-coral", "bg-sun", "bg-mint"];
  const hue = hues[(name ?? "").length % hues.length];
  return url ? (
    <img src={url} alt="" className={cn("size-10 rounded-full object-cover", className)} />
  ) : (
    <span
      className={cn(
        "grid size-10 place-items-center rounded-full font-display font-bold text-background",
        hue,
        className,
      )}
    >
      {initial}
    </span>
  );
}
