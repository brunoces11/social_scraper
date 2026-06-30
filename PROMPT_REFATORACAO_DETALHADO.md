# PROMPT DETALHADO: Refatoração Multi-Plataforma para Máxima Parametrização

## 🎯 OBJETIVO PRINCIPAL

Você é um desenvolvedor senior especializado em refatoração de código. Sua missão é refatorar uma aplicação Next.js de scraping de vídeos para eliminar duplicação de código e atingir o máximo nível de parametrização, preparando a base para suportar múltiplas plataformas (TikTok, Instagram, YouTube e futuras) de forma escalável e manutenível.

**REGRA CRÍTICA #1:** O TikTok é a ÚNICA plataforma totalmente funcional e operacional. TODAS as funcionalidades do TikTok devem ser PRESERVADAS integralmente. Qualquer quebra de funcionalidade do TikTok é INACEITÁVEL.

**REGRA CRÍTICA #2:** Não adicione novas funcionalidades. Apenas refatore código existente para eliminar duplicação e parametrizar.

**REGRA CRÍTICA #3:** Teste cada refatoração incrementalmente para garantir que TikTok continua funcionando.

---

## 📋 CONTEXTO DO PROJETO

### Estrutura Atual

**Aplicação:** Next.js 14 (App Router) com TypeScript
**Objetivo:** Scraping de vídeos de redes sociais (TikTok, Instagram, YouTube)
**Tecnologias:** Apify (scraping), OpenAI (enriquecimento), yt-dlp (download), Whisper (transcrição)

### Status Atual das Plataformas

1. **TikTok:** ✅ 100% funcional
   - Busca por canal, keyword, hashtag
   - Transcrição via Apify actors
   - Enriquecimento AI via OpenAI
   - Download de vídeos via yt-dlp
   - Salvamento em XLS
   - Sistema de créditos Apify

2. **Instagram:** 🟡 Parcialmente implementado
   - Busca funcional
   - Transcrição via yt-dlp + Whisper (abordagem diferente do TikTok)
   - Enriquecimento AI funcional
   - Download funcional
   - **PROBLEMA:** Código 90-98% duplicado do TikTok

3. **YouTube:** ❌ Não implementado
   - Será implementado APÓS a refatoração

### Problema Identificado

Quando Instagram foi implementado, o código do TikTok foi COPIADO e adaptado, resultando em:
- ~930 linhas de código duplicado
- Manutenção duplicada (bugs precisam ser corrigidos em 2 lugares)
- Impossibilidade de adicionar YouTube sem triplicar a duplicação

---

## 🔍 ANÁLISE DETALHADA DA DUPLICAÇÃO

### Camadas Bem Parametrizadas (NÃO MEXER)

1. **`lib/apify.ts`** - ✅ 100% parametrizado
   - Função `runActorAndGetResults(actorId, input, accountId)` aceita qualquer actor
   - Suporta múltiplas contas Apify
   - Polling automático, retry logic, logs detalhados
   - **AÇÃO:** Nenhuma - usar diretamente

2. **`types/index.ts`** - ✅ 100% parametrizado
   - `ChannelVideoRow` e `TranscriptRow` são universais
   - Funcionam para TikTok, Instagram e YouTube
   - **AÇÃO:** Nenhuma - usar diretamente

3. **`lib/xls.ts`** - ✅ 100% parametrizado
   - Funções agnósticas de plataforma
   - Blacklist compartilhada
   - **AÇÃO:** Nenhuma - usar diretamente

4. **`app/api/download-video/route.ts`** - ✅ 100% parametrizado
   - Usa yt-dlp que suporta TikTok, Instagram E YouTube
   - Modo normal e x5 variants
   - **AÇÃO:** Nenhuma - usar diretamente

### Camadas com Duplicação CRÍTICA (REFATORAR)

#### 1. API Enrich Metadata - 98% DUPLICADO 🔴

**Arquivos:**
- `app/api/enrich-metadata/route.ts` (TikTok)
- `app/api/insta_enrich-metadata/route.ts` (Instagram)

**Análise:**
- 250 linhas de código
- 98% idêntico
- **ÚNICA DIFERENÇA:** Nome do arquivo de prompt
  ```typescript
  // TikTok
  const PROMPT_FILE = path.join(process.cwd(), "ai-prompt.txt");
  
  // Instagram
  const PROMPT_FILE = path.join(process.cwd(), "insta_ai-prompt.txt");
  ```

