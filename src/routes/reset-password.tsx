import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password · Jnoy" }, { name: "description", content: "Choose a new password for your Jnoy account." }, { property: "og:title", content: "Reset password · Jnoy" }, { property: "og:description", content: "Choose a new password." }] }),
  component: ResetPage,
});

function ResetPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8 || !/\d/.test(pw)) return toast.error("Use 8+ characters with a number.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("That link may have expired. Request a new one.");
    toast.success("Password updated");
    navigate({ to: "/discover" });
  };
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-5">
      <Logo />
      <form onSubmit={save} className="clay space-y-4 p-7">
        <h1 className="font-display text-2xl font-extrabold">Set a new password</h1>
        <Input type="password" aria-label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12 rounded-2xl" placeholder="New password" />
        <Button disabled={busy} className="h-12 w-full rounded-full font-bold">Save password</Button>
      </form>
    </div>
  );
}
