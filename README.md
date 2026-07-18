# Fotografia Arnaut

Site editorial para Beatriz Arnaut, fotógrafa de Pombal, Leiria, com sistema de galerias privadas usando Supabase.

## Estrutura

- `index.html` — página principal.
- `galeria.html` — acesso privado dos clientes.
- `admin.html` — área administrativa da marca.
- `gallery.js` — fluxo de convidados, sessão temporária e lightbox.
- `admin.js` — login, criação de álbuns, uploads e gestão.
- `supabase/migrations/` — tabelas, índices, RLS e policies de Storage.
- `supabase/functions/` — Edge Functions server-side.
- `tests/` — testes locais das funções críticas de validação/hash.

## Arquitetura

O site continua estático e pode ser publicado em Cloudflare Pages, Vercel ou outro alojamento estático.

A proteção real fica no Supabase:

1. As fotografias privadas ficam no bucket privado `private-galleries`.
2. O visitante introduz apenas o código em `galeria.html`.
3. O frontend chama a Edge Function `redeem-gallery-code`.
4. A função normaliza o código, calcula um lookup HMAC e encontra a galeria no servidor.
5. Se estiver correto, cria um token aleatório temporário e devolve apenas `publicId` + token.
6. A base de dados guarda lookup/hash do código e do token. Para o admin poder consultar o código mais tarde, guarda também uma cópia encriptada do código, cifrada nas Edge Functions com `GALLERY_CODE_ENCRYPTION_KEY`.
7. `get-gallery` valida `publicId` + sessão e devolve metadados + URLs assinados temporários.
8. O frontend nunca recebe `service_role`, hashes, lookups, a chave de encriptação ou caminhos públicos permanentes. O código completo só é devolvido a utilizadores autenticados como admin, através da Edge Function `admin-albums`.

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

Nunca coloque `service_role`, `SUPABASE_SECRET_KEY`, `ACCESS_CODE_PEPPER`, `SESSION_TOKEN_PEPPER` ou `GALLERY_CODE_ENCRYPTION_KEY` no frontend.

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

As migrations criam tabelas, constraints, índices, RLS, policies de Storage e os campos do fluxo por código único (`public_id`, `access_code_lookup`, `access_code_last_four`, `access_code_encrypted`, `status`).

## Secrets das Edge Functions

Defina estes secrets no Supabase:

```env
ACCESS_CODE_PEPPER=
SESSION_TOKEN_PEPPER=
GALLERY_CODE_ENCRYPTION_KEY=
```

O Supabase fornece automaticamente `SUPABASE_URL` e chaves de função. O código suporta tanto as chaves novas (`SUPABASE_SECRET_KEYS`) como as antigas (`SUPABASE_SERVICE_ROLE_KEY`), mas estas ficam apenas nas Edge Functions.

Deploy das funções:

```powershell
npx supabase functions deploy validate-gallery-code
npx supabase functions deploy redeem-gallery-code
npx supabase functions deploy get-gallery
npx supabase functions deploy admin-albums
```

## Criar o primeiro álbum

1. Abra `/admin.html`.
2. Entre com o email/password da Beatriz.
3. Clique em `Criar galeria`.
4. Preencha nome, tipo de evento, data/local, descrição e opções de privacidade.
5. Guarde.
6. Faça upload das fotografias durante a criação, se quiser.
7. Escolha a fotografia de capa antes de concluir.
8. O sistema gera automaticamente um código único, por exemplo `7K4P-9M2X-H8QA`.
9. Copie o código ou as instruções para convidados no modal.

O link para convidados é sempre a página geral de galerias:

```text
https://o-seu-dominio.pt/galeria.html
```

O convidado introduz apenas o código. Na listagem do admin o código aparece mascarado, por exemplo `••••-••••-H8QA`; para consultar o código completo, use a ação protegida no painel. Essa consulta passa pela Edge Function autenticada e usa a cópia encriptada guardada no servidor.

Ao usar `Gerar novo código`, o código anterior deixa de funcionar e `session_version` aumenta, invalidando sessões antigas.

## Marca de água e processamento de fotografias

Os uploads guardam sempre o original no bucket privado:

```text
albums/{album-id}/originals/{file-id}.jpg
```

Depois do upload, a Edge Function `admin-albums` cria uma tarefa em `image_processing_jobs`. O processamento pesado não acontece no browser nem numa Edge Function: deve correr num worker Node com `sharp`.

O worker cria:

```text
albums/{album-id}/web-watermarked/{photo-id}.webp
albums/{album-id}/thumbs-watermarked/{photo-id}.webp
```

Comando:

```powershell
npm run process:watermarks
```

Variáveis necessárias para o worker:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WATERMARK_LOGO_PATH=assets/logo-watermark.svg
WATERMARK_WORKER_LIMIT=12
```

`SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para o frontend nem para o Git; use apenas no ambiente privado onde o worker corre.

No painel de cada galeria pode configurar:

- marca ativa/inativa;
- posição;
- opacidade;
- tamanho;
- se o download individual usa original ou versão com marca.

Para fotografias antigas ou falhadas, abra a galeria no admin e use `Aplicar marca de água às fotografias existentes`. O botão cria tarefas apenas para fotografias que ainda não tenham versão pronta, tenham falhado, ou estejam numa versão antiga da marca.

A galeria dos convidados usa apenas `thumbs-watermarked` e `web-watermarked` quando a marca está ativa. O caminho original não é devolvido no HTML; quando downloads originais estão autorizados, a URL assinada é gerada pela Edge Function após validar a sessão da galeria.

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
- `GALLERY_CODE_ENCRYPTION_KEY`
- `SUPABASE_URL` automático
- `SUPABASE_SECRET_KEYS` ou `SUPABASE_SERVICE_ROLE_KEY` automático/secret

Worker privado de watermark:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEY`
- `WATERMARK_LOGO_PATH`
- `WATERMARK_WORKER_LIMIT`

## Backups

- Base de dados: use backups do Supabase e exportações SQL regulares.
- Fotografias: exporte o bucket `private-galleries` periodicamente.
- Guarde uma cópia offline das galerias entregues.
- Antes de apagar álbuns, confirme que existe backup das fotografias.

## Testes

```powershell
npm test
```

Os testes cobrem normalização de slugs, geração/formatação/máscara de códigos, lookup HMAC, hashing de códigos/tokens, encriptação/desencriptação do código consultável pelo admin, geração de tokens, paths privados e validação de ficheiros.

## Limitações conhecidas

- O frontend estático guarda a sessão temporária em `sessionStorage`, não em cookie `HttpOnly`.
- Os uploads mostram progresso por ficheiro concluído, não percentagem de bytes.
- O worker de marca de água deve estar agendado/ativo num ambiente privado para processar a fila automaticamente após uploads.
- Não existe botão “descarregar todas” para evitar criar um fluxo inseguro ou pesado; há download individual quando autorizado.

## Referências oficiais úteis

- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase signed URLs: https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
