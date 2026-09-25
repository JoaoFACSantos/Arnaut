# Operação — Fotografia Arnaut

## Publicação

1. Definir `SITE_URL` com o domínio HTTPS final em `config.js` e nos secrets das Edge Functions.
2. Aplicar as migrations por ordem (`npx supabase db push`), incluindo as de `202609250001` a `202609250004` (vendas sem originais gratuitos, aceitação do direito de livre resolução, eventos Stripe bloqueados e pedidos de contacto).
3. Publicar primeiro o site (Cloudflare) e só depois as Edge Functions alteradas: `get-gallery`, `admin-albums`, `create-checkout-session`, `contact-request` e as restantes que usem `_shared/`. A função de checkout passa a exigir a confirmação do direito de livre resolução que só a nova versão de `galeria.html` envia.
4. Configurar os secrets Stripe e Resend apenas no Supabase; nunca no frontend.
5. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
6. Confirmar os webhooks Stripe no ambiente de produção antes de ativar vendas.
7. Em Authentication → Sign In / Providers, manter os registos públicos desativados ("Allow new users to sign up" desligado): só a administradora precisa de conta.

## Backup

- Base de dados: manter backups automáticos do projeto Supabase e uma exportação cifrada antes de migrations estruturais.
- Storage: copiar regularmente os buckets `private-galleries`, `public-portfolio` e os assets de marca para armazenamento separado e cifrado.
- Código: publicar apenas commits revistos e manter tags das versões de produção.
- Secrets: guardar os valores num gestor de passwords; não incluir `.env` ou `config.js` com chaves no Git.

## Recuperação segura

1. Criar primeiro um projeto/ambiente isolado de recuperação.
2. Restaurar a base de dados nesse ambiente e validar contagens, RLS e referências de Storage.
3. Restaurar os objetos mantendo exatamente os caminhos originais.
4. Executar os testes de acesso admin, galeria privada, checkout, webhook e downloads assinados.
5. Só depois trocar o ambiente de produção ou DNS. Nunca experimentar um restauro diretamente sobre produção.

## Verificação mensal

- Sessões administrativas e acessos inesperados.
- Webhooks Stripe falhados ou repetidos.
- Encomendas pendentes antigas.
- Galerias expiradas, espaço ocupado e falhas de processamento.
- Validade dos links legais, email de apoio e templates transacionais.
- Pedidos de contacto na tabela `contact_requests` (apagar os que já não são necessários).
