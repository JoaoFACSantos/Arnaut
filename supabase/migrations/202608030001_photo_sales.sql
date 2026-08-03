-- Optional photo sales for private galleries.
-- Existing galleries remain unchanged because sales_enabled defaults to false.

alter table public.albums
  add column if not exists sales_enabled boolean not null default false,
  add column if not exists photo_price_cents integer,
  add column if not exists currency text not null default 'EUR',
  add column if not exists download_expiry_days integer not null default 7,
  add column if not exists sales_support_email text,
  add column if not exists refund_policy_text text;

update public.albums
set currency = upper(currency)
where currency <> upper(currency);

alter table public.albums
  drop constraint if exists albums_sales_configuration_valid;

alter table public.albums
  add constraint albums_sales_configuration_valid
  check (
    sales_enabled = false
    or (
      photo_price_cents is not null
      and photo_price_cents > 0
      and currency ~ '^[A-Z]{3}$'
      and download_expiry_days between 1 and 90
      and watermark_enabled = true
      and nullif(btrim(sales_support_email), '') is not null
      and position('@' in sales_support_email) > 1
      and nullif(btrim(refund_policy_text), '') is not null
    )
  ) not valid;

alter table public.albums validate constraint albums_sales_configuration_valid;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null default gen_random_uuid() unique,
  order_number text not null unique,
  gallery_id uuid not null references public.albums(id) on delete restrict,
  album_session_id uuid references public.album_sessions(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  customer_email text,
  currency text not null,
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  total_cents integer not null,
  refunded_cents integer not null default 0,
  status text not null default 'pending',
  selection_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz,
  downloads_invalidated_at timestamptz,
  email_sent_at timestamptz,
  constraint orders_currency_valid check (currency ~ '^[A-Z]{3}$'),
  constraint orders_amounts_valid check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and total_cents >= 0
    and refunded_cents >= 0
    and total_cents = subtotal_cents - discount_cents
    and refunded_cents <= total_cents
  ),
  constraint orders_status_valid check (
    status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')
  )
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  photo_id uuid not null references public.album_photos(id) on delete restrict,
  unit_price_cents integer not null,
  created_at timestamptz not null default now(),
  constraint order_items_price_positive check (unit_price_cents > 0),
  constraint order_items_unique_photo unique (order_id, photo_id)
);

create table if not exists public.order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null default 'checkout',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_access_tokens_purpose_valid check (purpose in ('checkout', 'email', 'admin-resend'))
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing',
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  constraint stripe_webhook_events_status_valid check (status in ('processing', 'processed', 'failed')),
  constraint stripe_webhook_events_attempts_positive check (attempts > 0)
);

create table if not exists public.commerce_attempts (
  id uuid primary key default gen_random_uuid(),
  album_session_id uuid references public.album_sessions(id) on delete cascade,
  ip_hash text not null,
  action text not null,
  success boolean not null default false,
  created_at timestamptz not null default now(),
  constraint commerce_attempts_action_valid check (action in ('checkout', 'order-status', 'download'))
);

create index if not exists orders_gallery_created_idx on public.orders(gallery_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));
create index if not exists orders_payment_intent_idx on public.orders(stripe_payment_intent_id);
create index if not exists order_items_order_idx on public.order_items(order_id, created_at);
create index if not exists order_items_photo_idx on public.order_items(photo_id);
create index if not exists order_access_tokens_lookup_idx on public.order_access_tokens(token_hash, expires_at);
create index if not exists commerce_attempts_rate_idx on public.commerce_attempts(album_session_id, action, created_at desc);
create index if not exists commerce_attempts_ip_rate_idx on public.commerce_attempts(ip_hash, action, created_at desc);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row
execute function public.touch_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_access_tokens enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.commerce_attempts enable row level security;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
on public.orders for select
to authenticated
using (public.is_gallery_admin());

drop policy if exists "Admins can read order items" on public.order_items;
create policy "Admins can read order items"
on public.order_items for select
to authenticated
using (public.is_gallery_admin());

drop policy if exists "Admins can read commerce attempts" on public.commerce_attempts;
create policy "Admins can read commerce attempts"
on public.commerce_attempts for select
to authenticated
using (public.is_gallery_admin());

