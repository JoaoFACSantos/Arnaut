# Operação — Fotografia Arnaut

## Publicação

1. Definir `SITE_URL` com o domínio HTTPS final em `config.js` e nos secrets das Edge Functions.
2. Aplicar as migrations por ordem, incluindo `202608180001_portfolio_editor_fields.sql` e `202608180002_admin_notifications.sql`.
3. Configurar os secrets Stripe e Resend apenas no Supabase; nunca no frontend.
4. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
5. Confirmar os webhooks Stripe no ambiente de produção antes de ativar vendas.

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
