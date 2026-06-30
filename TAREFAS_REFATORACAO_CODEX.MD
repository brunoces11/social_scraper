# TAREFAS_REFATORACAO_CODEX.MD

Lista operacional para executar a refatoracao por blocos pequenos, preservando TikTok como fonte de verdade e preparando a base para Instagram, YouTube e futuras redes sem duplicacao desnecessaria.

## Conviccao apos prova real

O plano novo esta alinhado para implementacao, desde que a execucao siga estas correcoes sobre o plano original:

1. Nao reaproveitar `/api/fetch-videos` como rota generica de busca por canal/perfil/hashtag, porque ela ja existe para busca TikTok por URLs/lote.
2. Considerar tambem `/api/insta_fetch-videos` na refatoracao de busca por URLs/lote.
3. Nao renomear prompts no inicio.
4. Nao adicionar validacao frontend nova ao TikTok.
5. Nao deletar rotas antigas ate haver wrappers, build limpo e validacao.
6. Tratar Instagram como codigo modificavel/parcial, mas sem quebrar contratos aparentes.
7. Preparar encaixe do YouTube via interfaces/adapters, sem implementar scraping YouTube nesta primeira refatoracao.

## Ordem de execucao por janelas de contexto

### Bloco 0 - Baseline tecnico

Objetivo: saber o estado inicial e proteger o TikTok antes de mexer.

Tarefas:

- [ ] Rodar `git status --short`.
- [ ] Criar branch `codex/refatoracao-parametrizacao` se o usuario autorizar trabalho com branch.
- [ ] Rodar `npm run lint`.
- [ ] Rodar `npm run build`.
- [ ] Registrar falhas preexistentes, se houver.
- [ ] Confirmar que os documentos nao rastreados nao serao alterados sem necessidade.

Arquivos esperados:

- Nenhum arquivo de producao alterado.

Parar quando:

- Baseline estiver registrado e qualquer falha inicial estiver documentada.

### Bloco 1 - Caracterizacao do TikTok

Objetivo: criar contratos minimos do comportamento TikTok atual.

Tarefas:

- [ ] Criar fixture TikTok de normalizacao com `id`, `text`, `playCount`, `diggCount`, `commentCount`, `postPage`, `createTimeISO`, `challenges`.
- [ ] Criar fixture TikTok alternativa com `webVideoUrl`, `videoUrl`, `views`, `viewCount`, `likeCount`.
- [ ] Criar script/teste para garantir saida de `normalizeChannelVideos`.
- [ ] Criar script/teste para helper de nome de arquivo quando ele for extraido.
- [ ] Adicionar comando de verificacao no `package.json` apenas se for simples e nao invasivo.

Arquivos provaveis:

- `tests/` ou `scripts/`
- `package.json`, somente se necessario

Parar quando:

- Houver uma forma rapida de detectar regressao em normalizacao TikTok.

### Bloco 2 - Core de plataformas e prompts

Objetivo: centralizar plataforma/prompt sem mudar rotas publicas.

Tarefas:

- [ ] Criar `lib/platforms.ts` com tipo `PlatformId = "tiktok" | "instagram" | "youtube"`.
- [ ] Criar `lib/platform-prompts.ts`.
- [ ] Mapear `tiktok` para `ai-prompt.txt`.
- [ ] Mapear `instagram` para `insta_ai-prompt.txt`.
- [ ] Deixar `youtube` previsto, mas sem exigir arquivo ainda.
- [ ] Garantir fallback TikTok quando plataforma nao vier no payload legado.

Arquivos provaveis:

- `lib/platforms.ts`
- `lib/platform-prompts.ts`

Parar quando:

- A resolucao de prompt estiver isolada e compativel com nomes atuais.

### Bloco 3 - Enriquecimento AI compartilhado

Objetivo: remover duplicacao de `enrich-metadata` preservando endpoints.

Tarefas:

- [ ] Criar `lib/enrichment.ts`.
- [ ] Mover logica comum de batch OpenAI para `lib/enrichment.ts`.
- [ ] Mover `sanitizeFilename`, `buildFilePrefix` e `buildEnrichedTxtContent` ou deixar pronto para extrair depois junto com transcricao.
- [ ] Atualizar `/api/enrich-metadata` para chamar o core com `platform: "tiktok"`.
- [ ] Atualizar `/api/insta_enrich-metadata` para chamar o core com `platform: "instagram"`.
- [ ] Atualizar rotas `/prompt` para usarem `lib/platform-prompts.ts`.
- [ ] Manter os mesmos payloads e retornos.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `lib/enrichment.ts`
- `app/api/enrich-metadata/route.ts`
- `app/api/insta_enrich-metadata/route.ts`
- `app/api/enrich-metadata/prompt/route.ts`
- `app/api/insta_enrich-metadata/prompt/route.ts`

