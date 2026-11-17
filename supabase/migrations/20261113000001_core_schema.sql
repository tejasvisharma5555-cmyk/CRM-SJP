-- =====================================================================
-- SJP Property CRM — core schema
-- Single business, small team (father + optional helpers).
-- No owner/broker details are stored as free text on properties:
-- every person is a row in `contacts`, linked by foreign key.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;   -- fuzzy name search / similar-name warning

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type contact_role      as enum ('owner', 'broker', 'buyer');
create type listing_source    as enum ('direct_owner', 'broker');
create type property_type     as enum ('plot', 'house', 'flat', 'shop', 'showroom',
                                       'commercial_plot', 'agri_land', 'warehouse', 'other');
create type property_purpose  as enum ('sale', 'rent');
create type property_status   as enum ('available', 'on_hold', 'sold', 'rented', 'withdrawn');
create type size_unit         as enum ('gaj', 'sq_ft', 'marla', 'kanal', 'acre', 'killa');
create type commission_type   as enum ('direct', 'shared');
create type commission_status as enum ('expected', 'partially_received', 'received', 'written_off');
create type payment_mode      as enum ('cash', 'upi', 'bank', 'cheque');

-- ---------------------------------------------------------------------
-- Helpers (pure functions)
-- ---------------------------------------------------------------------

-- Indian mobile normalisation.
--  "098120 12345" / "+91-98120-12345" / "919812012345" -> "+919812012345"
-- Raises SQLSTATE 22023 'invalid_phone' for anything that is not a
-- 10-digit mobile starting 6-9.
create or replace function public.normalize_in_phone(p text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  d := regexp_replace(p, '[\s\-\.\(\)]', '', 'g');        -- spaces, dashes, dots, brackets
  if    d like '+91%'                         then d := substr(d, 4);
  elsif d like '0091%'                        then d := substr(d, 5);
  elsif length(d) = 12 and d like '91%'       then d := substr(d, 3);
  end if;
  if length(d) = 11 and d like '0%' then d := substr(d, 2); end if;
  if d !~ '^[6-9][0-9]{9}$' then
    raise exception using errcode = '22023', message = 'invalid_phone',
                          detail  = format('Cannot normalise %L to an Indian mobile', p);
  end if;
  return '+91' || d;
end $$;

-- Comparison key for locality / plot no / city: lowercase, alphanumerics only.
-- "Sector-8, Urban Estate" == "sector 8 urban estate"; "Plot No. 12-A" == "plot no 12a"
create or replace function public.norm_key(t text)
returns text language sql immutable as $$
  select coalesce(regexp_replace(lower(t), '[^a-z0-9ऀ-ॿ]', '', 'g'), '')
$$;

-- Plot keys additionally drop "plot", "no", "number", "#" prefixes.
create or replace function public.plot_key(t text)
returns text language sql immutable as $$
  select regexp_replace(public.norm_key(t), '^(plot)?(no|number)?', '')
$$;

-- Area unit -> square yards (gaj). Haryana conventions:
-- 1 marla = 30.25 gaj (272.25 sq ft), 1 kanal = 20 marla, 1 acre = 1 killa = 4840 gaj.
create or replace function public.unit_to_gaj(u size_unit)
returns numeric language sql immutable as $$
  select case u
    when 'gaj'   then 1
    when 'sq_ft' then 1.0 / 9
    when 'marla' then 30.25
    when 'kanal' then 605
    when 'acre'  then 4840
    when 'killa' then 4840
  end::numeric
$$;

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Team / business
-- ---------------------------------------------------------------------

-- Who may use the app. Rows are added by the admin (SQL editor / service role),
-- never through the public API. Public sign-up should be disabled in Supabase Auth.
create table public.team_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null default 'staff' check (role in ('admin', 'staff')),
  created_at   timestamptz not null default now()
);

