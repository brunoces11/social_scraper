# PLANO_REFATORACAO_CODEX.MD

## Objetivo

Criar uma refatoracao incremental para deixar o projeto preparado para multiplas redes sociais, com o maximo de parametrizacao util e sem duplicacao desnecessaria, usando o codigo atual do TikTok como unica fonte validada de comportamento.

Este plano nao autoriza adicionar novas funcionalidades de produto. YouTube e futuras plataformas devem ficar apenas como direcao arquitetural. A execucao deve preservar o TikTok primeiro, reduzir duplicacao em segundo lugar, e tratar Instagram como implementacao parcial ainda nao validada.

## Premissas obrigatorias

1. TikTok e a base funcional validada. Tudo que for extraido, parametrizado ou generalizado deve partir do comportamento atual do TikTok.
2. Instagram nao e fonte de verdade. Ele pode orientar diferencas por plataforma, mas nao deve forcar alteracoes no TikTok.
3. Refatoracao nao e reimplementacao. O fluxo, payloads, nomes de arquivos, XLS, prompts, downloads, transcricoes e retornos das APIs devem continuar compativeis.
4. Rotas antigas nao devem ser deletadas no mesmo passo em que uma abstracao nova nasce. Primeiro criar compatibilidade, testar, migrar chamadas, e so depois remover.
5. O projeto nao tem uma boa rede de testes automatizados; por isso a primeira fase precisa criar contratos minimos antes de tocar em comportamento.

## Critica do prompt/plano atual

O plano atual acerta ao identificar as maiores duplicacoes: `enrich-metadata`, formularios, `fetch-channel`, normalizacao e helpers de transcricao. Tambem acerta ao proteger `lib/apify.ts`, `lib/xls.ts`, `types/index.ts` e `app/api/download-video/route.ts`, que ja sao relativamente genericos.

Mas ele precisa ser corrigido antes de qualquer execucao:

1. Ele sugere criar `/api/fetch-videos`, mas essa rota ja existe e hoje e usada para busca de videos individuais/lote do TikTok com o actor `clockworks/tiktok-video-scraper`. Reaproveitar esse nome para busca multi-plataforma quebraria chamadas atuais em `app/page.tsx`.
2. Ele tambem nao separa claramente `app/api/insta_fetch-videos/route.ts`, que existe para busca de URLs/lote do Instagram. Essa familia de rotas deve ser refatorada separadamente de busca por canal/perfil/hashtag.
3. Ele trata Instagram como se fosse validado "exatamente como antes". Isso e arriscado. O criterio correto para Instagram e "nao piorar intencionalmente e manter compatibilidade aparente", enquanto o criterio rigido e para TikTok.
4. Ele sugere renomear `ai-prompt.txt` e `insta_ai-prompt.txt` logo na Fase 1. Isso pode quebrar as rotas de prompt existentes e qualquer fluxo/manual que edite esses arquivos. Melhor manter os nomes atuais inicialmente e introduzir um mapa de compatibilidade.
5. Ele manda deletar arquivos duplicados cedo demais. A remocao deve acontecer somente depois de wrappers, migracao de imports, build limpo e validacao do fluxo TikTok.
6. Ele afirma que `ChannelForm.tsx` do TikTok valida URL no frontend, mas o codigo atual nao faz essa validacao. Introduzir regex no formulario unificado mudaria comportamento do TikTok; se houver validacao, ela deve permanecer no servidor ou ser explicitamente compatibilizada.
7. Ele subestima a diferenca do Instagram em `insta_fetch-channel`: Instagram usa dois actors, normalizadores separados e deduplicacao por `videoUrl`. Isso nao deve virar um `buildInput` simplista.
8. Ele ignora as rotas de prompt: `app/api/enrich-metadata/prompt/route.ts` e `app/api/insta_enrich-metadata/prompt/route.ts` tambem precisam entrar na unificacao de prompts.
9. Ele propoe um field mapping generico para normalizacao, mas isso pode esconder regras especificas importantes, como construcao de URL do TikTok e diferencas entre Profile_Actor e Hashtag_Actor do Instagram. Melhor extrair helpers comuns primeiro e manter adapters por plataforma.
10. Ele menciona backup manual e rollback, mas o repositorio ja usa Git. O fluxo mais seguro e branch + commits pequenos + nao mexer em alteracoes nao rastreadas que nao fazem parte da fase.

## Arquitetura alvo corrigida

A arquitetura deve separar "comum" de "especifico" sem forcar uma abstracao unica grande demais:

