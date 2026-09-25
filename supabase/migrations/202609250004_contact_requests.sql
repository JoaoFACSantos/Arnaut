-- Pedidos enviados pelo formulário de contacto do site. Só a Edge Function
-- contact-request (service role) escreve; a administradora pode consultar.
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  session_type text not null check (char_length(session_type) between 2 and 60),
  preferred_date date,
  location text check (location is null or char_length(location) <= 160),
  message text not null check (char_length(message) between 10 and 2000),
  ip_hash text not null,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_requests_ip_created_idx
  on public.contact_requests(ip_hash, created_at desc);

create index if not exists contact_requests_created_idx
  on public.contact_requests(created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "Administrators read contact requests" on public.contact_requests;
create policy "Administrators read contact requests" on public.contact_requests for select
to authenticated using (public.is_gallery_admin());

drop policy if exists "Administrators delete contact requests" on public.contact_requests;
create policy "Administrators delete contact requests" on public.contact_requests for delete
to authenticated using (public.is_gallery_admin());

alter table public.admin_notifications
  drop constraint if exists admin_notifications_type_check;
alter table public.admin_notifications
  add constraint admin_notifications_type_check
  check (type in ('order_created', 'payment_paid', 'payment_failed', 'gallery_expiring', 'upload_failed', 'processing_failed', 'storage_high', 'contact_request'));

alter table public.admin_notifications
  drop constraint if exists admin_notifications_related_kind_check;
alter table public.admin_notifications
  add constraint admin_notifications_related_kind_check
  check (related_kind in ('order', 'gallery', 'photo', 'storage', 'contact'));

create or replace function public.notify_contact_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications(event_key, type, title, message, related_kind, related_id, created_at)
  values (
    'contact_request:' || new.id,
    'contact_request',
    'Novo pedido de contacto',
    left(new.name || ' · ' || new.session_type || ' · ' || new.email, 280),
    'contact',
    new.id,
    new.created_at
  ) on conflict (event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists contact_requests_admin_notification on public.contact_requests;
create trigger contact_requests_admin_notification
after insert on public.contact_requests
for each row execute function public.notify_contact_request();