-- Exactly one row: the business identity used in share messages.
create table public.business_settings (
  id             boolean primary key default true check (id),   -- singleton
  business_name  text not null,
  public_phone   text not null,          -- father's own number, the ONLY phone ever shared
  default_city   text not null default 'Jind',
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contacts (owners, brokers, buyers — one person, many roles)
-- ---------------------------------------------------------------------
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 120),
  phone           text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  alt_phone       text          check (alt_phone ~ '^\+91[6-9][0-9]{9}$'),
  city            text,
  area            text,                           -- colony / sector / village
  area_key        text generated always as (public.norm_key(area)) stored,
  roles           contact_role[] not null check (cardinality(roles) >= 1),
  notes           text,                           -- PRIVATE, never shared
  listings_count  integer not null default 0,     -- maintained by trigger on property_sources
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint contacts_phone_key unique (phone)
);

create index contacts_name_trgm_idx  on public.contacts using gin (name extensions.gin_trgm_ops);
create index contacts_phone_trgm_idx on public.contacts using gin (phone extensions.gin_trgm_ops);
create index contacts_alt_phone_idx  on public.contacts (alt_phone) where alt_phone is not null;
create index contacts_roles_idx      on public.contacts using gin (roles);
create index contacts_listings_idx   on public.contacts (listings_count desc, name);

-- Normalise phones, trim name, de-duplicate roles. Runs on every write,
-- so even a raw SQL/API insert cannot store a badly formatted number.
create or replace function public.tg_contacts_normalize()
returns trigger language plpgsql as $$
begin
  new.name      := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.phone     := public.normalize_in_phone(new.phone);
  new.alt_phone := public.normalize_in_phone(new.alt_phone);
  if new.alt_phone = new.phone then new.alt_phone := null; end if;
  new.roles     := array(select distinct r from unnest(new.roles) r order by r);
  return new;
end $$;

create trigger contacts_normalize before insert or update on public.contacts
  for each row execute function public.tg_contacts_normalize();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------
