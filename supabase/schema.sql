-- Run this once in the Supabase SQL editor for the Bullyx website project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (organization_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_join_requests enable row level security;

create or replace function public.is_organization_admin(target_organization uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

create or replace function public.can_view_profile(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_user = auth.uid() or exists (
    select 1 from public.organization_join_requests r
    where r.user_id = target_user and r.status = 'pending' and public.is_organization_admin(r.organization_id)
  );
$$;

create policy "profiles visible when relevant" on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy "users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "organizations readable by signed in users" on public.organizations for select to authenticated using (true);
create policy "users create organizations" on public.organizations for insert to authenticated with check (auth.uid() = created_by);
create policy "owners update organizations" on public.organizations for update to authenticated using (created_by = auth.uid());
create policy "memberships readable by signed in users" on public.organization_members for select to authenticated using (true);
create policy "creator adds owner membership" on public.organization_members for insert to authenticated with check (
  (user_id = auth.uid() and role = 'owner' and exists (select 1 from public.organizations o where o.id = organization_id and o.created_by = auth.uid()))
  or public.is_organization_admin(organization_id)
);
create policy "users read relevant join requests" on public.organization_join_requests for select to authenticated using (
  user_id = auth.uid() or public.is_organization_admin(organization_id)
);
create policy "users request membership" on public.organization_join_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "users retry rejected requests" on public.organization_join_requests for update to authenticated using (user_id = auth.uid() and status = 'rejected') with check (user_id = auth.uid() and status = 'pending');
create policy "owners review requests" on public.organization_join_requests for update to authenticated using (
  public.is_organization_admin(organization_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "avatar images are public" on storage.objects for select using (bucket_id = 'avatars');
create policy "users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatar" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
