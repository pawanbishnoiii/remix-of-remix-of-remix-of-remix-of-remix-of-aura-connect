export const INTERESTS = [
  "Music", "Movies", "Gaming", "Study", "Travel", "Fitness", "Business", "Tech",
  "Art", "Food", "Sports", "Language practice", "Books", "Memes", "Photography", "Other",
] as const;

export const LANGUAGES = [
  "English", "Hindi", "Spanish", "French", "German", "Portuguese", "Arabic", "Bengali",
  "Japanese", "Korean", "Mandarin", "Russian", "Turkish", "Italian", "Indonesian", "Urdu",
] as const;

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
];

export const countryName = (code?: string | null) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? null;
export const countryFlag = (code?: string | null) =>
  COUNTRIES.find((c) => c.code === code)?.flag ?? "🌍";

export const REPORT_CATEGORIES = [
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "harassment", label: "Harassment or threats" },
  { value: "hate", label: "Hate speech" },
  { value: "minor", label: "Appears under 18" },
  { value: "scam", label: "Scam or spam" },
  { value: "violence", label: "Violence or self-harm" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Something else" },
] as const;

export const STARTERS = [
  "What made you smile today?",
  "Pick a city you want to visit",
  "What are you learning right now?",
];

export const CHIP_COLORS = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-aqua/15 text-aqua border-aqua/30",
  "bg-coral/15 text-coral border-coral/30",
  "bg-sun/15 text-sun border-sun/30",
  "bg-mint/15 text-mint border-mint/30",
];

export const POLICY_VERSION = "2026-09";
export type Mode = "video" | "audio" | "text";