- `lib/platforms.ts`: tipos, ids de plataforma e configuracoes pequenas.
- `lib/platform-prompts.ts`: resolucao de prompt por plataforma, mantendo arquivos atuais.
- `lib/enrichment.ts`: logica comum de enriquecimento AI.
- `lib/search/shared.ts`: validacao comum, filtro de blacklist, ordenacao e salvamento XLS.
- `lib/search/tiktok.ts`: montagem de input e normalizacao de busca TikTok.
- `lib/search/instagram.ts`: orquestracao dos dois actors do Instagram, ainda tratada como parcial.
- `lib/video-fetch/tiktok.ts` e `lib/video-fetch/instagram.ts`: busca por URLs/lote, preservando `/api/fetch-videos` e `/api/insta_fetch-videos`.
- `lib/normalize/shared.ts` ou helpers exportados em `lib/normalize.ts`: `safeString`, `safeNumber`, extracao comum e utilitarios.
- `components/PlatformSearchForm.tsx`: formulario parametrizado, mas preservando o comportamento exato do TikTok.
- Wrappers temporarios para rotas antigas: manter `/api/fetch-channel`, `/api/enrich-metadata`, `/api/insta_fetch-channel`, `/api/insta_enrich-metadata` enquanto a UI migra.

Evitar por enquanto uma unica mega-rota que tente resolver todos os casos. A meta e reduzir duplicacao sem perder clareza operacional.

## Ordem segura de execucao

### Fase 0 - Baseline e contratos antes da refatoracao

Objetivo: registrar o comportamento atual do TikTok antes de mexer em codigo.

Tarefas:

1. Criar branch de trabalho, por exemplo `codex/refatoracao-parametrizacao`.
2. Rodar `npm run lint` e, se possivel, `npm run build` para saber o estado inicial.
3. Criar fixtures pequenas para normalizacao TikTok com campos reais ja suportados: `playCount`, `diggCount`, `text`, `postPage`, `webVideoUrl`, `createTimeISO`, `challenges`.
4. Criar testes unitarios ou scripts de verificacao para:
   - `normalizeChannelVideos`;
   - montagem de input TikTok para canal, keyword e hashtag;
   - formatacao de nome/conteudo de arquivo de transcricao/enriquecimento, se extraida.
5. Documentar qualquer falha ja existente antes de refatorar.

Criterio de saida:

- Existe uma referencia objetiva do comportamento TikTok atual.
- Nenhuma refatoracao funcional foi feita ainda.

### Fase 1 - Enriquecimento AI com compatibilidade de prompts

Objetivo: eliminar a duplicacao quase total entre TikTok e Instagram sem renomear arquivos nem quebrar rotas.

Tarefas:

1. Criar `lib/platform-prompts.ts` com mapa inicial:
   - `tiktok -> ai-prompt.txt`;
   - `instagram -> insta_ai-prompt.txt`.
2. Criar `lib/enrichment.ts` com a logica comum hoje duplicada:
   - `sanitizeFilename`;
   - `buildFilePrefix`;
   - `buildEnrichedTxtContent`;
   - leitura de prompt por plataforma;
   - chamada OpenAI;
   - processamento em batches;
   - salvamento dos `.txt`.
3. Manter `app/api/enrich-metadata/route.ts` como rota TikTok, chamando a funcao comum com `platform: "tiktok"` por default.
4. Manter `app/api/insta_enrich-metadata/route.ts` como wrapper Instagram, chamando a mesma funcao comum com `platform: "instagram"`.
5. Unificar tambem a logica das rotas de prompt, mas preservar os endpoints atuais:
   - `/api/enrich-metadata/prompt`;
   - `/api/insta_enrich-metadata/prompt`.
6. Nao renomear `ai-prompt.txt` e `insta_ai-prompt.txt` nesta fase.

Criterio de saida:

- TikTok continua chamando `/api/enrich-metadata` sem precisar enviar `platform`.
- Instagram continua chamando `/api/insta_enrich-metadata`.
- Duplicacao interna foi reduzida, mas os contratos publicos continuam estaveis.

### Fase 2 - Formulario parametrizado sem mudar o TikTok

Objetivo: substituir a duplicacao de UI sem introduzir validacao nova no fluxo TikTok.

Tarefas:

1. Criar `components/PlatformSearchForm.tsx`.
2. Extrair `COUNTRIES` para um arquivo compartilhado, por exemplo `components/searchCountries.ts`.
3. Definir configuracao por plataforma com:
   - label do campo de URL;
   - placeholder;
   - nome do campo retornado no submit (`channelUrl` para TikTok, `profileUrl` para Instagram);
   - validacao opcional.