**Código Idêntico:**
- Validação de entrada
- Chamada OpenAI com batch processing
- Retry logic
- Salvamento de arquivos .txt
- Tratamento de erros
- Debug logs

**Impacto:** Esta é a duplicação mais absurda - 250 linhas duplicadas por causa de 1 linha diferente!



#### 2. Componente ChannelForm - 97% DUPLICADO 🔴

**Arquivos:**
- `components/ChannelForm.tsx` (TikTok)
- `components/insta_ChannelForm.tsx` (Instagram)

**Análise:**
- 180 linhas de código
- 97% idêntico
- Lista de 50 países IDÊNTICA em ambos
- Lógica de formulário 100% idêntica
- Validação 100% idêntica

**ÚNICAS DIFERENÇAS:**
```typescript
// TikTok
<label>Channel URL</label>
<input placeholder="https://www.tiktok.com/@usuario" />
const pattern = /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/;

// Instagram
<label>Profile URL</label>
<input placeholder="https://www.instagram.com/username/" />
const pattern = /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/;
```

**Impacto:** 180 linhas duplicadas por causa de labels e regex diferentes!

#### 3. API Fetch Channel - 90% DUPLICADO 🔴

**Arquivos:**
- `app/api/fetch-channel/route.ts` (TikTok)
- `app/api/insta_fetch-channel/route.ts` (Instagram)

**Análise:**
- 200 linhas de código
- 90% idêntico

**Código Idêntico:**
- Validação de entrada (channelUrl, keyword, hashtag)
- Chamada `runActorAndGetResults` (já parametrizada)
- Filtro de blacklist via `getBlacklist()`
- Ordenação por views
- Salvamento XLS via `saveSearchToXls()`
- Tratamento de erros e timeout

**DIFERENÇAS REAIS:**
1. Regex de validação de URL
2. Actor ID usado (TikTok: hardcoded, Instagram: via config)
3. Campos de input do actor (profiles vs profileUrl)
4. Função de normalização chamada

**Impacto:** 200 linhas duplicadas

#### 4. Normalização - 80% DUPLICADO 🔴

**Arquivos:**
- `lib/normalize.ts` (TikTok)
- `lib/insta_normalize.ts` (Instagram)

**Análise:**
- 150 linhas de código
- 80% idêntico

**Funções Helper IDÊNTICAS:**
```typescript
function safeString(value: any): string { ... }  // 100% IDÊNTICO
function safeNumber(value: any): number { ... }  // 100% IDÊNTICO
function extractHashtags(item: any): string[] { ... }  // 90% SIMILAR
```

**DIFERENÇAS REAIS:**
Apenas os nomes dos campos da API:
- TikTok: `playCount`, `diggCount`, `text`, `postPage`
- Instagram: `play_count`, `like_count`, `caption_text`, `reel_url`

**Impacto:** 150 linhas duplicadas

#### 5. Transcrição - 50% DUPLICADO 🟡

**Arquivos:**
- `app/api/transcribe-videos/route.ts` (TikTok)
- `app/api/insta_transcribe-videos/route.ts` (Instagram)

**Análise:**
- 150 linhas de código
- 50% idêntico
- **ABORDAGENS DIFERENTES:**
  - TikTok: Usa Apify actors (configurável)
  - Instagram: Usa yt-dlp + OpenAI Whisper

**Funções Helper Duplicadas:**
- `sanitizeFilename()` - IDÊNTICO
- `buildFilePrefix()` - IDÊNTICO
- `buildTxtContent()` - IDÊNTICO

**Impacto:** 150 linhas duplicadas (helpers + lógica de salvamento)

---

## 🎯 PLANO DE REFATORAÇÃO DETALHADO

### FASE 1: Refatoração de Enrich Metadata (PRIORIDADE MÁXIMA)

**Tempo Estimado:** 2 horas
**Complexidade:** BAIXA
**Impacto:** Elimina 250 linhas duplicadas

**Objetivo:** Criar endpoint unificado que recebe `platform` como parâmetro

**Passos Detalhados:**

1. **Renomear arquivos de prompt:**
   ```
   ai-prompt.txt → ai-prompt-tiktok.txt
   insta_ai-prompt.txt → ai-prompt-instagram.txt
   ```

2. **Criar mapeamento de prompts:**
   ```typescript
   const PROMPT_FILES: Record<string, string> = {
     tiktok: 'ai-prompt-tiktok.txt',
     instagram: 'ai-prompt-instagram.txt',
     youtube: 'ai-prompt-youtube.txt',
   };
   ```