create or replace function public.create_pending_photo_order(
  p_gallery_id uuid,
  p_album_session_id uuid,
  p_photo_ids uuid[],
  p_selection_fingerprint text,
  p_access_token_hash text,
  p_access_expires_at timestamptz
)
returns table (
  order_id uuid,
  order_public_id uuid,
  order_number text,
  currency text,
  subtotal_cents integer,
  total_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_album public.albums%rowtype;
  v_session public.album_sessions%rowtype;
  v_public_id uuid := gen_random_uuid();
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_photo_count integer;
  v_distinct_count integer;
  v_subtotal integer;
begin
  if cardinality(p_photo_ids) is null or cardinality(p_photo_ids) < 1 or cardinality(p_photo_ids) > 100 then
    raise exception 'invalid_photo_count';
  end if;

  select * into v_album
  from public.albums
  where id = p_gallery_id
    and sales_enabled = true
    and is_active = true
    and is_archived = false
    and status = 'active'
    and (expires_at is null or expires_at > now())
  for update;

  if not found or v_album.photo_price_cents is null or v_album.photo_price_cents <= 0 then
    raise exception 'sales_unavailable';
  end if;

  select * into v_session
  from public.album_sessions
  where id = p_album_session_id
    and album_id = p_gallery_id
    and session_version = v_album.session_version
    and expires_at > now();

  if not found then
    raise exception 'invalid_gallery_session';
  end if;

  select count(*), count(distinct id)
  into v_photo_count, v_distinct_count
  from public.album_photos
  where album_id = p_gallery_id
    and id = any(p_photo_ids)
    and processing_status = 'ready'
    and watermarked_path is not null;

  if v_photo_count <> cardinality(p_photo_ids) or v_distinct_count <> cardinality(p_photo_ids) then
    raise exception 'invalid_photo_selection';
  end if;

  v_subtotal := v_album.photo_price_cents * v_photo_count;
  v_order_number := 'AR-' || extract(year from now())::integer::text || '-' || upper(left(replace(v_public_id::text, '-', ''), 8));

  insert into public.orders (
    id,
    public_id,
    order_number,
    gallery_id,
    album_session_id,
    currency,
    subtotal_cents,
    discount_cents,
    total_cents,
    status,
    selection_fingerprint
  ) values (
    v_order_id,
    v_public_id,
    v_order_number,
    p_gallery_id,
    p_album_session_id,
    v_album.currency,
    v_subtotal,
    0,
    v_subtotal,
    'pending',
    p_selection_fingerprint
  );

  insert into public.order_items (order_id, photo_id, unit_price_cents)
  select v_order_id, selected.photo_id, v_album.photo_price_cents
  from unnest(p_photo_ids) as selected(photo_id);

  insert into public.order_access_tokens (order_id, token_hash, purpose, expires_at)
  values (v_order_id, p_access_token_hash, 'checkout', p_access_expires_at);

  return query
  select v_order_id, v_public_id, v_order_number, v_album.currency, v_subtotal, v_subtotal;
end;
$$;

revoke all on function public.create_pending_photo_order(uuid, uuid, uuid[], text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_pending_photo_order(uuid, uuid, uuid[], text, text, timestamptz) to service_role;

create or replace function public.claim_stripe_event(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
begin
  insert into public.stripe_webhook_events (event_id, event_type, status, attempts)
  values (p_event_id, p_event_type, 'processing', 1)
  on conflict (event_id) do update
    set status = 'processing',
        event_type = excluded.event_type,
        attempts = public.stripe_webhook_events.attempts + 1,
        last_error = null,
        processed_at = null
    where public.stripe_webhook_events.status = 'failed'
  returning event_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;

create or replace function public.cleanup_expired_commerce_data()
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set status = 'expired'
  where status = 'pending'
    and created_at < now() - interval '24 hours';

  delete from public.order_access_tokens
  where expires_at < now() - interval '30 days';

  delete from public.commerce_attempts
  where created_at < now() - interval '30 days';
$$;

revoke all on function public.cleanup_expired_commerce_data() from public, anon, authenticated;
grant execute on function public.cleanup_expired_commerce_data() to service_role;