Parar quando:

- Endpoints antigos continuam existindo e TikTok nao precisa enviar `platform`.

### Bloco 4 - Formulario parametrizado

Objetivo: unificar UI de busca sem mudar comportamento TikTok.

Tarefas:

- [ ] Criar `components/searchCountries.ts`.
- [ ] Criar `components/PlatformSearchForm.tsx`.
- [ ] Definir config TikTok sem regex bloqueante no frontend.
- [ ] Definir config Instagram com validacao atual preservada.
- [ ] Deixar config YouTube prevista, sem renderizar fluxo novo ainda.
- [ ] Migrar `app/page.tsx` para `PlatformSearchForm`.
- [ ] Migrar `components/insta_Panel.tsx` para `PlatformSearchForm`.
- [ ] Manter tipos de submit compativeis: TikTok envia `channelUrl`; Instagram envia `profileUrl`.
- [ ] Procurar imports restantes de `ChannelForm` e `insta_ChannelForm`.
- [ ] Remover ou transformar arquivos antigos em wrappers somente se seguro.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `components/searchCountries.ts`
- `components/PlatformSearchForm.tsx`
- `app/page.tsx`
- `components/insta_Panel.tsx`
- `components/ChannelForm.tsx`
- `components/insta_ChannelForm.tsx`

Parar quando:

- UI TikTok submete o mesmo payload anterior.

### Bloco 5 - Normalizacao com adapters

Objetivo: compartilhar helpers sem esconder comportamento especifico.

Tarefas:

- [ ] Extrair `safeString`, `safeNumber` e `getNestedField` para helper compartilhado.
- [ ] Preservar export `normalizeChannelVideos`.
- [ ] Preservar ou substituir com wrapper compativel `normalizeTranscripts`.
- [ ] Criar adapter Instagram com duas funcoes explicitas para profile e hashtag.
- [ ] Garantir que construcao de URL TikTok continua igual.
- [ ] Garantir que construcao de URL Instagram continua compativel.
- [ ] Atualizar imports de `lib/insta_normalize.ts` gradualmente.
- [ ] Rodar testes/fixtures TikTok.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `lib/normalize.ts`
- `lib/normalize/shared.ts` ou `lib/normalizeShared.ts`
- `lib/insta_normalize.ts`, se ainda existir
- rotas que importam normalizadores

Parar quando:

- Fixture TikTok gera exatamente a mesma estrutura de `ChannelVideoRow`.

### Bloco 6 - Busca por canal/perfil/hashtag

Objetivo: parametrizar a busca principal sem colidir com fetch por URLs/lote.

Tarefas:

- [ ] Criar `lib/search/shared.ts`.
- [ ] Criar `lib/search/tiktok.ts`.
- [ ] Criar `lib/search/instagram.ts`.
- [ ] Preservar TikTok: `APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper"`.
- [ ] Preservar TikTok: `resultsPerPage`, `proxyCountryCode`, `profiles`, `searchQueries`, `searchSection`, `maxProfilesPerQuery`, `hashtags`.
- [ ] Preservar Instagram: `Profile_Actor` para `profileUrl`.
- [ ] Preservar Instagram: `Hashtag_Actor` para `keyword` ou `hashtag`.
- [ ] Preservar deduplicacao Instagram por `videoUrl`.
- [ ] Atualizar `/api/fetch-channel` para chamar service TikTok.
- [ ] Atualizar `/api/insta_fetch-channel` para chamar service Instagram.
- [ ] Nao mexer em `/api/fetch-videos` neste bloco.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `lib/search/shared.ts`
- `lib/search/tiktok.ts`
- `lib/search/instagram.ts`
- `app/api/fetch-channel/route.ts`
- `app/api/insta_fetch-channel/route.ts`

Parar quando:

- Busca TikTok por canal, keyword e hashtag mantem payload e retorno.

### Bloco 7 - Helpers de transcricao

Objetivo: remover duplicacao de arquivos `.txt` sem unificar motores.

