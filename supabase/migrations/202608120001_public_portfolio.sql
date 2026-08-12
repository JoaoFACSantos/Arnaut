create table if not exists public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint portfolio_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint portfolio_categories_label_length check (char_length(trim(label)) between 2 and 40)
);

create table if not exists public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  source_photo_id uuid references public.album_photos(id) on delete set null,
  source_gallery_id uuid references public.albums(id) on delete set null,
  category_id uuid not null references public.portfolio_categories(id) on delete restrict,
  storage_path text,
  thumbnail_path text,
  web_path text,
  legacy_public_url text,
  alt_text text not null default '',
  focal_x numeric(5,2) not null default 50,
  focal_y numeric(5,2) not null default 50,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint portfolio_photos_has_public_asset check (web_path is not null or legacy_public_url is not null),
  constraint portfolio_photos_web_path check (web_path is null or web_path ~ '^portfolio/[0-9a-f-]+/web\.webp$'),
  constraint portfolio_photos_thumb_path check (thumbnail_path is null or thumbnail_path ~ '^portfolio/[0-9a-f-]+/thumb\.webp$'),
  constraint portfolio_photos_legacy_url check (legacy_public_url is null or legacy_public_url ~ '^assets/portfolio/[a-z0-9-]+\.webp$'),
  constraint portfolio_photos_focal_point check (focal_x between 0 and 100 and focal_y between 0 and 100),
  constraint portfolio_photos_dimensions check ((width is null or width > 0) and (height is null or height > 0)),
  constraint portfolio_photos_size check (size_bytes is null or size_bytes >= 0),
  constraint portfolio_photos_alt_length check (char_length(alt_text) <= 280)
);

create table if not exists public.portfolio_settings (
  id boolean primary key default true check (id),
  max_recent integer not null default 8 check (max_recent between 1 and 24),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_photos_public_order_idx on public.portfolio_photos(is_published, sort_order, created_at);
create index if not exists portfolio_photos_category_idx on public.portfolio_photos(category_id, sort_order);

drop trigger if exists portfolio_photos_touch_updated_at on public.portfolio_photos;
create trigger portfolio_photos_touch_updated_at before update on public.portfolio_photos
for each row execute function public.touch_updated_at();

drop trigger if exists portfolio_settings_touch_updated_at on public.portfolio_settings;
create trigger portfolio_settings_touch_updated_at before update on public.portfolio_settings
for each row execute function public.touch_updated_at();

alter table public.portfolio_categories enable row level security;
alter table public.portfolio_photos enable row level security;
alter table public.portfolio_settings enable row level security;

create policy "Anyone reads enabled portfolio categories" on public.portfolio_categories for select
to anon, authenticated using (enabled or public.is_gallery_admin());
create policy "Administrators manage portfolio categories" on public.portfolio_categories for all
to authenticated using (public.is_gallery_admin()) with check (public.is_gallery_admin());

create policy "Anyone reads published portfolio photos" on public.portfolio_photos for select
to anon, authenticated using (is_published or public.is_gallery_admin());
create policy "Administrators manage portfolio photos" on public.portfolio_photos for all
to authenticated using (public.is_gallery_admin()) with check (public.is_gallery_admin());

create policy "Anyone reads portfolio settings" on public.portfolio_settings for select
to anon, authenticated using (true);
create policy "Administrators manage portfolio settings" on public.portfolio_settings for all
to authenticated using (public.is_gallery_admin()) with check (public.is_gallery_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-portfolio', 'public-portfolio', true, 31457280, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone reads published portfolio derivatives" on storage.objects for select
to anon, authenticated using (bucket_id = 'public-portfolio');
create policy "Administrators upload portfolio derivatives" on storage.objects for insert
to authenticated with check (bucket_id = 'public-portfolio' and public.is_gallery_admin() and name ~ '^portfolio/[0-9a-f-]+/(web|thumb)\.webp$');
create policy "Administrators update portfolio derivatives" on storage.objects for update
to authenticated using (bucket_id = 'public-portfolio' and public.is_gallery_admin())
with check (bucket_id = 'public-portfolio' and public.is_gallery_admin() and name ~ '^portfolio/[0-9a-f-]+/(web|thumb)\.webp$');
create policy "Administrators delete portfolio derivatives" on storage.objects for delete
to authenticated using (bucket_id = 'public-portfolio' and public.is_gallery_admin());

insert into public.portfolio_categories (slug, label, sort_order) values
  ('pessoas', 'Pessoas', 10),
  ('lugares', 'Lugares', 20)
on conflict (slug) do update set label = excluded.label, sort_order = excluded.sort_order, enabled = true;

insert into public.portfolio_settings (id, max_recent) values (true, 8) on conflict (id) do nothing;

insert into public.portfolio_photos (category_id, legacy_public_url, alt_text, is_published, sort_order, width, height)
select category.id, seed.url, seed.alt_text, true, seed.sort_order, seed.width, seed.height
from (values
  ('pessoas', 'assets/portfolio/casal-01.webp', 'Casal a sorrir junto a uma parede de pedra', 10, 2000, 1334),
  ('lugares', 'assets/portfolio/sintra-02.webp', 'Arquitetura histórica e árvores em Sintra', 20, 1365, 1820),
  ('pessoas', 'assets/portfolio/nazare-01.webp', 'Retrato de mulher na praia ao fim da tarde', 30, 1501, 2000),
  ('lugares', 'assets/portfolio/sintra-01.webp', 'Fachada histórica enquadrada por árvores em Sintra', 40, 1820, 1365),
  ('pessoas', 'assets/portfolio/casal-03.webp', 'Casal abraçado num jardim', 50, 1333, 2000),
  ('lugares', 'assets/portfolio/sintra-03.webp', 'Detalhe de arcos neomanuelinos em Sintra', 60, 1365, 1820),
  ('lugares', 'assets/portfolio/nazare-03.webp', 'Vista da praia da Nazaré com papagaios no céu', 70, 1500, 2000),
  ('pessoas', 'assets/portfolio/nazare-04.webp', 'Casal sentado na praia sob papagaios coloridos', 80, 1500, 2000)
) as seed(slug, url, alt_text, sort_order, width, height)
join public.portfolio_categories category on category.slug = seed.slug
where not exists (select 1 from public.portfolio_photos photo where photo.legacy_public_url = seed.url);