4. Para TikTok, preservar comportamento atual: URL opcional e sem bloqueio de submit por regex no frontend.
5. Para Instagram, preservar a validacao atual do frontend.
6. Migrar `app/page.tsx` e `components/insta_Panel.tsx` para o novo componente.
7. Manter `components/ChannelForm.tsx` e `components/insta_ChannelForm.tsx` temporariamente como wrappers ou remover apenas depois de confirmar que nao existem imports.

Criterio de saida:

- Tela TikTok renderiza e submete o mesmo payload de antes.
- Tela Instagram renderiza e submete o mesmo payload de antes.
- Nenhum comportamento novo e imposto ao TikTok.

### Fase 3 - Normalizacao por adapters, nao por abstracao excessiva

Objetivo: reduzir duplicacao de helpers e preparar plataformas sem perder regras especificas.

Tarefas:

1. Extrair helpers comuns:
   - `safeString`;
   - `safeNumber`;
   - extracao generica de campo simples/nested;
   - limpeza WebVTT, se continuar sendo usada por transcricao TikTok.
2. Manter adapter TikTok como fonte principal:
   - `normalizeChannelVideos` deve continuar exportada ou ganhar wrapper compativel.
3. Criar adapter Instagram unificado com duas variantes explicitas:
   - profile actor;
   - hashtag actor.
4. Evitar trocar tudo por um field map puro se isso dificultar regras como construcao de URL fallback.
5. Criar testes/fixtures para TikTok antes de migrar chamadas.
6. So depois migrar imports de `lib/insta_normalize.ts`.

Criterio de saida:

- `normalizeChannelVideos` retorna os mesmos campos para fixtures TikTok.
- Instagram continua com adapters separados para Profile_Actor e Hashtag_Actor.
- `lib/insta_normalize.ts` so e removido se nao houver imports restantes.

### Fase 4 - Busca por canal/perfil/hashtag com servico compartilhado

Objetivo: reduzir duplicacao entre `fetch-channel` e `insta_fetch-channel` sem colidir com `/api/fetch-videos`.

Tarefas:

1. Nao usar `/api/fetch-videos` para esta refatoracao, porque essa rota ja existe para busca de videos por URL no TikTok.
2. Criar uma camada de servico, por exemplo:
   - `lib/search/tiktok.ts`;
   - `lib/search/instagram.ts`;
   - `lib/search/shared.ts`.
3. Em `shared.ts`, extrair apenas o que e realmente comum:
   - validacao de entrada minima;
   - chamada `runActorAndGetResults`;
   - filtro de blacklist;
   - ordenacao por views;
   - montagem e salvamento XLS.
4. Em `tiktok.ts`, preservar exatamente:
   - actor `process.env.APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper"`;
   - `resultsPerPage`;
   - `proxyCountryCode`;
   - `profiles`;
   - `searchQueries`;
   - `searchSection`;
   - `maxProfilesPerQuery`;
   - split de hashtags por virgula.
5. Em `instagram.ts`, preservar a diferenca atual:
   - ler `instaActors` de `apify-actors.json`;
   - usar `Profile_Actor` quando houver `profileUrl`;
   - usar `Hashtag_Actor` quando houver `hashtag` ou `keyword`;
   - deduplicar por `videoUrl`;
   - usar normalizador correto para cada actor.
6. Manter as rotas antigas:
   - `/api/fetch-channel` chama o servico TikTok;
   - `/api/insta_fetch-channel` chama o servico Instagram.
7. Somente depois, se desejado, criar uma rota nova sem colisao, como `/api/search-videos`, e migrar a UI gradualmente.

Criterio de saida:

- Busca TikTok por canal, keyword e hashtag preservada.
- `/api/fetch-videos` existente continua intacta.
- Instagram nao perde sua logica de dois actors.

### Fase 5 - Helpers de transcricao

Objetivo: extrair duplicacao pequena sem misturar os motores de transcricao.

Tarefas:

1. Criar `lib/transcription-files.ts` com:
   - `sanitizeFilename`;
   - `buildFilePrefix`;
   - `formatHashtags`;
   - `buildTxtContent`.
2. Atualizar `app/api/transcribe-videos/route.ts` para importar helpers, mantendo:
   - Apify actors;
   - `loadActorConfig`;
   - `cleanTikTokUrl`;
   - tratamento de erro com fallback;
   - `getErrorSuffix`.
3. Atualizar `app/api/insta_transcribe-videos/route.ts` para importar helpers, mantendo:
   - yt-dlp;
   - Whisper;
   - `extractInstagramShortcode`;
   - limpeza de arquivo temporario.
4. Nao tentar unificar os motores de transcricao nesta etapa.

Criterio de saida:

- Arquivos `.txt` gerados para TikTok mantem nome, prefixo e formato.
- Fluxo TikTok por Apify segue isolado.
- Fluxo Instagram por yt-dlp + Whisper segue isolado.

