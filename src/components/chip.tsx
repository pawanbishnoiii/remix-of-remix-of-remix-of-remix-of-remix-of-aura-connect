import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHIP_COLORS } from "@/lib/constants";

export function Chip({
  label,
  selected,
  onClick,
  index = 0,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  index?: number;
}) {
  const color = CHIP_COLORS[index % CHIP_COLORS.length];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-all active:scale-95",
        selected ? color : "border-border bg-surface/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {selected && <Check className="size-3.5" />}
      {label}
    </button>
  );
}

export function Tag({ label, index = 0 }: { label: string; index?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        CHIP_COLORS[index % CHIP_COLORS.length],
      )}
    >
      {label}
    </span>
  );
}

export function toggleIn<T>(arr: T[], v: T, max = 99) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v];
}
