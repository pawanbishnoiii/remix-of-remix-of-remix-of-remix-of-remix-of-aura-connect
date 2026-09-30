import { supabase } from '@/integrations/supabase/client';
import type { Session } from './jnoy';

export type SearchRequest = { mode: string; snapshot: Record<string, unknown> };

type State = { searching: boolean; began: number; matched: Session | null; error: string | null };

const state: State = { searching: false, began: 0, matched: null, error: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let request: SearchRequest | null = null;
let runId = 0;

const emit = () => listeners.forEach(l => l());
const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

async function pollOnce() {
  const id = runId;
  const { data, error } = await supabase.rpc('find_or_create_match');
  if (id !== runId || !state.searching) return;
  if (error) { state.searching = false; state.error = error.message; clearTimer(); emit(); return; }
  const r = data as { status?: string; session_id?: string } | null;
  if (r?.status === 'matched' && r.session_id) {
    const { data: s } = await supabase.from('conversation_sessions').select('*').eq('id', r.session_id).maybeSingle();
    if (s) { state.searching = false; state.matched = s; clearTimer(); emit(); return; }
  }
  if (r?.status === 'idle' && request) void supabase.rpc('join_match_queue', { _mode: request.mode, _snapshot: request.snapshot }).catch(() => {});
  timer = setTimeout(() => { void pollOnce(); }, 1500);
}

// Module-level store so a running search survives navigating between
// sections and routes: the queue heartbeat keeps ticking even when the
// Discover stage is unmounted, and coming back resumes the same search.
export const searchStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get searching() { return state.searching; },
  get waited() { return state.searching ? Math.round((Date.now() - state.began) / 1000) : 0; },
  get matched() { return state.matched; },
  get error() { return state.error; },
  clearMatched() { if (state.matched) { state.matched = null; emit(); } },
  clearError() { if (state.error) { state.error = null; emit(); } },
  start(req: SearchRequest) {
    if (state.searching) return;
    runId++;
    state.error = null;
    state.searching = true;
    state.began = Date.now();
    request = req;
    emit();
    void supabase.rpc('join_match_queue', { _mode: req.mode, _snapshot: req.snapshot }).catch(() => {});
    void pollOnce();
  },
  stop() {
    runId++;
    state.searching = false;
    request = null;
    clearTimer();
    emit();
    void supabase.rpc('leave_match_queue').catch(() => {});
  },
  // Adopt a queue row that is still waiting (e.g. after a page reload) so the
  // same search continues instead of silently vanishing.
  async resume(userId: string) {
    if (state.searching) return;
    const { data: row } = await supabase.from('match_queue')
      .select('desired_mode,preference_snapshot,queued_at')
      .eq('user_id', userId).eq('status', 'waiting')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!row || state.searching) return;
    const pref = (row.preference_snapshot || {}) as Record<string, unknown>;
    request = { mode: row.desired_mode || 'video', snapshot: pref };
    state.error = null;
    state.searching = true;
    state.began = new Date(row.queued_at).getTime();
    emit();
    void pollOnce();
  },
};
