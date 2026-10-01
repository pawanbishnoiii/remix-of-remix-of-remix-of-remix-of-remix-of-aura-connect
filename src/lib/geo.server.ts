// Approximate network location lookup (disclosed in the Privacy Policy). Never GPS.
export type Geo = { country: string | null; region: string | null; city: string | null; district: string | null };

const clean = (v: unknown, max = 80): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[^\p{L}\p{N} .,'-]/gu, '').trim().slice(0, max);
  return t || null;
};

async function getJson(url: string, ms = 2500): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch { return null; }
}

export async function lookupGeo(ip: string | null, edge: Geo): Promise<Geo> {
  const out: Geo = { ...edge };
  if (!ip) return out;
  const w = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,city,latitude,longitude`);
  if (!w || w['success'] === false) {
    // Second provider keeps location working when the first one is down or rate-limited.
    const alt = await getJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    if (alt && alt['error'] !== true && typeof alt['country_code'] === 'string' && /^[A-Z]{2}$/.test(alt['country_code'] as string)) {
      out.country = out.country || (alt['country_code'] as string);
      out.region = out.region || clean(alt['region']);
      out.city = out.city || clean(alt['city']);
    }
    return out;
  }
  const cc = typeof w['country_code'] === 'string' && /^[A-Z]{2}$/.test(w['country_code']) ? w['country_code'] : null;
  out.country = out.country || cc;
  out.region = out.region || clean(w['region']);
  out.city = out.city || clean(w['city']);
  const lat = Number(w['latitude']); const lon = Number(w['longitude']);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const g = await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const admin = ((g?.['localityInfo'] as { administrative?: { adminLevel?: number; name?: string }[] } | undefined)?.administrative) || [];
    // Level 5 is typically district; level 6 tahsil/sub-district.
    const d = admin.find(a => a.adminLevel === 5) || admin.find(a => a.adminLevel === 6);
    out.district = clean(d?.name) || clean(g?.['city']) || null;
    out.region = out.region || clean(g?.['principalSubdivision']);
    out.city = out.city || clean(g?.['locality']);
  }
  return out;
}
