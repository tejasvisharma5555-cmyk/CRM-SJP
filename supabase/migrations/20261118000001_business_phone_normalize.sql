-- Normalise the business's public phone in the database too (same rules as contacts),
-- so a number entered via the SQL editor is stored as +91XXXXXXXXXX like everywhere else.
create or replace function public.tg_business_settings_normalize()
returns trigger language plpgsql as $$
begin
  new.public_phone := public.normalize_in_phone(new.public_phone);
  return new;
end $$;

drop trigger if exists business_settings_normalize on public.business_settings;
create trigger business_settings_normalize before insert or update on public.business_settings
  for each row execute function public.tg_business_settings_normalize();
