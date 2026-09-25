-- Um evento Stripe que ficou em 'processing' (por exemplo, porque a função
-- terminou a meio) volta a poder ser processado quando a Stripe o reenviar.
alter table public.stripe_webhook_events
  add column if not exists claimed_at timestamptz;

update public.stripe_webhook_events
set claimed_at = coalesce(processed_at, created_at)
where claimed_at is null;

alter table public.stripe_webhook_events
  alter column claimed_at set default now(),
  alter column claimed_at set not null;

create or replace function public.claim_stripe_event(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
begin
  insert into public.stripe_webhook_events (event_id, event_type, status, attempts, claimed_at)
  values (p_event_id, p_event_type, 'processing', 1, now())
  on conflict (event_id) do update
    set status = 'processing',
        event_type = excluded.event_type,
        attempts = public.stripe_webhook_events.attempts + 1,
        last_error = null,
        processed_at = null,
        claimed_at = now()
    where public.stripe_webhook_events.status = 'failed'
       or (
         public.stripe_webhook_events.status = 'processing'
         and public.stripe_webhook_events.claimed_at < now() - interval '10 minutes'
       )
  returning event_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;
