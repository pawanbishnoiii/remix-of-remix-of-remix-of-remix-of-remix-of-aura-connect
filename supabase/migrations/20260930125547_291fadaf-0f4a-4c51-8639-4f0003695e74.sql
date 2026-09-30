alter table public.policy_acceptances drop constraint if exists policy_acceptances_policy_type_check;
update public.policy_acceptances set policy_type='age_18' where policy_type='age';
alter table public.policy_acceptances add constraint policy_acceptances_policy_type_check check (policy_type in ('age_18','terms','privacy','guidelines','location'));
alter table public.policy_acceptances add column if not exists source text not null default 'signup';

alter table public.profiles add column if not exists detected_district text;
alter table public.profiles add column if not exists onboarding_seen_at timestamptz;
alter table public.login_visits add column if not exists district text;

create or replace function public.record_policy_acceptance(_uid uuid, _source text)
returns void language sql security definer set search_path=public as $$
  insert into public.policy_acceptances(user_id, policy_type, policy_version, source)
  select _uid, t, '1', left(coalesce(_source,'signup'),20) from unnest(array['age_18','terms','privacy','guidelines','location']) t
  on conflict (user_id, policy_type, policy_version) do nothing;
$$;
revoke execute on function public.record_policy_acceptance(uuid,text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $function$
declare md jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
begin
  insert into public.profiles (id, email, first_name, last_name, display_name, avatar_url, auth_provider)
  values (new.id, new.email,
    left(nullif(coalesce(md->>'given_name', split_part(md->>'full_name',' ',1)),''),30),
    left(nullif(coalesce(md->>'family_name', nullif(substr(md->>'full_name', length(split_part(md->>'full_name',' ',1))+2),'')),''),30),
    left(nullif(coalesce(md->>'given_name', md->>'name', md->>'full_name'),''),40),
    nullif(coalesce(md->>'avatar_url', md->>'picture'),''),
    coalesce(new.raw_app_meta_data->>'provider','email'))
  on conflict (id) do update set email = excluded.email;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if coalesce(md->>'terms_accepted','') = 'true' then
    update public.profiles set terms_accepted_at = now() where id = new.id;
    perform public.record_policy_acceptance(new.id, 'signup');
  end if;
  return new;
end $function$;

create or replace function public.accept_terms()
returns void language plpgsql security definer set search_path=public as $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform public.ensure_my_profile();
  update public.profiles set terms_accepted_at = coalesce(terms_accepted_at, now()) where id = uid;
  perform public.record_policy_acceptance(uid, 'signup');
end $function$;

create or replace function public.mark_onboarding_seen()
returns void language sql security definer set search_path=public as $$
  update public.profiles set onboarding_seen_at = coalesce(onboarding_seen_at, now()) where id = auth.uid();
$$;
grant execute on function public.mark_onboarding_seen() to authenticated;

create or replace function public.admin_user_consents(_user uuid)
returns table(policy_type text, policy_version text, source text, accepted_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Forbidden'; end if;
  return query select a.policy_type, a.policy_version, a.source, a.accepted_at from public.policy_acceptances a where a.user_id=_user order by a.accepted_at desc;
end $$;
grant execute on function public.admin_user_consents(uuid) to authenticated;