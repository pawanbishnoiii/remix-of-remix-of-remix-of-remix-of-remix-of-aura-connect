import { useState } from 'react';
import { Flag, X } from 'lucide-react';

export const REPORT_CATEGORIES = [
  { id: 'nudity', label: 'Nudity or sexual content' }, { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate speech' }, { id: 'underage', label: 'Looks under 18' },
  { id: 'violence', label: 'Violence or threats' }, { id: 'spam', label: 'Spam or scam' }, { id: 'other', label: 'Something else' },
];

export function ReportDialog({ hasVideo, onCancel, onSubmit }: { hasVideo: boolean; onCancel: () => void; onSubmit: (category: string, note: string) => Promise<void> }) {
  const [cat, setCat] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return <div className="modal-overlay" onClick={onCancel}>
    <div className="auth-modal jn-report" role="dialog" aria-modal="true" aria-label="Report" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <button className="modal-close" onClick={onCancel} aria-label="Close"><X size={20}/></button>
      <h2><Flag size={22}/> Report this person</h2>
      <p>They’ll be blocked and the call ends. {hasVideo ? 'A screenshot of their video and the chat are saved for our safety team only.' : 'The chat is saved for our safety team only.'}</p>
      <div className="jn-report-list">{REPORT_CATEGORIES.map(c => <button type="button" key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.label}</button>)}</div>
      <label>Anything else? <small>optional</small><textarea value={note} maxLength={500} onChange={e => setNote(e.target.value)} rows={3} placeholder="Tell us what happened"/></label>
      <button className="full-primary jn-danger" disabled={!cat || busy} onClick={async () => { setBusy(true); try { await onSubmit(cat, note); } finally { setBusy(false); } }}>{busy ? 'Sending…' : 'Report & block'}</button>
    </div>
  </div>;
}
