-- Funções de manutenção e de trigger não devem ser chamáveis via /rest/v1/rpc por visitantes.
-- Os triggers continuam a disparar: o Postgres só verifica EXECUTE ao criar o trigger.

revoke all on function public.cleanup_abandoned_gallery_drafts() from public, anon, authenticated;
revoke all on function public.cleanup_expired_gallery_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_abandoned_gallery_drafts() to service_role;
grant execute on function public.cleanup_expired_gallery_sessions() to service_role;

revoke all on function public.notify_order_change() from public, anon, authenticated;
revoke all on function public.notify_contact_request() from public, anon, authenticated;

alter function public.touch_updated_at() set search_path = public;