Tarefas:

- [ ] Criar `lib/transcription-files.ts`.
- [ ] Extrair `sanitizeFilename`.
- [ ] Extrair `buildFilePrefix`.
- [ ] Extrair `formatHashtags`.
- [ ] Extrair `buildTxtContent`.
- [ ] Atualizar `/api/transcribe-videos` preservando Apify.
- [ ] Atualizar `/api/insta_transcribe-videos` preservando yt-dlp + Whisper.
- [ ] Nao mudar `loadActorConfig`, `cleanTikTokUrl`, `getErrorSuffix`.
- [ ] Nao mudar `extractInstagramShortcode`.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `lib/transcription-files.ts`
- `app/api/transcribe-videos/route.ts`
- `app/api/insta_transcribe-videos/route.ts`

Parar quando:

- Nome e conteudo dos `.txt` TikTok continuam iguais.

### Bloco 8 - Busca por URLs/lote

Objetivo: extrair duplicacao entre `fetch-videos` e `insta_fetch-videos`.

Tarefas:

- [ ] Criar `lib/video-fetch/shared.ts`.
- [ ] Criar `lib/video-fetch/tiktok.ts`.
- [ ] Criar `lib/video-fetch/instagram.ts`.
- [ ] Preservar `/api/fetch-videos` como TikTok por `videoUrls`.
- [ ] Preservar `/api/insta_fetch-videos` como Instagram por `videoUrls`.
- [ ] Preservar actor TikTok `clockworks/tiktok-video-scraper`.
- [ ] Preservar input TikTok `{ postURLs: videoUrls }`.
- [ ] Preservar actor Instagram vindo de `Hashtag_Actor`.
- [ ] Preservar input Instagram `{ postURLs: videoUrls }`.
- [ ] Rodar lint/build.

Arquivos provaveis:

- `lib/video-fetch/shared.ts`
- `lib/video-fetch/tiktok.ts`
- `lib/video-fetch/instagram.ts`
- `app/api/fetch-videos/route.ts`
- `app/api/insta_fetch-videos/route.ts`

Parar quando:

- Chamadas existentes de `app/page.tsx` para `/api/fetch-videos` continuam validas.

### Bloco 9 - Preparacao explicita para YouTube

Objetivo: deixar claro onde YouTube entra sem implementar scraping agora.

Tarefas:

- [ ] Garantir que `PlatformId` inclui `youtube`.
- [ ] Garantir que configs de formulario aceitam YouTube, mas nao ativar UI se nao houver fluxo pronto.
- [ ] Garantir que prompts aceitam `youtube` sem quebrar fallback.
- [ ] Documentar quais adapters YouTube serao necessarios:
  - busca canal/keyword/hashtag;
  - busca por URLs/lote;
  - normalizacao;
  - transcricao via yt-dlp/legendas/Whisper;
  - enrichment prompt.
- [ ] Nao adicionar actor YouTube falso como se estivesse validado.
- [ ] Nao adicionar tab YouTube ativa antes da implementacao real.

Arquivos provaveis:

- `lib/platforms.ts`
- `PLANO_REFATORACAO_CODEX.MD`
- comentario curto em arquivo de config, se fizer sentido

Parar quando:

- A arquitetura mostra exatamente onde YouTube sera plugado depois.

### Bloco 10 - Limpeza e consolidacao

Objetivo: remover sobras sem quebrar contratos.

Tarefas:

- [ ] Rodar `rg` para imports antigos.
- [ ] Remover arquivos obsoletos somente se nao houver imports.
- [ ] Manter wrappers de rota se forem contratos publicos usados pela UI.
- [ ] Rodar `npm run lint`.
- [ ] Rodar `npm run build`.
- [ ] Atualizar `PLANO_REFATORACAO_CODEX.MD` se alguma decisao mudar.
- [ ] Fazer resumo das alteracoes e riscos restantes.

Parar quando:

- Build e lint passam, ou falhas preexistentes estao documentadas.
- TikTok foi validado no checklist principal.

## Checklist fixo antes de encerrar cada bloco

- [ ] `git status --short` revisado.
- [ ] Nenhum arquivo alheio revertido.
- [ ] TikTok preservado.
- [ ] Rotas antigas mantidas ou migradas com wrapper.
- [ ] Lint/build rodados quando aplicavel.
- [ ] Proximo bloco claramente definido.
