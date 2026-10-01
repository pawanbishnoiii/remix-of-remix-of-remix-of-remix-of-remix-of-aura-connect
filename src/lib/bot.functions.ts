import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const tickSchema = z.object({ sessionId: z.string().uuid() });

const GREETINGS = [
  'Hey! 👋 How is your day going?',
  'Hi there! Nice to meet you 😄',
  'Hello! How are you doing today?',
  'Hii! What are you up to right now?',
];

const GENERIC = [
  'Haha same 😄',
  'Oh nice! Tell me more.',
  'That is really cool!',
  'Really? Me too!',
  'Sounds fun 😄 What else do you enjoy?',
  'Haha true!',
  'What do you usually do for fun?',
  'Nice! Where are you from?',
  'Haha I like that 😄',
  'Interesting! Do you study or work?',
];

const QUESTION_REPLIES = [
  'Good question! I honestly do not know 😄 What do you think?',
  'Hmm, hard one! What about you?',
  'I would say yes 😄 What do you say?',
];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

// Companion heartbeat: called by the room while a member is chatting with a
// bot companion. Replies to the member's messages and, after a while, ends the
// session so the member keeps meeting new people. Real humans are always
// preferred by the matcher — this only fills quiet moments in text chats.
export const botTick = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator(tickSchema)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: s } = await sb.from('conversation_sessions')
      .select('id,user_a_id,user_b_id,status,created_at')
      .eq('id', data.sessionId).maybeSingle();
    if (!s || (context.userId !== s.user_a_id && context.userId !== s.user_b_id)) return { acted: false as const };
    if (!['created', 'connecting', 'connected'].includes(s.status)) return { acted: false as const };
    const peerId = s.user_a_id === context.userId ? s.user_b_id : s.user_a_id;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: bot } = await supabaseAdmin.from('bots').select('id,user_id,name,tags').eq('user_id', peerId).maybeSingle();
    if (!bot?.user_id) return { acted: false as const };
    const { data: msgs } = await sb.from('session_messages')
      .select('id,sender_id,body,created_at')
      .eq('session_id', s.id).order('created_at', { ascending: true });
    const list = msgs || [];
    const ageSec = (Date.now() - new Date(s.created_at).getTime()) / 1000;
    // After a good while the companion moves on, so auto matching can continue.
    if (list.length >= 6 && ageSec > 120 + list.length * 10 && Math.random() < 0.5) {
      await supabaseAdmin.rpc('bot_end_session', { _session: s.id, _reason: Math.random() < 0.5 ? 'next' : 'left' });
      return { acted: true as const, ended: true as const };
    }
    const last = list[list.length - 1];
    if (last && last.sender_id === bot.user_id) return { acted: false as const };
    if (last && Date.now() - new Date(last.created_at).getTime() < 2500) return { acted: false as const };
    const tags = (bot.tags || []) as string[];
    let reply: string;
    if (!last) reply = pick(GREETINGS);
    else {
      const text = last.body.toLowerCase();
      if (/^(hi+|hello|hey+|hlo|namaste|good (morning|evening|afternoon))\b/.test(text)) reply = pick(GREETINGS);
      else if (text.includes('?')) reply = pick(QUESTION_REPLIES);
      else {
        const shared = tags.find(t => text.includes(t.toLowerCase()));
        reply = shared ? `Oh you like ${shared.toLowerCase()} too? Me as well 😄` : pick(GENERIC);
      }
    }
    const { error } = await supabaseAdmin.from('session_messages').insert({ session_id: s.id, sender_id: bot.user_id, body: reply });
    return { acted: !error as boolean };
  });
