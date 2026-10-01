import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, Bot, Flag, LayoutDashboard, Settings, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Brand } from '@/components/jnoy/Brand';

export const Route = createFileRoute('/admin')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Admin — Jnoy' }, { name: 'description', content: 'Jnoy staff workspace.' }, { name: 'robots', content: 'noindex' }, { property: 'og:title', content: 'Admin — Jnoy' }, { property: 'og:description', content: 'Jnoy staff workspace.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'signed-out'>('loading');
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setState('signed-out'); return; }
      const { data: staff } = await supabase.rpc('is_staff', { _user_id: data.user.id });
      setState(staff ? 'ok' : 'denied');
    });
  }, []);
  if (state !== 'ok') return <div className="jn-admin-gate"><Brand/><h2>{state === 'loading' ? 'Checking access…' : state === 'signed-out' ? 'Please sign in first' : 'Staff access only'}</h2>{state !== 'loading' && <Link to="/" className="full-primary">Back to Jnoy</Link>}</div>;
  const items = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/reports', label: 'Reports', icon: Flag },
    { to: '/admin/bots', label: 'Companions', icon: Bot },
    { to: '/admin/activity', label: 'Activity', icon: Activity },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ] as const;
  return <div className="jn-admin">
    <aside className="jn-admin-side">
      <Brand light/>
      <nav>{items.map(i => <Link key={i.to} to={i.to} activeOptions={{ exact: 'exact' in i }} activeProps={{ className: 'active' }}><i.icon size={17}/> {i.label}</Link>)}</nav>
      <Link to="/" className="jn-admin-back"><ArrowLeft size={15}/> Back to app</Link>
    </aside>
    <main className="jn-admin-main"><Outlet/></main>
  </div>;
}
