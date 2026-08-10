create table if not exists public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text,
  tax_id text,
  billing_email text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_profiles_business_name_length check (business_name is null or char_length(business_name) <= 120),
  constraint billing_profiles_tax_id_length check (tax_id is null or char_length(tax_id) between 3 and 32),
  constraint billing_profiles_email_valid check (
    billing_email is null
    or (char_length(billing_email) <= 180 and billing_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  constraint billing_profiles_address_line1_length check (address_line1 is null or char_length(address_line1) <= 180),
  constraint billing_profiles_address_line2_length check (address_line2 is null or char_length(address_line2) <= 180),
  constraint billing_profiles_postal_code_length check (postal_code is null or char_length(postal_code) <= 24),
  constraint billing_profiles_city_length check (city is null or char_length(city) <= 100),
  constraint billing_profiles_country_length check (country is null or char_length(country) <= 80)
);

create index if not exists billing_profiles_user_idx on public.billing_profiles(user_id);

drop trigger if exists billing_profiles_touch_updated_at on public.billing_profiles;
create trigger billing_profiles_touch_updated_at
before update on public.billing_profiles
for each row execute function public.touch_updated_at();

alter table public.billing_profiles enable row level security;

drop policy if exists "Administrators manage their own billing profile" on public.billing_profiles;
create policy "Administrators manage their own billing profile"
on public.billing_profiles for all
to authenticated
using (user_id = auth.uid() and public.is_gallery_admin())
with check (user_id = auth.uid() and public.is_gallery_admin());

