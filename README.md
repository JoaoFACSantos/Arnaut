# Fotografia Arnaut

Site editorial para Beatriz Arnaut, fotógrafa de Pombal, Leiria, com sistema de galerias privadas usando Supabase.

## Estrutura

- `index.html` — página principal.
- `galeria.html` — acesso privado dos clientes.
- `admin.html` — área administrativa da Beatriz.
- `gallery.js` — fluxo de convidados, sessão temporária e lightbox.
- `admin.js` — login, criação de álbuns, uploads e gestão.
- `supabase/migrations/` — tabelas, índices, RLS e policies de Storage.
- `supabase/functions/` — Edge Functions server-side.
- `tests/` — testes locais das funções críticas de validação/hash.

## Arquitetura

O site continua estático e pode ser publicado em Cloudflare Pages, Vercel ou outro alojamento estático.

A proteção real fica no Supabase:

1. As fotografias privadas ficam no bucket privado `private-galleries`.
2. O visitante introduz slug e código em `galeria.html`.
3. O frontend chama a Edge Function `validate-gallery-code`.
4. A função valida o código no servidor usando HMAC-SHA-256 com `ACCESS_CODE_PEPPER`.
5. Se estiver correto, cria um token aleatório temporário.
6. A base de dados guarda apenas o hash do token.
7. `get-gallery` valida o token e devolve metadados + URLs assinados temporários.
8. O frontend nunca recebe `service_role`, hashes, códigos ou caminhos públicos permanentes.

Como o site é estático, o token temporário da galeria é guardado em `sessionStorage`. A validade é curta: 2 horas. A alternativa ideal seria cookie `HttpOnly`, mas isso exige servir o frontend e as funções pelo mesmo backend/domínio.

## Configuração local

Copie o exemplo:

```powershell
Copy-Item config.example.js config.js
```

Preencha:

```js
window.ARNAUT_CONFIG = {
  SUPABASE_URL: 'https://PROJECT_REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_...',
  SITE_URL: 'https://o-seu-dominio.pt',
  ADMIN_EMAIL: 'email-da-beatriz@example.com',
};
```

Nunca coloque `service_role`, `SUPABASE_SECRET_KEY`, `ACCESS_CODE_PEPPER` ou `SESSION_TOKEN_PEPPER` no frontend.

Para ver localmente:

```powershell
python -m http.server 4173
```

Abra `http://localhost:4173`.

## Criar o projeto Supabase

1. Crie um projeto em Supabase.
2. Em Authentication, ative login por email e password.
3. Crie a utilizadora administradora com o email real da Beatriz.
4. Aplique a migration:

```powershell
npx supabase link --project-ref PROJECT_REF
npx supabase db push
```

5. Adicione a administradora:

```sql
insert into public.gallery_admins (email)
values ('email-da-beatriz@example.com');
```

6. Confirme que o bucket `private-galleries` existe e está privado.

A migration cria tabelas, constraints, índices, RLS e policies de Storage.

## Secrets das Edge Functions

Defina estes secrets no Supabase:

```env
ACCESS_CODE_PEPPER=
SESSION_TOKEN_PEPPER=
```

O Supabase fornece automaticamente `SUPABASE_URL` e chaves de função. O código suporta tanto as chaves novas (`SUPABASE_SECRET_KEYS`) como as antigas (`SUPABASE_SERVICE_ROLE_KEY`), mas estas ficam apenas nas Edge Functions.

Deploy das funções:

```powershell
npx supabase functions deploy validate-gallery-code
npx supabase functions deploy get-gallery
npx supabase functions deploy admin-albums
```

## Criar o primeiro álbum

1. Abra `/admin.html`.
2. Entre com o email/password da Beatriz.
3. Clique em `Novo álbum`.
4. Preencha nome, slug, data/local, descrição e código.
5. Guarde.
6. Faça upload das fotografias.
7. Defina uma fotografia como capa e guarde.
8. Clique em `Copiar link`.

O link fica no formato:

```text
https://o-seu-dominio.pt/galeria.html?album=casamento-ana-pedro
```

Quando altera o código de um álbum, `session_version` aumenta e as sessões antigas ficam inválidas.

## Publicar com domínio na Cloudflare

Opção recomendada: Cloudflare Pages.

1. Envie este repositório para o GitHub.
2. No painel Cloudflare, abra `Workers & Pages`.
3. Crie um projeto Pages ligado ao repositório.
4. Framework preset: `None`.
5. Build command: vazio.
6. Output directory: `/`.
7. Publique.
8. Em `Custom domains`, adicione o seu domínio.
9. Crie o ficheiro `config.js` no projeto antes do deploy, ou configure um passo de build que o gere a partir das variáveis do Cloudflare.

Se preferir upload manual, também pode publicar a pasta estática, mas GitHub + Cloudflare Pages é mais fácil para futuras alterações.

## Variáveis

Frontend, em `config.js`:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SITE_URL`
- `ADMIN_EMAIL`

Supabase Edge Functions:

- `ACCESS_CODE_PEPPER`
- `SESSION_TOKEN_PEPPER`
- `SUPABASE_URL` automático
- `SUPABASE_SECRET_KEYS` ou `SUPABASE_SERVICE_ROLE_KEY` automático/secret

## Backups

- Base de dados: use backups do Supabase e exportações SQL regulares.
- Fotografias: exporte o bucket `private-galleries` periodicamente.
- Guarde uma cópia offline das galerias entregues.
- Antes de apagar álbuns, confirme que existe backup das fotografias.

## Testes

```powershell
npm test
```

Os testes cobrem normalização de slugs, hashing de códigos/tokens, geração de tokens, paths privados e validação de ficheiros.

## Limitações conhecidas

- O frontend estático guarda a sessão temporária em `sessionStorage`, não em cookie `HttpOnly`.
- Os uploads mostram progresso por ficheiro concluído, não percentagem de bytes.
- A geração de thumbnails/web otimizada está preparada na estrutura de paths, mas esta primeira versão guarda os originais. Pode ser adicionada uma função de processamento depois.
- Não existe botão “descarregar todas” para evitar criar um fluxo inseguro ou pesado; há download individual quando autorizado.

## Referências oficiais úteis

- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase signed URLs: https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