3. **Modificar `app/api/enrich-metadata/route.ts`:**
   - Adicionar parâmetro `platform` no body
   - Usar `PROMPT_FILES[platform]` para selecionar prompt
   - Manter TODO o resto do código idêntico

4. **Atualizar chamadas no frontend:**
   - `app/page.tsx`: adicionar `platform: 'tiktok'` no body
   - `components/insta_Panel.tsx`: adicionar `platform: 'instagram'` no body

5. **Deletar arquivo duplicado:**
   - Remover `app/api/insta_enrich-metadata/route.ts`
   - Remover pasta `app/api/insta_enrich-metadata/`

6. **TESTAR:**
   - ✅ TikTok: buscar vídeos → transcrever → enriquecer AI
   - ✅ Instagram: buscar vídeos → transcrever → enriquecer AI
   - ✅ Verificar que arquivos .txt são salvos corretamente
   - ✅ Verificar que prompts corretos são usados

**Critério de Sucesso:** TikTok e Instagram continuam funcionando EXATAMENTE como antes



### FASE 2: Refatoração de ChannelForm (PRIORIDADE ALTA)

**Tempo Estimado:** 2 horas
**Complexidade:** BAIXA
**Impacto:** Elimina 180 linhas duplicadas

**Objetivo:** Criar componente unificado `PlatformSearchForm` com configuração por plataforma

**Passos Detalhados:**

1. **Criar arquivo de configuração:**
   ```typescript
   // components/PlatformSearchForm.tsx
   interface PlatformConfig {
     urlLabel: string;
     urlPlaceholder: string;
     urlPattern: RegExp;
     urlErrorMessage: string;
     urlFieldName: string; // 'channelUrl' ou 'profileUrl'
   }
   
   const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
     tiktok: {
       urlLabel: 'Channel URL',
       urlPlaceholder: 'https://www.tiktok.com/@usuario',
       urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/,
       urlErrorMessage: 'Invalid TikTok URL',
       urlFieldName: 'channelUrl',
     },
     instagram: {
       urlLabel: 'Profile URL',
       urlPlaceholder: 'https://www.instagram.com/username/',
       urlPattern: /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/,
       urlErrorMessage: 'Invalid Instagram URL',
       urlFieldName: 'profileUrl',
     },
     youtube: {
       urlLabel: 'Channel URL',
       urlPlaceholder: 'https://www.youtube.com/@channel',
       urlPattern: /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+\/?$/,
       urlErrorMessage: 'Invalid YouTube URL',
       urlFieldName: 'channelUrl',
     },
   };
   ```

2. **Criar componente unificado:**
   - Copiar código de `ChannelForm.tsx` como base
   - Adicionar prop `platform: 'tiktok' | 'instagram' | 'youtube'`
   - Usar `PLATFORM_CONFIGS[platform]` para labels, placeholders, regex
   - Manter lista de países (COUNTRIES) idêntica
   - Manter toda lógica de validação e submit

3. **Atualizar `app/page.tsx`:**
   ```typescript
   import PlatformSearchForm from "@/components/PlatformSearchForm";
   
   // Substituir:
   <ChannelForm onSubmit={handleFetchChannel} isLoading={isFetchingChannel} />
   
   // Por:
   <PlatformSearchForm 
     platform="tiktok" 
     onSubmit={handleFetchChannel} 
     isLoading={isFetchingChannel} 
   />
   ```

4. **Atualizar `components/insta_Panel.tsx`:**
   ```typescript
   import PlatformSearchForm from "@/components/PlatformSearchForm";
   
   // Substituir:
   <InstaChannelForm onSubmit={handleFetchChannel} isLoading={isFetchingChannel} />
   
   // Por:
   <PlatformSearchForm 
     platform="instagram" 
     onSubmit={handleFetchChannel} 
     isLoading={isFetchingChannel} 
   />
   ```

5. **Deletar arquivos duplicados:**
   - Remover `components/ChannelForm.tsx`
   - Remover `components/insta_ChannelForm.tsx`

6. **TESTAR:**
   - ✅ TikTok: formulário renderiza corretamente
   - ✅ TikTok: validação de URL funciona
   - ✅ TikTok: busca por canal, keyword, hashtag funciona
   - ✅ Instagram: formulário renderiza corretamente
   - ✅ Instagram: validação de URL funciona
   - ✅ Instagram: busca funciona

**Critério de Sucesso:** Formulários TikTok e Instagram funcionam EXATAMENTE como antes

