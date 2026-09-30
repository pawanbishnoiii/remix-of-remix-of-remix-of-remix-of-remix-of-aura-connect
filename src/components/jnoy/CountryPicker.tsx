import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { COUNTRIES } from '@/lib/jnoy';

export function CountryPicker({ value, onChange, max = 5 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return COUNTRIES.filter(c => !t || c.label.toLowerCase().includes(t) || c.code.toLowerCase() === t || c.flag === t);
  }, [q]);
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter(c => c !== code) : value.length < max ? [...value, code] : value);
  return <div className="jn-cpick">
    {value.length > 0 && <div className="jn-cchips">{value.map(code => { const c = COUNTRIES.find(x => x.code === code); return <button type="button" key={code} className="jn-cchip" onClick={() => toggle(code)} aria-label={`Remove ${c?.label || code}`}>{c?.flag} {c?.label || code} <X size={12}/></button>; })}</div>}
    <label className="jn-csearch"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search countries…" aria-label="Search countries"/></label>
    <div className="jn-clist" role="listbox" aria-multiselectable="true">
      {list.length ? list.map(c => <button type="button" role="option" aria-selected={value.includes(c.code)} key={c.code} className={value.includes(c.code) ? 'on' : ''} onClick={() => toggle(c.code)}><span>{c.flag}</span>{c.label}</button>)
        : <p className="jn-muted">No country matches “{q}”.</p>}
    </div>
    <small className="jn-muted">{value.length ? `${value.length}/${max} selected` : 'No countries picked — nearby first, then worldwide.'}</small>
  </div>;
}
