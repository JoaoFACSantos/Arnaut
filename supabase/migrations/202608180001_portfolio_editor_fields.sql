alter table public.portfolio_photos
  add column if not exists internal_title text,
  add column if not exists is_featured boolean not null default false;

alter table public.portfolio_photos
  drop constraint if exists portfolio_photos_internal_title_length;

alter table public.portfolio_photos
  add constraint portfolio_photos_internal_title_length
  check (internal_title is null or char_length(trim(internal_title)) between 1 and 120);

create index if not exists portfolio_photos_featured_order_idx
  on public.portfolio_photos(is_published, is_featured desc, sort_order, created_at);
