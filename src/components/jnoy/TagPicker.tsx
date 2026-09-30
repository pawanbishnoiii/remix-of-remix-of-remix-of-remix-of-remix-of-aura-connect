import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { INTERESTS, MAX_TAGS } from '@/lib/jnoy';

export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const toggle = (t: string) => {
    if (value.includes(t)) onChange(value.filter(x => x !== t));
    else if (value.length < MAX_TAGS) onChange([...value, t]);
  };
  const add = () => {
    const t = custom.trim().replace(/[^\p{L}\p{N} &-]/gu, '').slice(0, 30);
    if (!t) return;
    if (!value.some(v => v.toLowerCase() === t.toLowerCase()) && value.length < MAX_TAGS) onChange([...value, t]);
    setCustom('');
  };
  const extra = value.filter(v => !INTERESTS.includes(v));
  return <div className="jn-tags">
    <div className="chips">
      {INTERESTS.map(t => <button type="button" key={t} aria-pressed={value.includes(t)} className={`chip ${value.includes(t) ? 'chosen' : ''}`} onClick={() => toggle(t)}>{t}</button>)}
      {extra.map(t => <button type="button" key={t} className="chip chosen" onClick={() => toggle(t)}>{t} <X size={12}/></button>)}
    </div>
    <div className="jn-tag-add">
      <input value={custom} maxLength={30} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Add your own tag" aria-label="Add your own tag"/>
      <button type="button" onClick={add} aria-label="Add tag"><Plus size={16}/></button>
    </div>
    <small className="jn-muted">{value.length}/{MAX_TAGS} selected · shared tags help us pair you with like-minded people</small>
  </div>;
}
