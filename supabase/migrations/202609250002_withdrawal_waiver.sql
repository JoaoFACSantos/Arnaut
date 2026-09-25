-- Prova do consentimento prévio e expresso do consumidor para o fornecimento
-- imediato de conteúdo digital, com reconhecimento da perda do direito de livre
-- resolução (artigo 17.º do Decreto-Lei n.º 24/2014).
alter table public.orders
  add column if not exists withdrawal_waiver_accepted_at timestamptz,
  add column if not exists withdrawal_waiver_text text;