### FASE 3: Refatoração de Normalização (PRIORIDADE ALTA)

**Tempo Estimado:** 3 horas
**Complexidade:** MÉDIA
**Impacto:** Elimina 150 linhas duplicadas

**Objetivo:** Criar sistema de field mapping por plataforma

**Passos Detalhados:**

1. **Criar interface de field mapping:**
   ```typescript
   // lib/normalize.ts
   interface PlatformFieldMap {
     videoId: string[];
     title: string[];
     description: string[];
     views: string[];
     likes: string[];
     comments: string[];
     videoUrl: string[];
     publishDate: string[];
     hashtags: string[];
   }
   ```

2. **Criar mapeamentos por plataforma:**
   ```typescript
   const PLATFORM_FIELD_MAPS: Record<string, PlatformFieldMap> = {
     tiktok: {
       videoId: ['id', 'videoId'],
       title: ['text', 'desc', 'title', 'description'],
       description: ['text', 'desc', 'title', 'description'],
       views: ['playCount', 'views', 'viewCount'],
       likes: ['diggCount', 'likes', 'likeCount'],
       comments: ['commentCount', 'comments'],
       videoUrl: ['postPage', 'webVideoUrl', 'videoUrl', 'url'],
       publishDate: ['createTimeISO', 'createTime', 'uploadedAtFormatted', 'publishDate'],
       hashtags: ['challenges', 'hashtags'],
     },
     instagram: {
       videoId: ['reel_id', 'id', 'videoId'],
       title: ['caption_text', 'caption', 'description'],
       description: ['caption_text', 'caption', 'description'],
       views: ['play_count', 'videoPlayCount', 'views', 'viewCount'],
       likes: ['like_count', 'likesCount', 'likes', 'likeCount'],
       comments: ['comment_count', 'commentsCount', 'comments', 'commentCount'],
       videoUrl: ['reel_url', 'url', 'videoUrl'],
       publishDate: ['taken_at_iso', 'timestamp', 'publishDate'],
       hashtags: ['hashtags'],
     },
     youtube: {
       videoId: ['id', 'videoId', 'snippet.resourceId.videoId'],
       title: ['snippet.title', 'title'],
       description: ['snippet.description', 'description'],
       views: ['statistics.viewCount', 'viewCount', 'views'],
       likes: ['statistics.likeCount', 'likeCount', 'likes'],
       comments: ['statistics.commentCount', 'commentCount', 'comments'],
       videoUrl: ['url', 'videoUrl'],
       publishDate: ['snippet.publishedAt', 'publishedAt', 'publishDate'],
       hashtags: ['snippet.tags', 'tags', 'hashtags'],
     },
   };
   ```

3. **Criar função helper para buscar campo:**
   ```typescript
   function getFieldValue(item: any, fieldPaths: string[]): any {
     for (const path of fieldPaths) {
       // Suporta nested fields (e.g., 'snippet.title')
       const value = path.split('.').reduce((obj, key) => obj?.[key], item);
       if (value !== undefined && value !== null) return value;
     }
     return undefined;
   }
   ```

4. **Criar função unificada de normalização:**
   ```typescript
   export function normalizeVideos(rawItems: any[], platform: string): ChannelVideoRow[] {
     const fieldMap = PLATFORM_FIELD_MAPS[platform];
     if (!fieldMap) {
       throw new Error(`Unknown platform: ${platform}`);
     }
     
     return rawItems.map((item) => {
       const desc = safeString(getFieldValue(item, fieldMap.description));
       return {
         videoId: safeString(getFieldValue(item, fieldMap.videoId)),
         title: desc.substring(0, 80),
         description: desc,
         views: safeNumber(getFieldValue(item, fieldMap.views)),
         likes: safeNumber(getFieldValue(item, fieldMap.likes)),
         hashtags: extractHashtags(item, fieldMap.hashtags),
         videoUrl: buildVideoUrl(item, fieldMap.videoUrl),
         comments: safeNumber(getFieldValue(item, fieldMap.comments)) || undefined,
         publishDate: safeString(getFieldValue(item, fieldMap.publishDate)) || undefined,
       };
     });
   }
   ```

5. **Manter funções helper:**
   - `safeString()` - manter
   - `safeNumber()` - manter
   - `extractHashtags()` - adaptar para usar field map
   - `buildVideoUrl()` - adaptar para usar field map
   - `cleanWebVtt()` - manter (usado em transcrição)

