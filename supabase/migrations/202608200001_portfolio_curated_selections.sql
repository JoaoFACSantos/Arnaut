-- Curadoria pública do Portefólio: biblioteca ilimitada, até 5 categorias e
-- seleções independentes de até 8 fotografias em "Todos" e em cada categoria.

alter table public.portfolio_photos
  add column if not exists show_in_all boolean not null default false,
  add column if not exists all_sort_order integer,
  add column if not exists show_in_category boolean not null default false,
  add column if not exists category_sort_order integer;

alter table public.portfolio_categories drop constraint if exists portfolio_categories_label_length;
alter table public.portfolio_categories
  add constraint portfolio_categories_label_length check (char_length(trim(label)) between 2 and 24),
  add constraint portfolio_categories_reserved_names check (lower(trim(label)) <> 'todos' and lower(slug) <> 'todos');

create unique index if not exists portfolio_categories_label_unique_idx
  on public.portfolio_categories (lower(trim(label)));
create index if not exists portfolio_photos_all_selection_idx
  on public.portfolio_photos (all_sort_order, id) where is_published and show_in_all;
create index if not exists portfolio_photos_category_selection_idx
  on public.portfolio_photos (category_id, category_sort_order, id) where is_published and show_in_category;

-- Preserva de forma determinística a seleção que o site apresentava antes:
-- as primeiras 8 publicadas e, dentro de cada categoria, as primeiras 8.
with ranked as (
  select id, row_number() over (order by is_featured desc, sort_order, created_at, id) as position
  from public.portfolio_photos where is_published
)
update public.portfolio_photos photo
set show_in_all = true, all_sort_order = ranked.position * 10
from ranked where ranked.id = photo.id and ranked.position <= 8 and not photo.show_in_all;

with ranked as (
  select id, row_number() over (partition by category_id order by sort_order, created_at, id) as position
  from public.portfolio_photos where is_published
)
update public.portfolio_photos photo
set show_in_category = true, category_sort_order = ranked.position * 10
from ranked where ranked.id = photo.id and ranked.position <= 8 and not photo.show_in_category;

create or replace function public.enforce_portfolio_category_limit()
returns trigger language plpgsql set search_path = public as $$
declare category_count integer;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('portfolio-category-count', 0));
    select count(*) into category_count from public.portfolio_categories;
    if category_count >= 5 then
      raise exception using message = 'Só pode criar até 5 categorias no Portefólio.', errcode = 'P0001';
    end if;
  end if;
  new.label := regexp_replace(trim(new.label), '\s+', ' ', 'g');
  if char_length(new.label) > 24 then
    raise exception using message = 'O nome da categoria pode ter no máximo 24 caracteres.', errcode = 'P0001';
  end if;
  if lower(new.label) = 'todos' or lower(new.slug) = 'todos' then
    raise exception using message = '“Todos” é uma seleção do sistema e não pode ser usada como categoria.', errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists portfolio_categories_enforce_limit on public.portfolio_categories;
create trigger portfolio_categories_enforce_limit
before insert or update of label, slug on public.portfolio_categories for each row execute function public.enforce_portfolio_category_limit();

create or replace function public.enforce_portfolio_selection_limits()
returns trigger language plpgsql set search_path = public as $$
declare selected_count integer;
begin
  if new.is_published and new.show_in_all then
    perform pg_advisory_xact_lock(hashtextextended('portfolio-all-selection', 0));
    select count(*) into selected_count from public.portfolio_photos
      where is_published and show_in_all and id <> new.id;
    if selected_count >= 8 then
      raise exception using message = 'A seleção “Todos” já tem o máximo de 8 fotografias.', errcode = 'P0001';
    end if;
  end if;

  if new.is_published and new.show_in_category then
    perform pg_advisory_xact_lock(hashtextextended('portfolio-category-selection:' || new.category_id::text, 0));
    select count(*) into selected_count from public.portfolio_photos
      where is_published and show_in_category and category_id = new.category_id and id <> new.id;
    if selected_count >= 8 then
      raise exception using message = 'Esta categoria já tem o máximo de 8 fotografias selecionadas.', errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists portfolio_photos_enforce_selection_limits on public.portfolio_photos;
create trigger portfolio_photos_enforce_selection_limits
before insert or update of is_published, show_in_all, show_in_category, category_id
on public.portfolio_photos for each row execute function public.enforce_portfolio_selection_limits();

update public.portfolio_settings set max_recent = least(max_recent, 8) where id = true;
