// Human-readable device name derived from the browser user agent (disclosed in the Privacy Policy).
export function deviceNameFromUA(ua: string): string {
  const s = ua || '';
  let os = 'Unknown OS';
  if (/iPhone/i.test(s)) os = 'iPhone';
  else if (/iPad/i.test(s)) os = 'iPad';
  else if (/Android/i.test(s)) {
    const m = s.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
    os = m?.[1] ? `Android · ${m[1].trim()}` : 'Android';
  } else if (/Windows NT/i.test(s)) os = 'Windows PC';
  else if (/Mac OS X/i.test(s)) os = 'Mac';
  else if (/CrOS/i.test(s)) os = 'Chromebook';
  else if (/Linux/i.test(s)) os = 'Linux PC';
  let browser = 'Browser';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\//.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Chrome\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';
  return `${os} · ${browser}`.slice(0, 80);
}

export const isMobileDevice = () =>
  typeof window !== 'undefined' &&
  (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer:coarse)').matches);
