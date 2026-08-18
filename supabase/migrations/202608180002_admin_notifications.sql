create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  type text not null check (type in ('order_created', 'payment_paid', 'payment_failed', 'gallery_expiring', 'upload_failed', 'processing_failed', 'storage_high')),
  title text not null check (char_length(title) between 2 and 100),
  message text not null check (char_length(message) between 2 and 280),
  related_kind text check (related_kind in ('order', 'gallery', 'photo', 'storage')),
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_unread_idx
  on public.admin_notifications(is_read, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists "Administrators read notifications" on public.admin_notifications;
create policy "Administrators read notifications" on public.admin_notifications for select
to authenticated using (public.is_gallery_admin());

drop policy if exists "Administrators update notifications" on public.admin_notifications;
create policy "Administrators update notifications" on public.admin_notifications for update
to authenticated using (public.is_gallery_admin()) with check (public.is_gallery_admin());

create or replace function public.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery_title text;
begin
  select title into v_gallery_title from public.albums where id = new.gallery_id;

  if tg_op = 'INSERT' then
    insert into public.admin_notifications(event_key, type, title, message, related_kind, related_id, created_at)
    values (
      'order_created:' || new.id,
      'order_created',
      'Nova encomenda',
      coalesce(v_gallery_title, 'Galeria') || ' · ' || new.order_number,
      'order',
      new.id,
      new.created_at
    ) on conflict (event_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('paid', 'failed') then
    insert into public.admin_notifications(event_key, type, title, message, related_kind, related_id, created_at)
    values (
      'order_status:' || new.id || ':' || new.status,
      case when new.status = 'paid' then 'payment_paid' else 'payment_failed' end,
      case when new.status = 'paid' then 'Pagamento confirmado' else 'Pagamento falhou' end,
      coalesce(v_gallery_title, 'Galeria') || ' · ' || new.order_number,
      'order',
      new.id,
      coalesce(new.paid_at, new.updated_at, now())
    ) on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_create_admin_notification on public.orders;
create trigger orders_create_admin_notification
after insert or update of status on public.orders
for each row execute function public.notify_order_change();

create or replace function public.refresh_gallery_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_gallery_admin() then
    raise exception 'admin_required';
  end if;

  insert into public.admin_notifications(event_key, type, title, message, related_kind, related_id, created_at)
  select
    'gallery_expiring:' || album.id || ':' || album.expires_at::date,
    'gallery_expiring',
    'Galeria prestes a expirar',
    album.title || ' · ' || to_char(album.expires_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY'),
    'gallery',
    album.id,
    now()
  from public.albums album
  where album.is_active = true
    and album.is_archived = false
    and album.expires_at is not null
    and album.expires_at > now()
    and album.expires_at <= now() + interval '7 days'
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_gallery_expiry_notifications() from public, anon;
grant execute on function public.refresh_gallery_expiry_notifications() to authenticated;
