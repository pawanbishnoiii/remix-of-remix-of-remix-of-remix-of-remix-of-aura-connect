import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function assertAdmin(supabase: unknown, userId: string) {
  // Must call rpc as a method: destructuring detaches `this` and crashes in supabase-js.
  const { data } = await (supabase as { rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => Promise<{ data: boolean | null }> })
    .rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!data) throw new Error('Forbidden');
}

const botInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  age: z.coerce.number().int().min(18).max(99),
  gender: z.enum(['male', 'female', 'other']),
  country_code: z.string().trim().length(2).transform(v => v.toUpperCase()),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  avatar_url: z.string().trim().max(300).optional(),
  bio: z.string().trim().max(300).optional(),
  is_active: z.boolean().default(true),
});

type BotInput = z.infer<typeof botInput>;

const rowFrom = (b: BotInput) => ({
  name: b.name, age: b.age, gender: b.gender, country_code: b.country_code,
  region: b.region || null, city: b.city || null, district: b.district || null,
  tags: b.tags, avatar_url: b.avatar_url || null, bio: b.bio || null, is_active: b.is_active,
});

export const saveBot = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(botInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (data.id) {
      const { data: existing } = await supabaseAdmin.from('bots').select('user_id').eq('id', data.id).maybeSingle();
      const { error } = await supabaseAdmin.from('bots').update(rowFrom(data)).eq('id', data.id);
      if (error) throw new Error(error.message);
      if (existing?.user_id) {
        await supabaseAdmin.from('profiles').update({
          display_name: data.name, first_name: data.name, gender: data.gender, age: data.age,
          country_code: data.country_code, detected_country: data.country_code,
          detected_region: data.region || null, detected_city: data.city || null, detected_district: data.district || null,
          tags: data.tags, avatar_url: data.avatar_url || null, bio: data.bio || null,
        }).eq('id', existing.user_id);
        await supabaseAdmin.from('user_preferences').update({ interests: data.tags, discoverable: data.is_active }).eq('user_id', existing.user_id);
      }
      return { ok: true };
    }
    const { data: row, error } = await supabaseAdmin.from('bots').insert(rowFrom(data)).select('id').single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const deleteBot = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: bot } = await supabaseAdmin.from('bots').select('user_id').eq('id', data.id).maybeSingle();
    if (bot?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(bot.user_id);
      await supabaseAdmin.from('profiles').delete().eq('id', bot.user_id);
    }
    const { error } = await supabaseAdmin.from('bots').delete().eq('id', data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Creates the backing accounts for companions that do not have one yet.
export const seedBots = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: pending } = await supabaseAdmin.from('bots').select('*').is('user_id', null).eq('is_active', true);
    let created = 0; let failed = 0;
    for (const bot of pending || []) {
      try {
        const email = `companion.${bot.id.slice(0, 8)}@jnoy.internal`;
        const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: crypto.randomUUID() + crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: bot.name, name: bot.name, avatar_url: bot.avatar_url || undefined },
        });
        if (error || !user?.user) { failed++; continue; }
        await supabaseAdmin.from('profiles').update({
          display_name: bot.name, first_name: bot.name, gender: bot.gender, age: bot.age,
          country_code: bot.country_code, detected_country: bot.country_code,
          detected_region: bot.region, detected_city: bot.city, detected_district: bot.district,
          tags: bot.tags, avatar_url: bot.avatar_url, bio: bot.bio,
          onboarding_completed: true, terms_accepted_at: new Date().toISOString(),
        }).eq('id', user.user.id);
        await supabaseAdmin.from('user_preferences').update({
          languages: ['English'], interests: bot.tags, discoverable: bot.is_active, auto_next: false,
        }).eq('user_id', user.user.id);
        await supabaseAdmin.from('bots').update({ user_id: user.user.id }).eq('id', bot.id);
        created++;
      } catch { failed++; }
    }
    return { ok: true, created, failed };
  });
