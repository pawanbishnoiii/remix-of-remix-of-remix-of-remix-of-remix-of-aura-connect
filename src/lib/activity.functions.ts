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
    const now = new Date().toISOString();
    if (data.visitId) {
      await supabaseAdmin.from('login_visits').update({ last_seen_at: now, ...(data.end ? { ended_at: now } : {}) }).eq('id', data.visitId).eq('user_id', context.userId);
      await supabaseAdmin.from('profiles').update({ last_seen_at: now }).eq('id', context.userId);
      return { visitId: data.visitId, country: null as string | null, city: null as string | null, region: null as string | null, district: null as string | null };
    }
    // Approximate network location (disclosed in Privacy Policy): edge headers first, then IP lookup for district/state.
    const edgeCountry = h.get('cf-ipcountry') || h.get('x-vercel-ip-country');
    const rawIp = h.get('cf-connecting-ip') || h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0]?.trim() || null;
    const ip = rawIp && /^[\da-f:.]{3,45}$/i.test(rawIp) ? rawIp : null;
    const { lookupGeo } = await import('./geo.server');
    const geo = await lookupGeo(ip, {
      country: edgeCountry && /^[A-Z]{2}$/.test(edgeCountry) && edgeCountry !== 'XX' ? edgeCountry : null,
      region: clean(h.get('cf-region') || h.get('x-vercel-ip-country-region')),
      city: clean(h.get('cf-ipcity') || h.get('x-vercel-ip-city')),
      district: null,
    });
    const ua = (h.get('user-agent') || '').slice(0, 400);
    const device = deviceNameFromUA(ua);
    await supabaseAdmin.from('profiles').upsert({ id: context.userId }, { onConflict: 'id', ignoreDuplicates: true });
    await supabaseAdmin.from('user_preferences').upsert({ user_id: context.userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    await supabaseAdmin.from('profiles').update({
      last_ip: ip, last_login_at: now, last_seen_at: now, detected_country: geo.country, detected_region: geo.region, detected_city: geo.city, detected_district: geo.district, device_name: device,
    }).eq('id', context.userId);
    const { data: visit, error } = await supabaseAdmin.from('login_visits').insert({ user_id: context.userId, country_code: geo.country, region: geo.region, city: geo.city, district: geo.district, ip_address: ip, device_name: device, user_agent: ua, started_at: now, last_seen_at: now }).select('id').single();
    if (error) { console.error('login visit insert failed', error.message); return { visitId: null, ...geo }; }
    return { visitId: visit.id, ...geo };
  });

export const exportMyData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase; const uid = context.userId;
    const [profile, prefs, consents, sessions, reports, blocks, visits] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
      sb.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('policy_acceptances').select('policy_type,policy_version,source,accepted_at').eq('user_id', uid),
      sb.from('conversation_sessions').select('id,mode,status,created_at,ended_at').or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`).limit(500),
      sb.from('reports').select('id,category,status,created_at').eq('reporter_id', uid),
      sb.from('user_blocks').select('blocked_id,created_at').eq('blocker_id', uid),
      sb.from('login_visits').select('started_at,ended_at,country_code,region,city,district,device_name').eq('user_id', uid).limit(500),
    ]);
    return JSON.stringify({ exported_at: new Date().toISOString(), profile: profile.data, preferences: prefs.data, consents: consents.data, sessions: sessions.data, reports_filed: reports.data, blocks: blocks.data, login_visits: visits.data }, null, 2);
  });