create table public.properties (
  id                uuid primary key default gen_random_uuid(),
  property_type     property_type    not null,
  purpose           property_purpose not null default 'sale',
  status            property_status  not null default 'available',

  city              text not null default 'Jind',
  locality          text not null,               -- sector / colony, e.g. "Urban Estate Sector 8"
  plot_no           text,                        -- PRIVATE by default (share toggle)
  size_value        numeric(12,2) check (size_value > 0),
  size_unit         size_unit not null default 'gaj',
  price             numeric(14,0) check (price > 0),   -- total ₹ asked (sale) or ₹/month (rent)
  price_negotiable  boolean not null default true,
  facing            text,                        -- east / west / north / south / corner
  road_width_ft     integer check (road_width_ft > 0),

  listing_source    listing_source not null,
  source_contact_id uuid not null references public.contacts(id) on delete restrict,
  owner_contact_id  uuid          references public.contacts(id) on delete restrict, -- null = owner unknown
  received_date     date not null default current_date,
  notes             text,                        -- PRIVATE

  -- derived keys for duplicate detection
  city_key          text    generated always as (public.norm_key(city))     stored,
  locality_key      text    generated always as (public.norm_key(locality)) stored,
  plot_key          text    generated always as (public.plot_key(plot_no))  stored,
  size_gaj          numeric generated always as (size_value * public.unit_to_gaj(size_unit)) stored,

  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index properties_status_idx    on public.properties (status, received_date desc);
create index properties_source_idx    on public.properties (listing_source);
create index properties_src_contact   on public.properties (source_contact_id);
create index properties_owner_contact on public.properties (owner_contact_id);
create index properties_dup_plot_idx  on public.properties (city_key, locality_key, plot_key)
  where status in ('available', 'on_hold');
create index properties_dup_size_idx  on public.properties (city_key, locality_key, size_gaj)
  where status in ('available', 'on_hold');
create index properties_locality_trgm on public.properties using gin (locality extensions.gin_trgm_ops);

-- Direct-owner listings: the person who gave it IS the owner.
create or replace function public.tg_properties_owner()
returns trigger language plpgsql as $$
begin
  new.locality := btrim(new.locality);
  new.city     := btrim(new.city);
  if new.listing_source = 'direct_owner' then
    new.owner_contact_id := new.source_contact_id;
  end if;
  return new;
end $$;

create trigger properties_owner before insert or update on public.properties
  for each row execute function public.tg_properties_owner();
create trigger properties_updated_at before update on public.properties
  for each row execute function public.tg_set_updated_at();

-- Photos (files live in the private storage bucket `property-photos`).
create table public.property_photos (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  storage_path text not null unique,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index property_photos_prop_idx on public.property_photos (property_id, sort_order);

-- ---------------------------------------------------------------------
-- Property sources: who supplied each listing.
-- The same plot often comes from two or three brokers — each gets a row here
-- against ONE property. The primary row mirrors properties.source_contact_id
-- and is kept in sync by trigger.
-- ---------------------------------------------------------------------
create table public.property_sources (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties(id) on delete cascade,
  contact_id     uuid not null references public.contacts(id)  on delete restrict,
  listing_source listing_source not null,
  is_primary     boolean not null default false,
  received_date  date not null default current_date,
  quoted_price   numeric(14,0) check (quoted_price > 0),   -- this broker's quote, if different
  created_at     timestamptz not null default now(),
  unique (property_id, contact_id)
);
create unique index property_sources_one_primary on public.property_sources (property_id) where is_primary;
create index property_sources_contact_idx on public.property_sources (contact_id, received_date desc);

-- Keep primary source row in sync with properties.source_contact_id.
create or replace function public.tg_properties_sync_source()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.source_contact_id is not distinct from new.source_contact_id
     and old.listing_source = new.listing_source
     and old.received_date = new.received_date then
    return new;
  end if;

  -- drop the old primary if the source person changed
  delete from public.property_sources
   where property_id = new.id and is_primary and contact_id <> new.source_contact_id;

  insert into public.property_sources (property_id, contact_id, listing_source, is_primary, received_date)
  values (new.id, new.source_contact_id, new.listing_source, true, new.received_date)
  on conflict (property_id, contact_id) do update
     set is_primary = true, listing_source = excluded.listing_source, received_date = excluded.received_date;
  return new;
end $$;

create trigger properties_sync_source after insert or update on public.properties
  for each row execute function public.tg_properties_sync_source();

-- Auto-tag roles (a broker who gives a listing gets the 'broker' role, an owner
-- gets 'owner') and maintain contacts.listings_count for fast "most listings" sort.
create or replace function public.tg_property_sources_counts()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.contacts c
       set roles = case when (case new.listing_source when 'broker' then 'broker' else 'owner' end)::contact_role = any (c.roles)
                        then c.roles
                        else c.roles || (case new.listing_source when 'broker' then 'broker' else 'owner' end)::contact_role end,
           listings_count = (select count(*) from public.property_sources s where s.contact_id = c.id)
     where c.id = new.contact_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update public.contacts c
       set listings_count = (select count(*) from public.property_sources s where s.contact_id = c.id)
     where c.id = old.contact_id;
  end if;
  return null;
end $$;

create trigger property_sources_counts after insert or update or delete on public.property_sources
  for each row execute function public.tg_property_sources_counts();

-- Owner of a broker listing (when known) gets the 'owner' role.
create or replace function public.tg_properties_owner_role()
returns trigger language plpgsql as $$
begin
  if new.owner_contact_id is not null then
    update public.contacts
       set roles = roles || 'owner'::contact_role
     where id = new.owner_contact_id and not ('owner' = any (roles));
  end if;
  return null;
end $$;

create trigger properties_owner_role after insert or update of owner_contact_id on public.properties
  for each row execute function public.tg_properties_owner_role();

-- ---------------------------------------------------------------------
-- Commissions (one per property deal) and payments
-- ---------------------------------------------------------------------
create table public.commissions (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid not null unique references public.properties(id) on delete restrict,
  type                   commission_type not null default 'direct',
  shared_with_contact_id uuid references public.contacts(id) on delete restrict,
  buyer_contact_id       uuid references public.contacts(id) on delete set null,
  deal_amount            numeric(14,0) check (deal_amount > 0),      -- final sale/rent value
  our_share_percent      numeric(5,2)  check (our_share_percent > 0 and our_share_percent <= 100),
  our_share_amount       numeric(14,2) check (our_share_amount  > 0),
  expected_amount        numeric(14,2) not null check (expected_amount >= 0),
  status                 commission_status not null default 'expected',
  deal_date              date not null default current_date,
  notes                  text,                                        -- PRIVATE
  created_by             uuid default auth.uid() references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint commissions_shared_needs_contact
    check ((type = 'shared') = (shared_with_contact_id is not null)),
  constraint commissions_one_share_basis
    check (our_share_percent is null or our_share_amount is null)
);
create index commissions_status_idx on public.commissions (status);
create index commissions_shared_idx on public.commissions (shared_with_contact_id);

create table public.commission_payments (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  paid_on       date not null default current_date,
  mode          payment_mode not null default 'cash',
  note          text,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index commission_payments_cid_idx on public.commission_payments (commission_id, paid_on desc);

-- Status is derived from payments (never typed), except 'written_off' which is
-- a manual decision. Setting any other status re-derives it.
create or replace function public.tg_commissions_status()
returns trigger language plpgsql as $$
declare received numeric;
begin
  if new.status = 'written_off' then return new; end if;
  select coalesce(sum(amount), 0) into received
    from public.commission_payments where commission_id = new.id;
  new.status := case
    when received <= 0                  then 'expected'
    when received < new.expected_amount then 'partially_received'
    else                                     'received'
  end;
  return new;
end $$;

create trigger commissions_status before insert or update on public.commissions
  for each row execute function public.tg_commissions_status();
create trigger commissions_updated_at before update on public.commissions
  for each row execute function public.tg_set_updated_at();

-- Any payment change touches the parent, which re-derives status.
create or replace function public.tg_payments_touch_commission()
returns trigger language plpgsql as $$
begin
  update public.commissions set updated_at = now()
   where id in (coalesce(new.commission_id, old.commission_id), coalesce(old.commission_id, new.commission_id));
  return null;
end $$;

create trigger payments_touch after insert or update or delete on public.commission_payments
  for each row execute function public.tg_payments_touch_commission();

-- ---------------------------------------------------------------------
-- Views (security_invoker => caller's RLS applies)
-- ---------------------------------------------------------------------

-- received / pending are COMPUTED here, never stored or typed.
create view public.commission_overview with (security_invoker = true) as
select c.id,
       c.property_id,
       c.type,
       c.shared_with_contact_id,
       sw.name                                   as shared_with_name,
       c.buyer_contact_id,
       c.deal_amount,
       c.our_share_percent,
       c.our_share_amount,
       c.expected_amount,
       coalesce(p.received, 0)                   as received_amount,
       c.expected_amount - coalesce(p.received, 0) as pending_amount,
       c.status,
       c.deal_date,
       p.last_paid_on,
       coalesce(p.payments_count, 0)             as payments_count,
       pr.property_type,
       pr.locality,
       pr.city,
       pr.plot_no,
       pr.size_value,
       pr.size_unit
  from public.commissions c
  join public.properties pr on pr.id = c.property_id
  left join public.contacts sw on sw.id = c.shared_with_contact_id
  left join lateral (
        select sum(amount) as received, max(paid_on) as last_paid_on, count(*) as payments_count
          from public.commission_payments cp where cp.commission_id = c.id
  ) p on true;

-- THE ONLY source for WhatsApp/share. Contains no owner/broker identity,
-- no phones other than the business's own, no commission, no notes.
-- plot_no is present only so the share screen can include it when the user
-- explicitly turns the "show plot no." toggle on (default off).
create view public.public_property_card with (security_invoker = true) as
select pr.id,
       pr.property_type,
       pr.purpose,
       pr.city,
       pr.locality,
       pr.plot_no,
       pr.size_value,
       pr.size_unit,
       pr.price,
       pr.price_negotiable,
       pr.status,
       coalesce((select array_agg(ph.storage_path order by ph.sort_order, ph.created_at)
                   from public.property_photos ph where ph.property_id = pr.id), '{}') as photo_paths,
       bs.business_name,
       bs.public_phone
  from public.properties pr
  cross join public.business_settings bs
 where pr.status in ('available', 'on_hold');

-- ---------------------------------------------------------------------
-- RPCs used by the app (security invoker => RLS applies)
-- ---------------------------------------------------------------------

-- Exact duplicate by phone (checks main + alt phone). Returns the existing contact.
create or replace function public.find_contact_by_phone(p_phone text)
returns setof public.contacts language sql stable as $$
  select * from public.contacts
   where phone = public.normalize_in_phone(p_phone)
      or alt_phone = public.normalize_in_phone(p_phone)
   limit 1
$$;

-- "Very similar name in the same area" warning (Ramesh Kumar vs Ramesh Kumaar, same area).
create or replace function public.find_similar_contacts(p_name text, p_area text, p_exclude uuid default null)
returns table (id uuid, name text, phone text, area text, roles contact_role[], score real)
language sql stable as $$
  select c.id, c.name, c.phone, c.area, c.roles, extensions.similarity(c.name, p_name) as score
    from public.contacts c
   where c.area_key = public.norm_key(p_area)
     and public.norm_key(p_area) <> ''
     and extensions.similarity(c.name, p_name) >= 0.45
     and (p_exclude is null or c.id <> p_exclude)
   order by score desc
   limit 5
$$;

-- Possible duplicate listing (warn, never block). Matches active listings on
--  (a) same city + locality + plot no, OR
--  (b) same city + locality + same size (±1%) + price within 5%.
create or replace function public.find_property_duplicates(
  p_city text, p_locality text, p_plot_no text,
  p_size_value numeric, p_size_unit size_unit, p_price numeric,
  p_exclude uuid default null)
returns table (id uuid, match_reason text, property_type property_type, locality text,
               plot_no text, size_value numeric, size_unit size_unit, price numeric,
               received_date date, source_names text[])
language sql stable as $$
  with q as (
    select public.norm_key(p_city)      as city_key,
           public.norm_key(p_locality)  as locality_key,
           public.plot_key(p_plot_no)   as plot_key,
           p_size_value * public.unit_to_gaj(p_size_unit) as size_gaj
  )
  select pr.id,
         case when q.plot_key <> '' and pr.plot_key = q.plot_key then 'same_plot' else 'same_size_price' end,
         pr.property_type, pr.locality, pr.plot_no, pr.size_value, pr.size_unit, pr.price,
         pr.received_date,
         array(select c.name from public.property_sources s join public.contacts c on c.id = s.contact_id
                where s.property_id = pr.id order by s.is_primary desc, s.received_date)
    from public.properties pr, q
   where pr.status in ('available', 'on_hold')
     and (p_exclude is null or pr.id <> p_exclude)
     and pr.city_key = q.city_key
     and pr.locality_key = q.locality_key
     and (
          (q.plot_key <> '' and pr.plot_key = q.plot_key)
       or (q.size_gaj is not null and p_price is not null and pr.price is not null
           and abs(pr.size_gaj - q.size_gaj) <= q.size_gaj * 0.01
           and abs(pr.price - p_price) <= p_price * 0.05)
     )
   order by 2, pr.received_date desc
   limit 5
$$;

-- Commission summary with one contact: deals where we share with them,
-- or where the property came from / belongs to them, or they bought.
create or replace function public.contact_commission_summary(p_contact uuid)
returns table (deals bigint, expected numeric, received numeric, pending numeric)
language sql stable as $$
  select count(*),
         coalesce(sum(o.expected_amount), 0),
         coalesce(sum(o.received_amount), 0),
         coalesce(sum(o.pending_amount) filter (where o.status <> 'written_off'), 0)
    from public.commission_overview o
   where o.shared_with_contact_id = p_contact
      or o.buyer_contact_id = p_contact
      or exists (select 1 from public.property_sources s
                  where s.property_id = o.property_id and s.contact_id = p_contact)
      or exists (select 1 from public.properties pr
                  where pr.id = o.property_id and pr.owner_contact_id = p_contact)
$$;
