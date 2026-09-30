import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const activitySchema = z.object({ visitId: z.string().uuid().nullable(), end: z.boolean().default(false) });

export const recordActivity = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(activitySchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const request = getRequest();
    // Only use trusted edge headers, never user-provided coordinates or X-Forwarded-For.
    const edgeCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country');
    const country = edgeCountry && /^[A-Z]{2}$/.test(edgeCountry) ? edgeCountry : null;
    const edgeIp = request.headers.get('cf-connecting-ip');
    const ip = edgeIp && /^[\da-f:.]{3,45}$/i.test(edgeIp) ? edgeIp : null;
    const now = new Date().toISOString();
    if (data.visitId) {
      await supabaseAdmin.from('login_visits').update({ last_seen_at: now, ...(data.end ? { ended_at: now } : {}) }).eq('id', data.visitId).eq('user_id', context.userId);
      return { visitId: data.visitId, country };
    }
    const { data: visit, error } = await supabaseAdmin.from('login_visits').insert({ user_id: context.userId, country_code: country, ip_address: ip, started_at: now, last_seen_at: now }).select('id').single();
    if (error) throw new Error('Activity could not be saved');
    return { visitId: visit.id, country };
  });