6. **Atualizar chamadas:**
   - `app/api/fetch-channel/route.ts`: `normalizeVideos(rawItems, 'tiktok')`
   - `app/api/insta_fetch-channel/route.ts`: `normalizeVideos(rawItems, 'instagram')`

7. **Deletar arquivo duplicado:**
   - Remover `lib/insta_normalize.ts`

8. **TESTAR:**
   - ✅ TikTok: buscar vídeos e verificar dados normalizados
   - ✅ Instagram: buscar vídeos e verificar dados normalizados
   - ✅ Verificar que todos os campos estão corretos (videoId, title, views, likes, etc.)

**Critério de Sucesso:** Normalização funciona EXATAMENTE como antes para ambas plataformas



### FASE 4: Refatoração de Fetch Channel (PRIORIDADE MÉDIA)

**Tempo Estimado:** 4 horas
**Complexidade:** MÉDIA-ALTA
**Impacto:** Elimina 200 linhas duplicadas

**Objetivo:** Criar endpoint unificado `/api/fetch-videos` que recebe `platform` como parâmetro

**Passos Detalhados:**

1. **Criar arquivo de configuração de actors:**
   ```typescript
   // lib/platform-actors.ts
   interface ActorConfig {
     id: string;
     buildInput: (params: SearchParams) => Record<string, unknown>;
     urlPattern?: RegExp;
     urlErrorMessage?: string;
   }
   
   export const PLATFORM_ACTORS: Record<string, ActorConfig> = {
     tiktok: {
       id: process.env.APIFY_CHANNEL_ACTOR_ID || 'clockworks/tiktok-scraper',
       urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/,
       urlErrorMessage: 'Invalid URL. Use format: https://www.tiktok.com/@username',
       buildInput: (params) => {
         const input: Record<string, unknown> = {
           resultsPerPage: params.maxVideos || 50,
           proxyCountryCode: params.countryCode || 'None',
         };
         if (params.channelUrl) input.profiles = [params.channelUrl];
         if (params.keyword) {
           input.searchQueries = [params.keyword];
           input.searchSection = '';
           input.maxProfilesPerQuery = 10;
         }
         if (params.hashtag) {
           const tags = params.hashtag.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
           if (tags.length > 0) input.hashtags = tags;
         }
         return input;
       },
     },
     instagram: {
       id: 'scrapium/instagram-reels-scraper',
       urlPattern: /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/,
       urlErrorMessage: 'Invalid URL. Use format: https://www.instagram.com/username',
       buildInput: (params) => {
         // Instagram usa actors diferentes para profile vs hashtag
         // Esta lógica precisa ser adaptada
         const input: Record<string, unknown> = {
           resultsPerPage: params.maxVideos || 50,
           proxyCountryCode: params.countryCode || 'None',
         };
         if (params.profileUrl) input.profileUrl = params.profileUrl;
         return input;
       },
     },
     youtube: {
       id: 'streamers/youtube-scraper',
       urlPattern: /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+\/?$/,
       urlErrorMessage: 'Invalid URL. Use format: https://www.youtube.com/@channel',
       buildInput: (params) => {
         const input: Record<string, unknown> = {
           maxResults: params.maxVideos || 50,
         };
         if (params.channelUrl) input.channelUrls = [params.channelUrl];
         if (params.keyword) input.searchQueries = [params.keyword];
         return input;
       },
     },
   };
   ```

