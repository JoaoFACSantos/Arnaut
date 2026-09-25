-- Numa galeria com venda ativa, o original sem marca de água só pode ser
-- entregue depois do pagamento. O download gratuito continua possível, mas
-- apenas da versão com marca de água.
update public.albums
set watermark_original_downloads = false
where sales_enabled = true
  and watermark_original_downloads = true;

alter table public.albums
  drop constraint if exists albums_sales_no_free_originals;

alter table public.albums
  add constraint albums_sales_no_free_originals
  check (sales_enabled = false or watermark_original_downloads = false);
