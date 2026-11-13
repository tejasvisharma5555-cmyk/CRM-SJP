-- =====================================================================
-- Row-level security: only logged-in members of this business
-- (rows in public.team_members) can read or write anything.
-- Anonymous visitors get nothing — not even the public card view.
-- =====================================================================

-- SECURITY DEFINER so policies can check membership without recursing
-- through team_members' own RLS. search_path pinned against hijacking.
create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.team_members where user_id = auth.uid())
$$;

create or replace function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.team_members where user_id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- Enable + force RLS on every table
-- ---------------------------------------------------------------------
alter table public.team_members        enable row level security;
alter table public.business_settings   enable row level security;
alter table public.contacts            enable row level security;
alter table public.properties          enable row level security;
alter table public.property_photos     enable row level security;
alter table public.property_sources    enable row level security;
alter table public.commissions         enable row level security;
alter table public.commission_payments enable row level security;

alter table public.team_members        force row level security;
alter table public.business_settings   force row level security;
alter table public.contacts            force row level security;
alter table public.properties          force row level security;
alter table public.property_photos     force row level security;
alter table public.property_sources    force row level security;
alter table public.commissions         force row level security;
alter table public.commission_payments force row level security;

-- ---------------------------------------------------------------------
-- Grants: strip the anon role completely; authenticated gets table
-- privileges, but RLS still decides which rows (none unless team member).
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon, public;
revoke all on all functions in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
alter default privileges in schema public revoke all on tables    from anon, public;
alter default privileges in schema public revoke all on functions from anon, public;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.contacts, public.properties, public.property_photos, public.property_sources,
  public.commissions, public.commission_payments
  to authenticated;
grant select on public.team_members to authenticated;
grant select, update on public.business_settings to authenticated;
grant select on public.commission_overview, public.public_property_card to authenticated;

grant execute on function
  public.is_team_member(), public.is_team_admin(),
  public.normalize_in_phone(text), public.norm_key(text), public.plot_key(text),
  public.unit_to_gaj(size_unit),
  public.find_contact_by_phone(text),
  public.find_similar_contacts(text, text, uuid),
  public.find_property_duplicates(text, text, text, numeric, size_unit, numeric, uuid),
  public.contact_commission_summary(uuid)
  to authenticated;
-- trigger functions need no grants (they run as part of the statement)

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------

-- team_members: members can see the team; membership is managed only by
-- the service role / SQL editor (no insert/update/delete policy).
create policy team_members_select on public.team_members
  for select to authenticated using (public.is_team_member());

-- business_settings: everyone on the team reads; only admin edits.
create policy business_settings_select on public.business_settings
  for select to authenticated using (public.is_team_member());
create policy business_settings_update on public.business_settings
  for update to authenticated using (public.is_team_admin()) with check (public.is_team_admin());

-- Business data: full access for team members, nothing for anyone else.
create policy contacts_team on public.contacts
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy properties_team on public.properties
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy property_photos_team on public.property_photos
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy property_sources_team on public.property_sources
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy commissions_team on public.commissions
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());
create policy commission_payments_team on public.commission_payments
  for all to authenticated using (public.is_team_member()) with check (public.is_team_member());

-- Money records are append/correct only by admin: staff may add payments
-- but only the admin can delete a commission or a payment.
create policy commissions_no_staff_delete on public.commissions
  as restrictive for delete to authenticated using (public.is_team_admin());
create policy commission_payments_no_staff_delete on public.commission_payments
  as restrictive for delete to authenticated using (public.is_team_admin());

-- ---------------------------------------------------------------------
-- Storage: private bucket for property photos, team members only.
-- (Shared to WhatsApp by downloading in-app and attaching, never by public URL.)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

create policy property_photos_read on storage.objects
  for select to authenticated using (bucket_id = 'property-photos' and public.is_team_member());
create policy property_photos_write on storage.objects
  for insert to authenticated with check (bucket_id = 'property-photos' and public.is_team_member());
create policy property_photos_update on storage.objects
  for update to authenticated using (bucket_id = 'property-photos' and public.is_team_member());
create policy property_photos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'property-photos' and public.is_team_member());
