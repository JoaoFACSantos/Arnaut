-- Repara instalações em que as novas colunas de curadoria foram criadas sem
-- transportar a seleção pública anterior. Não altera seleções já existentes.

do $$
begin
  if not exists (
    select 1 from public.portfolio_photos
    where is_published and show_in_all
  ) then
    with ranked as (
      select id, row_number() over (
        order by is_featured desc, sort_order, created_at, id
      ) as position
      from public.portfolio_photos
      where is_published
    )
    update public.portfolio_photos photo
    set show_in_all = true,
        all_sort_order = ranked.position * 10
    from ranked
    where ranked.id = photo.id
      and ranked.position <= 8;
  end if;
end $$;

with category_without_selection as (
  select category.id
  from public.portfolio_categories category
  where not exists (
    select 1
    from public.portfolio_photos selected
    where selected.category_id = category.id
      and selected.is_published
      and selected.show_in_category
  )
), ranked as (
  select photo.id,
         row_number() over (
           partition by photo.category_id
           order by photo.sort_order, photo.created_at, photo.id
         ) as position
  from public.portfolio_photos photo
  join category_without_selection category on category.id = photo.category_id
  where photo.is_published
)
update public.portfolio_photos photo
set show_in_category = true,
    category_sort_order = ranked.position * 10
from ranked
where ranked.id = photo.id
  and ranked.position <= 8;