2. **Criar endpoint unificado:**
   ```typescript
   // app/api/fetch-videos/route.ts
   import { NextRequest, NextResponse } from "next/server";
   import { runActorAndGetResults } from "@/lib/apify";
   import { normalizeVideos } from "@/lib/normalize";
   import { buildSearchLabel, saveSearchToXls, getBlacklist } from "@/lib/xls";
   import { PLATFORM_ACTORS } from "@/lib/platform-actors";
   
   export const maxDuration = 300;
   
   export async function POST(request: NextRequest) {
     try {
       const body = await request.json();
       const { platform, channelUrl, profileUrl, keyword, hashtag, maxVideos = 50, countryCode = "BR", accountId } = body;
       
       // Validar plataforma
       const actorConfig = PLATFORM_ACTORS[platform];
       if (!actorConfig) {
         return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
       }
       
       // Validar entrada
       const urlToValidate = channelUrl || profileUrl;
       if (!urlToValidate && !keyword && !hashtag) {
         return NextResponse.json(
           { error: "Fill in at least one field: URL, keyword, or hashtag." },
           { status: 400 }
         );
       }
       
       // Validar URL se fornecida
       if (urlToValidate && actorConfig.urlPattern && !actorConfig.urlPattern.test(urlToValidate.trim())) {
         return NextResponse.json(
           { error: actorConfig.urlErrorMessage || "Invalid URL" },
           { status: 400 }
         );
       }
       
       // Build input usando config
       const input = actorConfig.buildInput({ channelUrl, profileUrl, keyword, hashtag, maxVideos, countryCode });
       
       // Chamada Apify (já parametrizada)
       const rawItems = await runActorAndGetResults(actorConfig.id, input, accountId);
       
       // Normalização usando platform
       const allRows = normalizeVideos(rawItems, platform);
       
       // Filtro blacklist
       const blacklist = getBlacklist();
       const rows = allRows.filter((r) => !blacklist.has(r.videoUrl));
       
       // Ordenação por views
       rows.sort((a, b) => b.views - a.views);
       
       // Salvamento XLS
       let savedFile = "";
       try {
         const label = buildSearchLabel({ channelUrl: urlToValidate, keyword, hashtag });
         const xlsRows = rows.map((r) => ({
           video_title: r.title,
           views: r.views,
           description: r.description,
           likes: r.likes,
           hashtags: r.hashtags.join(", "),
           video_url: r.videoUrl,
           comments: r.comments ?? "",
           publish_date: r.publishDate ?? "",
         }));
         savedFile = saveSearchToXls(label, xlsRows);
       } catch (xlsErr) {
         console.error("Error saving XLS:", xlsErr);
       }
       
       return NextResponse.json({ rows, savedFile });
     } catch (error: unknown) {
       const message = error instanceof Error ? error.message : "Unknown error";
       if (message.includes("TIMEOUT")) {
         return NextResponse.json({ error: message }, { status: 504 });
       }
       return NextResponse.json({ error: `Error fetching data: ${message}` }, { status: 500 });
     }
   }
   ```

3. **Atualizar chamadas no frontend:**
   - `app/page.tsx`: 
     ```typescript
     const res = await fetch("/api/fetch-videos", {
       method: "POST",
       body: JSON.stringify({ platform: 'tiktok', ...params, accountId: selectedAccountId }),
     });
     ```
   
   - `components/insta_Panel.tsx`:
     ```typescript
     const res = await fetch("/api/fetch-videos", {
       method: "POST",
       body: JSON.stringify({ platform: 'instagram', ...params, accountId: selectedAccountId }),
     });
     ```

4. **IMPORTANTE - Instagram usa 2 actors:**
   - Profile_Actor para busca por perfil
   - Hashtag_Actor para busca por hashtag/keyword
   - Precisará adaptar lógica para chamar actor correto baseado nos parâmetros

5. **Deletar arquivos duplicados:**
   - Remover `app/api/fetch-channel/route.ts`
   - Remover pasta `app/api/fetch-channel/`
   - Remover `app/api/insta_fetch-channel/route.ts`
   - Remover pasta `app/api/insta_fetch-channel/`

6. **TESTAR:**
   - ✅ TikTok: busca por canal
   - ✅ TikTok: busca por keyword
   - ✅ TikTok: busca por hashtag
   - ✅ TikTok: validação de URL
   - ✅ TikTok: salvamento XLS
   - ✅ Instagram: busca por perfil
   - ✅ Instagram: busca por hashtag
   - ✅ Instagram: validação de URL

**Critério de Sucesso:** Busca funciona EXATAMENTE como antes para ambas plataformas

**ATENÇÃO:** Esta é a refatoração mais complexa. Teste MUITO bem antes de deletar arquivos antigos.



### FASE 5: Refatoração de Helpers de Transcrição (PRIORIDADE BAIXA)

**Tempo Estimado:** 2 horas
**Complexidade:** BAIXA
**Impacto:** Elimina ~50 linhas duplicadas

**Objetivo:** Extrair funções helper compartilhadas para arquivo comum

**Passos Detalhados:**

