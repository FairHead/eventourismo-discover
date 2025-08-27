-- Create a SECURITY DEFINER helper to break RLS recursion between bands and band_members
create or replace function public.user_can_manage_band(_band_id uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- A user can manage a band if they created it or are admin/manager member
  select exists (
    select 1 from public.bands b
    where b.id = _band_id and b.created_by = _uid
  )
  or exists (
    select 1 from public.band_members m
    where m.band_id = _band_id and m.artist_id = _uid and m.role = any(array['admin','manager'])
  );
$$;

-- Update bands policies to use the helper function (avoids recursive subqueries)
alter table public.bands enable row level security;

drop policy if exists "Band creators and members can manage bands" on public.bands;

create policy "Band creators and members can manage bands"
on public.bands
as permissive
for all
using (public.user_can_manage_band(id, auth.uid()))
with check (public.user_can_manage_band(id, auth.uid()));

-- Keep existing public select policy for active bands (recreate defensively to ensure it's present)
drop policy if exists "Anyone can view active bands" on public.bands;
create policy "Anyone can view active bands"
on public.bands
as permissive
for select
using (active = true);

-- Update band_members policies to use the helper function (remove circular reference to bands)
alter table public.band_members enable row level security;

drop policy if exists "Band admins and managers can manage members" on public.band_members;

create policy "Band admins and managers can manage members"
on public.band_members
as permissive
for all
using (
  public.user_can_manage_band(band_id, auth.uid())
  or artist_id = auth.uid()
)
with check (
  public.user_can_manage_band(band_id, auth.uid())
  or artist_id = auth.uid()
);

-- Preserve existing public select policy on band_members (only active)
drop policy if exists "Anyone can view band members" on public.band_members;
create policy "Anyone can view band members"
on public.band_members
as permissive
for select
using (is_active = true);