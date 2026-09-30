import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { getData } from 'country-list';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Prefs = Database['public']['Tables']['user_preferences']['Row'];
export type Session = Database['public']['Tables']['conversation_sessions']['Row'];
export type Msg = Database['public']['Tables']['session_messages']['Row'];
export type Mode = 'video' | 'audio' | 'text';

export const COUNTRIES = getData().map(({ code, name }) => ({
  code, label: name, flag: [...code].map(char => String.fromCodePoint(char.charCodeAt(0) + 127397)).join(''),
}));
export const LANGUAGES = ['English', 'Hindi', 'Urdu', 'Bengali', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Japanese', 'Korean', 'Indonesian', 'Turkish', 'Russian', 'Italian'];
export const INTERESTS = ['Travel', 'Music', 'Art', 'Food', 'Books', 'Gaming', 'Culture', 'Movies', 'Nature', 'Design', 'Photography', 'Language', 'Fitness', 'Tech', 'Anime', 'Cricket', 'Football', 'Coding'];
export const MAX_TAGS = 12;

export const authSchema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8).max(128) });
export const onboardingSchema = z.object({
  first: z.string().trim().min(1, 'Enter your first name').max(30),
  last: z.string().trim().min(1, 'Enter your last name').max(30),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Choose your gender' }) }),
  age: z.coerce.number().int('Enter your age').min(18, 'You must be 18 or older').max(100, 'Enter a real age'),
  country: z.string().regex(/^[A-Z]{2}$/, 'Choose your country'),
  language: z.string().min(1, 'Choose a language'),
  tags: z.array(z.string().trim().min(1).max(30)).max(MAX_TAGS),
});

const WORD_DIGITS = /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine|shunya|ek|do|teen|char|panch|chhe|saat|aath|nau)\b/gi;
export const normalizeForContact = (v: string) =>
  v.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(WORD_DIGITS, '0');
export const messageSchema = z.string().trim().min(1).max(2000).refine(
  v => !/(\+?\d[^\d]{0,3}){7,}|whatsapp|telegram|signal\.me|t\.me|instagram|snapchat|@[a-z0-9_]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(normalizeForContact(v)),
  'Contact details cannot be shared here',
);
export const countryLabel = (code?: string | null) => COUNTRIES.find(c => c.code === code)?.label ?? (code || 'Worldwide');
export const countryFlag = (code?: string | null) => COUNTRIES.find(c => c.code === code)?.flag ?? '🌍';
export const TERMS_FLAG = 'jnoy_terms_ok';
