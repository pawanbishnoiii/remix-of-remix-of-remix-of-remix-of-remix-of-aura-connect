import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { deviceNameFromUA } from './device';

const activitySchema = z.object({ visitId: z.string().uuid().nullable(), end: z.boolean().default(false) });

const clean = (v: string | null, max = 80) => {
  if (!v) return null;
  try { v = decodeURIComponent(v); } catch { /* keep raw */ }
  const t = v.replace(/[^\p{L}\p{N} .,'-]/gu, '').trim().slice(0, max);
  return t || null;
};

export const recordActivity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(activitySchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const request = getRequest();
    const h = request.headers;
    // Approximate network location from trusted edge headers only (disclosed in Privacy Policy).
    const edgeCountry = h.get('cf-ipcountry') || h.get('x-vercel-ip-country');
    const country = edgeCountry && /^[A-Z]{2}$/.test(edgeCountry) ? edgeCountry : null;
    const region = clean(h.get('cf-region') || h.get('x-vercel-ip-country-region'));
    const city = clean(h.get('cf-ipcity') || h.get('x-vercel-ip-city'));
    const edgeIp = h.get('cf-connecting-ip');
    const ip = edgeIp && /^[\da-f:.]{3,45}$/i.test(edgeIp) ? edgeIp : null;
    const ua = (h.get('user-agent') || '').slice(0, 400);
    const device = deviceNameFromUA(ua);
    const now = new Date().toISOString();
    if (data.visitId) {
      await supabaseAdmin.from('login_visits').update({ last_seen_at: now, ...(data.end ? { ended_at: now } : {}) }).eq('id', data.visitId).eq('user_id', context.userId);
      await supabaseAdmin.from('profiles').update({ last_seen_at: now }).eq('id', context.userId);
      return { visitId: data.visitId, country, city };
    }
    await supabaseAdmin.from('profiles').upsert({ id: context.userId }, { onConflict: 'id', ignoreDuplicates: true });
    await supabaseAdmin.from('user_preferences').upsert({ user_id: context.userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    const { data: prof } = await supabaseAdmin.from('profiles').select('country_code').eq('id', context.userId).maybeSingle();
    await supabaseAdmin.from('profiles').update({
      last_ip: ip, last_login_at: now, last_seen_at: now, detected_country: country, detected_region: region, detected_city: city, device_name: device,
      ...(country && !prof?.country_code ? { country_code: country } : {}),
    }).eq('id', context.userId);
    const { data: visit, error } = await supabaseAdmin.from('login_visits').insert({ user_id: context.userId, country_code: country, region, city, ip_address: ip, device_name: device, user_agent: ua, started_at: now, last_seen_at: now }).select('id').single();
    if (error) { console.error('login visit insert failed', error.message); return { visitId: null, country, city }; }
    return { visitId: visit.id, country, city };
  });