### Fase 6 - Busca por URLs/lote

Objetivo: reduzir duplicacao entre `/api/fetch-videos` e `/api/insta_fetch-videos` sem mudar a semantica atual dessas rotas.

Tarefas:

1. Criar helpers comuns para:
   - validacao de `videoUrls`;
   - filtro de blacklist;
   - ordenacao por views;
   - salvamento XLS com `xlsLabel`.
2. Preservar `/api/fetch-videos` como rota TikTok por URLs/lote.
3. Preservar `/api/insta_fetch-videos` como rota Instagram por URLs/lote.
4. Separar configuracao de actor por plataforma, mas manter:
   - TikTok: `clockworks/tiktok-video-scraper` com `postURLs`;
   - Instagram: actor atual vindo de `Hashtag_Actor` e `postURLs`.
5. Nao misturar esta etapa com a busca por canal/perfil/hashtag.

Criterio de saida:

- Chamadas existentes em `app/page.tsx` continuam funcionando.
- As rotas de lote continuam com os mesmos nomes e payloads.
- A duplicacao comum foi extraida sem trocar actor ou payload do TikTok.

### Fase 7 - Limpeza controlada

Objetivo: remover duplicacao restante somente quando o fluxo estiver comprovado.

Tarefas:

1. Rodar busca por imports antigos.
2. Remover arquivos duplicados apenas se nao forem mais usados.
3. Se rotas antigas forem mantidas por compatibilidade, documentar que sao wrappers.
4. Rodar `npm run lint` e `npm run build`.
5. Fazer commit pequeno por fase concluida.

Criterio de saida:

- Nao ha imports quebrados.
- O build passa ou as falhas preexistentes estao documentadas.
- TikTok foi validado no fluxo completo.

## Checklist de validacao obrigatorio do TikTok

Executar apos cada fase que altere codigo:

- Buscar por canal TikTok.
- Buscar por keyword TikTok.
- Buscar por hashtag TikTok.
- Conferir ordenacao por views.
- Conferir filtro de blacklist.
- Conferir XLS salvo.
- Transcrever videos via actor selecionado.
- Conferir nomes dos `.txt`.
- Conferir conteudo dos `.txt`.
- Rodar enriquecimento AI usando `ai-prompt.txt`.
- Conferir rota de edicao de prompt TikTok.
- Baixar video via `download-video`.
- Conferir creditos Apify quando aplicavel.

## Checklist de compatibilidade Instagram

Como Instagram nao esta validado como fonte de verdade, usar este checklist para evitar regressao obvia:

- Buscar por perfil.
- Buscar por hashtag ou keyword.
- Confirmar uso de `Profile_Actor` e `Hashtag_Actor`.
- Confirmar deduplicacao por `videoUrl`.
- Transcrever via yt-dlp + Whisper.
- Rodar enriquecimento AI usando `insta_ai-prompt.txt`.
- Conferir rota de edicao de prompt Instagram.
- Baixar video via `download-video`.

## Regras de implementacao

1. Uma fase por vez.
2. Sem deletar rota ou arquivo antes de migracao e validacao.
3. Sem renomear prompts no inicio.
4. Sem reaproveitar `/api/fetch-videos` para outra semantica.
5. Sem transformar diferenca real de plataforma em `if` espalhado pela UI.
6. Preferir adapters pequenos a uma abstracao generica demais.
7. Toda mudanca que toca TikTok deve ter teste ou fixture de caracterizacao quando viavel.
8. Nao corrigir Instagram "por gosto" durante a refatoracao; qualquer correcao funcional deve ser tarefa separada.
9. Nao implementar YouTube nesta refatoracao.

## Resultado esperado

Ao fim da refatoracao, o projeto deve ter menos duplicacao e uma base clara para novas plataformas, mas sem sacrificar o unico fluxo validado. O TikTok deve continuar funcionando como hoje. Instagram deve continuar compativel com a implementacao atual. YouTube deve ficar mais facil de adicionar depois, por configuracao e adapters, nao por copia de arquivos.

## Ordem resumida

1. Baseline e testes de caracterizacao.
2. Enriquecimento AI compartilhado com prompts compativeis.
3. Formulario parametrizado preservando comportamento TikTok.
4. Normalizacao com helpers comuns e adapters por plataforma.
5. Busca com servicos compartilhados, sem colisao com `/api/fetch-videos`.
6. Helpers de transcricao, sem misturar motores.
7. Busca por URLs/lote preservando `/api/fetch-videos` e `/api/insta_fetch-videos`.
8. Limpeza final com build, lint e validacao TikTok completa.
