-- The business is in Hisar, Haryana: make Hisar the default city.
-- (State is implied — every listing is in Haryana — so city stays just "Hisar",
--  which keeps duplicate matching on city consistent.)
alter table public.properties        alter column city         set default 'Hisar';
alter table public.business_settings alter column default_city set default 'Hisar';