1. **Criar arquivo de helpers:**
   ```typescript
   // lib/transcription-helpers.ts
   
   export function sanitizeFilename(title: string): string {
     return title
       .normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .replace(/[^a-zA-Z0-9]/g, "_")
       .replace(/_+/g, "_")
       .replace(/^_|_$/g, "")
       .substring(0, 100);
   }
   
   const MONTH_ABBR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
   
   export function buildFilePrefix(views: number, publishDate: string): string {
     let datePart = "";
     if (publishDate) {
       const d = new Date(publishDate);
       if (!isNaN(d.getTime())) {
         const mmm = MONTH_ABBR[d.getMonth()];
         const aa = String(d.getFullYear()).slice(-2);
         datePart = `${mmm}${aa}`;
       }
     }
     const v = views || 0;
     const tier = v >= 10_000_000 ? "1A" : v >= 1_000_000 ? "2A" : "3A";
     const viewsPart = String(v);
     return datePart ? `${tier}_${viewsPart}-${datePart}-` : `${tier}_${viewsPart}-`;
   }
   
   export function buildTxtContent(meta: VideoMeta, transcript: string): string {
     const hashtags = Array.isArray(meta.hashtags) 
       ? meta.hashtags.join(", ") 
       : String(meta.hashtags || "");
     
     return `Title: ${meta.title}

Description: ${meta.description}

Hashtags: ${hashtags}

Transcription: ${transcript}

Views: ${meta.views.toLocaleString("en-US")}

Likes: ${meta.likes.toLocaleString("en-US")}

Link: ${meta.videoUrl}

Date: ${meta.publishDate}`;
   }
   
   export interface VideoMeta {
     title: string;
     views: number;
     likes: number;
     comments?: number;
     description: string;
     hashtags: string[] | string;
     videoUrl: string;
     publishDate: string;
   }
   ```

2. **Atualizar `app/api/transcribe-videos/route.ts`:**
   - Importar helpers: `import { sanitizeFilename, buildFilePrefix, buildTxtContent, VideoMeta } from "@/lib/transcription-helpers";`
   - Remover funções duplicadas
   - Manter lógica específica do Apify

3. **Atualizar `app/api/insta_transcribe-videos/route.ts`:**
   - Importar helpers: `import { sanitizeFilename, buildFilePrefix, buildTxtContent, VideoMeta } from "@/lib/transcription-helpers";`
   - Remover funções duplicadas
   - Manter lógica específica do yt-dlp + Whisper

4. **TESTAR:**
   - ✅ TikTok: transcrever vídeos
   - ✅ TikTok: verificar nomes de arquivos .txt
   - ✅ TikTok: verificar conteúdo dos arquivos
   - ✅ Instagram: transcrever vídeos
   - ✅ Instagram: verificar nomes de arquivos .txt
   - ✅ Instagram: verificar conteúdo dos arquivos

**Critério de Sucesso:** Transcrição funciona EXATAMENTE como antes

---

## ⚠️ REGRAS CRÍTICAS DE SEGURANÇA

### ANTES DE CADA REFATORAÇÃO:

1. **BACKUP:** Criar backup dos arquivos que serão modificados
2. **BRANCH:** Trabalhar em branch separada (`refactor/parametrization`)
3. **COMMIT:** Fazer commit após cada fase bem-sucedida
4. **TESTE:** Testar TikTok COMPLETAMENTE antes de prosseguir

### DURANTE A REFATORAÇÃO:

1. **INCREMENTAL:** Fazer uma refatoração por vez
2. **TESTE CONTÍNUO:** Testar após cada mudança
3. **ROLLBACK:** Se algo quebrar, fazer rollback imediato
4. **DOCUMENTAR:** Documentar mudanças e decisões

### APÓS CADA REFATORAÇÃO:

1. **TESTE COMPLETO TikTok:**
   - Buscar por canal
   - Buscar por keyword
   - Buscar por hashtag
   - Transcrever vídeos
   - Enriquecer com AI
   - Baixar vídeos
   - Verificar XLS
   - Verificar créditos Apify

2. **TESTE COMPLETO Instagram:**
   - Buscar por perfil
   - Buscar por hashtag
   - Transcrever vídeos
   - Enriquecer com AI
   - Baixar vídeos

3. **VERIFICAR:**
   - Nenhum erro no console
   - Nenhum warning de TypeScript
   - Arquivos salvos corretamente
   - Créditos contabilizados corretamente

### SE ALGO QUEBRAR:

1. **PARAR IMEDIATAMENTE**
2. **FAZER ROLLBACK**
3. **ANALISAR O PROBLEMA**
4. **CORRIGIR E TESTAR NOVAMENTE**
5. **NÃO PROSSEGUIR ATÉ FUNCIONAR 100%**

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Após Fase 1 (Enrich Metadata):
- [ ] TikTok: buscar vídeos → transcrever → enriquecer AI → verificar arquivo .txt
- [ ] Instagram: buscar vídeos → transcrever → enriquecer AI → verificar arquivo .txt
- [ ] Verificar que prompt correto é usado (TikTok vs Instagram)
- [ ] Verificar que arquivos têm formato correto
- [ ] Nenhum erro no console

### Após Fase 2 (ChannelForm):
- [ ] TikTok: formulário renderiza com labels corretos
- [ ] TikTok: validação de URL funciona
- [ ] TikTok: busca funciona
- [ ] Instagram: formulário renderiza com labels corretos
- [ ] Instagram: validação de URL funciona
- [ ] Instagram: busca funciona
- [ ] Lista de países funciona em ambos

### Após Fase 3 (Normalização):
- [ ] TikTok: buscar vídeos e verificar todos os campos (videoId, title, views, likes, hashtags, etc.)
- [ ] Instagram: buscar vídeos e verificar todos os campos
- [ ] Verificar que hashtags são extraídos corretamente
- [ ] Verificar que URLs são construídas corretamente
- [ ] Verificar que datas são formatadas corretamente

### Após Fase 4 (Fetch Channel):
- [ ] TikTok: busca por canal funciona
- [ ] TikTok: busca por keyword funciona
- [ ] TikTok: busca por hashtag funciona
- [ ] TikTok: validação de URL funciona
- [ ] TikTok: XLS é salvo corretamente
- [ ] Instagram: busca por perfil funciona
- [ ] Instagram: busca por hashtag funciona
- [ ] Instagram: validação de URL funciona
- [ ] Instagram: XLS é salvo corretamente

### Após Fase 5 (Helpers):
- [ ] TikTok: transcrição funciona
- [ ] TikTok: nomes de arquivos corretos
- [ ] TikTok: conteúdo de arquivos correto
- [ ] Instagram: transcrição funciona
- [ ] Instagram: nomes de arquivos corretos
- [ ] Instagram: conteúdo de arquivos correto

---

## 🎯 RESULTADO ESPERADO

Após completar todas as fases:

1. **Código Limpo:**
   - ~930 linhas de código duplicado eliminadas
   - Arquitetura multi-plataforma escalável
   - Fácil adicionar YouTube e futuras plataformas

2. **Funcionalidade Preservada:**
   - TikTok funciona EXATAMENTE como antes
   - Instagram funciona EXATAMENTE como antes
   - Nenhuma regressão

3. **Preparado para YouTube:**
   - Adicionar YouTube requer apenas:
     - Configurar actor em `PLATFORM_ACTORS`
     - Adicionar field map em `PLATFORM_FIELD_MAPS`
     - Adicionar config em `PLATFORM_CONFIGS`
     - Criar `ai-prompt-youtube.txt`
     - Adicionar tab na UI

4. **Manutenibilidade:**
   - Bugs corrigidos em 1 lugar
   - Mudanças aplicadas a todas plataformas
   - Código fácil de entender e modificar

---

## 📚 ARQUIVOS DE REFERÊNCIA

### Documentos de Análise:
- `mapa_parametrizado.md` - Análise inicial
- `mapa_parametrizado2.md` - Validação detalhada

### Arquivos Bem Parametrizados (USAR COMO REFERÊNCIA):
- `lib/apify.ts` - Exemplo de código 100% parametrizado
- `lib/xls.ts` - Exemplo de funções universais
- `app/api/download-video/route.ts` - Exemplo de endpoint multi-plataforma

### Arquivos com Duplicação (REFATORAR):
- `app/api/enrich-metadata/route.ts` + `app/api/insta_enrich-metadata/route.ts`
- `components/ChannelForm.tsx` + `components/insta_ChannelForm.tsx`
- `app/api/fetch-channel/route.ts` + `app/api/insta_fetch-channel/route.ts`
- `lib/normalize.ts` + `lib/insta_normalize.ts`
- `app/api/transcribe-videos/route.ts` + `app/api/insta_transcribe-videos/route.ts`

---

## 🚀 COMEÇAR AGORA

**Ordem de Execução:**
1. Fase 1: Enrich Metadata (2h) - MAIS FÁCIL
2. Fase 2: ChannelForm (2h) - FÁCIL
3. Fase 3: Normalização (3h) - MÉDIA
4. Fase 4: Fetch Channel (4h) - MAIS COMPLEXA
5. Fase 5: Helpers (2h) - FÁCIL

**Total:** ~13 horas de refatoração

**Lembre-se:** TESTAR APÓS CADA FASE. NÃO PROSSEGUIR SE ALGO QUEBRAR.

**Boa sorte! 🎯**
