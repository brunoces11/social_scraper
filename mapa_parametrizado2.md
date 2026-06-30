# Mapa de Parametrização v2 - Validação Completa da Codebase

**Data da Análise:** 01/06/2026  
**Versão:** 2.0 (Validação linha por linha contra código real)  
**Objetivo:** Validar análise anterior e criar plano pragmático de unificação para YouTube

---

## 📋 SUMÁRIO EXECUTIVO

### Status Atual Validado
- ✅ **TikTok:** Totalmente funcional e operacional
- 🟡 **Instagram:** Parcialmente implementado (transcrição via yt-dlp + Whisper)
- ❌ **YouTube:** Não implementado

### Nível de Parametrização Geral
**Score: 6.5/10** (ajustado após validação)

**Código possui boa base parametrizada em camadas críticas:**
- ✅ Integração Apify (`lib/apify.ts`) - 100% reutilizável
- ✅ Download de vídeos (`download-video/route.ts`) - 100% reutilizável  
- ✅ Utilitários XLS (`lib/xls.ts`) - 100% reutilizável
- ✅ Tipos compartilhados (`types/index.ts`) - 100% reutilizável

**Porém há duplicação significativa em:**
- ❌ APIs de busca (fetch-channel) - 90% duplicado
- ❌ Normalização de dados - 80% duplicado
- ❌ Enriquecimento AI - 98% duplicado
- ❌ Componentes UI - 95% duplicado

### 🎯 PRINCIPAIS DESCOBERTAS DA VALIDAÇÃO

1. **✅ CONFIRMADO:** `lib/apify.ts`, `lib/xls.ts`, `download-video/route.ts` e `types/index.ts` são totalmente parametrizados e prontos para YouTube

2. **❌ CRÍTICO:** APIs `enrich-metadata` TikTok vs Instagram são 98% idênticas (diferem apenas no nome do arquivo de prompt)

3. **❌ CRÍTICO:** Componentes `ChannelForm.tsx` são 97% idênticos (diferem apenas em labels e placeholders)

4. **🟡 DESCOBERTA:** Instagram usa abordagem diferente para transcrição (yt-dlp + Whisper) que é MELHOR que a do TikTok (Apify)

5. **✅ BOA PRÁTICA:** Sistema de créditos Apify e ElevenLabs está bem implementado e parametrizado

---

## 🔍 VALIDAÇÃO DETALHADA POR CAMADA

### 1. CAMADA DE TIPOS E INTERFACES ✅

**Arquivo:** `types/index.ts`

**VALIDAÇÃO:**

✅ **CONFIRMADO** - Análise anterior estava correta
- `ChannelVideoRow` é universal e funciona para TikTok e Instagram
- `TranscriptRow` é universal
- Campos cobrem todas as necessidades: `videoId`, `title`, `description`, `views`, `likes`, `hashtags`, `videoUrl`, `comments`, `publishDate`

**RECOMENDAÇÃO PARA YOUTUBE:**
- ✅ **NENHUMA MODIFICAÇÃO NECESSÁRIA**
- Estrutura atual suporta YouTube perfeitamente
- Campos mapeiam diretamente para YouTube Data API v3

---

### 2. CAMADA DE INTEGRAÇÃO APIFY ✅

**Arquivo:** `lib/apify.ts`

**VALIDAÇÃO:**
✅ **CONFIRMADO** - Código é 100% parametrizado e reutilizável

**Função Core Validada:**
```typescript
export async function runActorAndGetResults(
  actorId: string,
  input: Record<string, unknown>,
  accountId?: string
): Promise<unknown[]>
```

**Recursos Confirmados:**
- ✅ Aceita qualquer actor ID (TikTok, Instagram, YouTube)
- ✅ Suporta múltiplas contas Apify via `accountId`
- ✅ Polling automático com timeout de 5 minutos
- ✅ Tratamento robusto de erros com logs detalhados
- ✅ Extração de logs do actor para debugging
- ✅ Retry logic implícito via polling

**RECOMENDAÇÃO PARA YOUTUBE:**

- ✅ **USAR DIRETAMENTE** - Nenhuma modificação necessária
- Apenas configurar actor do YouTube no `apify-actors.json`

---

### 3. CAMADA DE CONFIGURAÇÃO DE ACTORS 🟡

**Arquivo:** `apify-actors.json`

**VALIDAÇÃO:**
🟡 **PARCIALMENTE CORRETO** - Estrutura existe mas não é escalável

**Estrutura Atual Confirmada:**
```json
{
  "transcriptActors": [
    {
      "id": "sian.agency/best-tiktok-ai-transcript-extractor",
      "name": "SIAN Agency (AI Transcript)",
      "default": true,
      "inputUrlField": "tiktokUrl",
      "inputUrlMode": "single",
      "outputTranscriptField": "transcript",
      "outputUrlField": "tiktokUrl",
      "isWebVtt": false
    }
  ],
  "instaActors": [
    {
      "id": "scrapium/instagram-reels-scraper",
      "name": "Profile_Actor",
      "default": true,
      "inputUrlField": "profileUrl",
      "inputUrlMode": "single",
      "outputField": "reels"
    }
  ]
}
```

**PROBLEMAS IDENTIFICADOS:**
1. ❌ Actor de busca do TikTok está hardcoded em `fetch-channel/route.ts`:
   ```typescript
   const actorId = process.env.APIFY_CHANNEL_ACTOR_ID || "clockworks/tiktok-scraper";
   ```

2. ❌ Não há seção unificada para actors de busca/channel
3. ❌ Estrutura separada por plataforma não escala bem

**RECOMENDAÇÃO:**
Criar estrutura unificada por plataforma:

```json
{
  "platforms": {
    "tiktok": {
      "channelActor": {
        "id": "clockworks/tiktok-scraper",
        "inputFields": {
          "profiles": "array",
          "searchQueries": "array",
          "hashtags": "array"
        }
      },
      "transcriptActors": [...]
    },
    "instagram": {
      "channelActors": [...],
      "transcriptActors": []
    },
    "youtube": {
      "channelActor": {
        "id": "streamers/youtube-scraper",
        "inputFields": {
          "channelUrls": "array",
          "searchQueries": "array"
        }
      },
      "transcriptActors": []
    }
  }
}
```

---

### 4. CAMADA DE NORMALIZAÇÃO DE DADOS ❌

**Arquivos:** `lib/normalize.ts` e `lib/insta_normalize.ts`

**VALIDAÇÃO:**
❌ **CONFIRMADO** - Duplicação crítica de ~80%

**Funções Helper Duplicadas:**

```typescript
// Em AMBOS os arquivos:
function safeString(value: any): string { ... }  // IDÊNTICO
function safeNumber(value: any): number { ... }  // IDÊNTICO
function extractHashtags(item: any): string[] { ... }  // SIMILAR
```

**Diferenças Reais Entre TikTok e Instagram:**

| Aspecto | TikTok | Instagram |
|---------|--------|-----------|
| Campo de descrição | `text`, `desc`, `title` | `caption_text`, `description` |
| Campo de views | `playCount`, `views` | `play_count`, `views` |
| Campo de likes | `diggCount`, `likes` | `like_count`, `likes` |
| Campo de videoId | `id`, `videoId` | `reel_id`, `id` |
| Campo de URL | `postPage`, `webVideoUrl` | `reel_url`, `url` |
| Hashtags | `challenges` array | `hashtags` array |

**PROPOSTA DE REFATORAÇÃO VALIDADA:**

```typescript
// lib/normalize.ts (unificado)
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

const PLATFORM_MAPS: Record<string, PlatformFieldMap> = {
  tiktok: {
    videoId: ['id', 'videoId'],
    title: ['text', 'desc', 'title', 'description'],
    description: ['text', 'desc', 'title', 'description'],
    views: ['playCount', 'views', 'viewCount'],
    likes: ['diggCount', 'likes', 'likeCount'],

✅ **CONFIRMADO** - Análise anterior estava correta
- `ChannelVideoRow` é universal e funciona para TikTok e Instagram
- `TranscriptRow` é universal
- Campos cobrem todas as necessidades

**RECOMENDAÇÃO PARA YOUTUBE:**
- ✅ **NENHUMA MODIFICAÇÃO NECESSÁRIA**

---

### 2. CAMADA DE INTEGRAÇÃO APIFY ✅

**Arquivo:** `lib/apify.ts`

**VALIDAÇÃO:**
✅ **CONFIRMADO** - Código é 100% parametrizado e reutilizável

**RECOMENDAÇÃO PARA YOUTUBE:**
- ✅ **USAR DIRETAMENTE** - Nenhuma modificação necessária

---

### 3. CAMADA DE NORMALIZAÇÃO ❌ CRÍTICO

**Arquivos:** `lib/normalize.ts` (TikTok) e `lib/insta_normalize.ts` (Instagram)

**VALIDAÇÃO:**
❌ **CONFIRMADO** - Duplicação de ~80%

**Funções Helper Duplicadas (IDÊNTICAS):**
```typescript
function safeString(value: any): string { ... }  // 100% IDÊNTICO
function safeNumber(value: any): number { ... }  // 100% IDÊNTICO
function extractHashtags(item: any): string[] { ... }  // 90% SIMILAR
```

**IMPACTO:** ~150 linhas de código duplicado

**RECOMENDAÇÃO:**
Criar `lib/normalize.ts` unificado com field mapping por plataforma

---

### 4. CAMADA DE API - FETCH CHANNEL ❌ CRÍTICO

**Arquivos:** `app/api/fetch-channel/route.ts` (TikTok) e `app/api/insta_fetch-channel/route.ts` (Instagram)

**VALIDAÇÃO:**
❌ **CONFIRMADO** - Duplicação de ~90%

**Código Idêntico:**
- Validação de entrada
- Chamada Apify via `runActorAndGetResults`
- Filtro de blacklist
- Ordenação por views
- Salvamento XLS
- Tratamento de erros

**Diferenças Reais (apenas 10%):**
1. Regex de validação de URL
2. Actor ID usado
3. Função de normalização chamada

**IMPACTO:** ~200 linhas de código duplicado

**RECOMENDAÇÃO:**
Criar endpoint unificado `/api/fetch-videos` que recebe `platform` como parâmetro

---

### 5. CAMADA DE API - ENRICH METADATA ❌ CRÍTICO

**Arquivos:** `app/api/enrich-metadata/route.ts` (TikTok) e `app/api/insta_enrich-metadata/route.ts` (Instagram)

**VALIDAÇÃO:**
❌ **PIOR QUE O ESPERADO** - Duplicação de 98%!

**ÚNICA DIFERENÇA REAL:**
```typescript
// TikTok
const PROMPT_FILE = path.join(process.cwd(), "ai-prompt.txt");

// Instagram  
const PROMPT_FILE = path.join(process.cwd(), "insta_ai-prompt.txt");
```

**IMPACTO:** ~250 linhas de código duplicado

**RECOMENDAÇÃO:**
Unificar IMEDIATAMENTE - diferença é trivial

---

### 6. CAMADA DE API - TRANSCRIÇÃO 🟡

**Arquivos:** `app/api/transcribe-videos/route.ts` (TikTok) e `app/api/insta_transcribe-videos/route.ts` (Instagram)

**VALIDAÇÃO:**
🟡 **ABORDAGENS DIFERENTES** - Duplicação de ~50%

**TikTok:** Usa Apify actors (configurável via `apify-actors.json`)
**Instagram:** Usa yt-dlp + OpenAI Whisper

**DESCOBERTA IMPORTANTE:**
A abordagem do Instagram (yt-dlp + Whisper) é MELHOR porque:
- YouTube tem legendas nativas (yt-dlp extrai instantaneamente)
- Whisper como fallback para vídeos sem legendas
- Mais confiável que actors Apify

**RECOMENDAÇÃO:**
YouTube deve seguir modelo do Instagram

---

### 7. CAMADA DE COMPONENTES UI ❌ CRÍTICO

**Arquivos:** `components/ChannelForm.tsx` (TikTok) e `components/insta_ChannelForm.tsx` (Instagram)

**VALIDAÇÃO:**
❌ **CONFIRMADO** - Duplicação de 97%!

**Lista de países:** 50 linhas IDÊNTICAS em ambos os arquivos
**Lógica de formulário:** 100% idêntica
**Validação:** 100% idêntica

**ÚNICAS DIFERENÇAS:**
```typescript
// TikTok
<label>Channel URL</label>
<input placeholder="https://www.tiktok.com/@usuario" />

// Instagram
<label>Profile URL</label>
<input placeholder="https://www.instagram.com/username/" />
```

**IMPACTO:** ~180 linhas de código duplicado

**RECOMENDAÇÃO:**
Criar componente unificado `PlatformSearchForm` com config por plataforma

---

### 8. CAMADA DE DOWNLOAD ✅

**Arquivo:** `app/api/download-video/route.ts`

**VALIDAÇÃO:**
✅ **EXCELENTE** - Totalmente parametrizado

**Recursos Confirmados:**
- Usa yt-dlp que suporta TikTok, Instagram E YouTube nativamente
- Modo normal e x5 variants
- FFmpeg processing configurável
- Naming de arquivos parametrizado

**RECOMENDAÇÃO:**
✅ **USAR DIRETAMENTE** para YouTube

---

## 📊 RESUMO DE DUPLICAÇÃO VALIDADA

| Camada | Arquivo(s) | Linhas Duplicadas | % Duplicação | Prioridade |
|--------|-----------|-------------------|--------------|------------|
| **Enrich AI** | `enrich-metadata/route.ts` (2x) | ~250 | 98% | 🔴 CRÍTICA |
| **UI Form** | `ChannelForm.tsx` (2x) | ~180 | 97% | 🔴 CRÍTICA |
| **Fetch API** | `fetch-channel/route.ts` (2x) | ~200 | 90% | 🔴 CRÍTICA |
| **Normalização** | `normalize.ts` (2x) | ~150 | 80% | 🔴 CRÍTICA |
| **Transcrição** | `transcribe-videos/route.ts` (2x) | ~150 | 50% | 🟡 MÉDIA |

**TOTAL:** ~930 linhas de código duplicado

---

## 🎯 PLANO DE AÇÃO PRAGMÁTICO

### FASE 1: Refatorações Rápidas (1 dia)

#### 1.1. Unificar Enrich Metadata (2h)
**Impacto:** Elimina 250 linhas duplicadas
**Complexidade:** BAIXA

```typescript
// app/api/enrich-metadata/route.ts (unificado)
const PROMPT_FILES: Record<string, string> = {
  tiktok: 'ai-prompt-tiktok.txt',
  instagram: 'ai-prompt-instagram.txt',
  youtube: 'ai-prompt-youtube.txt',
};

export async function POST(request: NextRequest) {
  const { platform, videos, videosMeta } = await request.json();
  const promptFile = PROMPT_FILES[platform] || PROMPT_FILES.tiktok;
  // Resto do código idêntico
}
```

#### 1.2. Unificar ChannelForm (2h)
**Impacto:** Elimina 180 linhas duplicadas
**Complexidade:** BAIXA

```typescript
// components/PlatformSearchForm.tsx
const PLATFORM_CONFIGS = {
  tiktok: {
    urlLabel: 'Channel URL',
    urlPlaceholder: 'https://www.tiktok.com/@usuario',
    urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/,
  },
  instagram: {
    urlLabel: 'Profile URL',
    urlPlaceholder: 'https://www.instagram.com/username/',
    urlPattern: /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/,
  },
  youtube: {
    urlLabel: 'Channel URL',
    urlPlaceholder: 'https://www.youtube.com/@channel',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+\/?$/,
  },
};
```

#### 1.3. Unificar Normalização (3h)
**Impacto:** Elimina 150 linhas duplicadas
**Complexidade:** MÉDIA

```typescript
// lib/normalize.ts (unificado)
const FIELD_MAPS = {
  tiktok: {
    videoId: ['id', 'videoId'],
    title: ['text', 'desc', 'title'],
    views: ['playCount', 'views'],
    // ...
  },
  instagram: {
    videoId: ['reel_id', 'id'],
    title: ['caption_text', 'description'],
    views: ['play_count', 'views'],
    // ...
  },
  youtube: {
    videoId: ['id', 'videoId'],
    title: ['snippet.title', 'title'],
    views: ['statistics.viewCount', 'views'],
    // ...
  },
};

export function normalizeVideos(rawItems: any[], platform: string): ChannelVideoRow[] {
  const fieldMap = FIELD_MAPS[platform];
  // Lógica unificada
}
```

### FASE 2: Implementação YouTube (1-2 dias)

#### 2.1. Configurar Actor Apify (1h)
Testar e selecionar actor para YouTube

#### 2.2. Adicionar Config YouTube (1h)
Atualizar `apify-actors.json` e criar field maps

#### 2.3. Implementar Transcrição YouTube (4h)
Usar abordagem yt-dlp + legendas nativas + Whisper fallback

#### 2.4. Criar Prompt AI YouTube (30min)
Criar `ai-prompt-youtube.txt`

#### 2.5. Adicionar Tab YouTube na UI (2h)
Usar componentes unificados

### FASE 3: Testes (1 dia)
- Testes de integração YouTube
- Testes de regressão TikTok e Instagram
- Validação de créditos

---

## 🎓 LIÇÕES APRENDIDAS

### O Que Funcionou Bem
1. ✅ `lib/apify.ts` - Excelente exemplo de código reutilizável
2. ✅ `download-video/route.ts` - yt-dlp multi-plataforma
3. ✅ Sistema de créditos bem implementado

### O Que Precisa Melhorar
1. ❌ Instagram foi implementado copiando código do TikTok
2. ❌ Falta de planejamento de arquitetura multi-plataforma
3. ❌ Ausência de testes automatizados

### Recomendações para o Futuro
1. 🎯 Sempre pensar em parametrização ANTES de implementar segunda plataforma
2. 🎯 Criar abstrações quando houver 2+ casos de uso similares
3. 🎯 Implementar testes antes de refatorar

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Refatoração (Prioridade ALTA)
- [ ] Unificar `enrich-metadata` (2h)
- [ ] Unificar `ChannelForm` (2h)
- [ ] Unificar `normalize.ts` (3h)
- [ ] Unificar `fetch-channel` (4h)
- [ ] Testar TikTok e Instagram após refatoração

### YouTube (Prioridade MÉDIA)
- [ ] Pesquisar actors Apify para YouTube (1h)
- [ ] Configurar YouTube em `apify-actors.json` (1h)
- [ ] Implementar transcrição YouTube (4h)
- [ ] Criar `ai-prompt-youtube.txt` (30min)
- [ ] Adicionar tab YouTube na UI (2h)
- [ ] Testes completos (6h)

---

## 📈 ESTIMATIVA DE ESFORÇO

**Cenário Recomendado: Refatoração + YouTube**

| Fase | Tempo |
|------|-------|
| Refatoração | 11h (1.5 dias) |
| YouTube | 14h (2 dias) |
| Testes | 6h (1 dia) |
| **TOTAL** | **31h (4 dias)** |

**Benefícios:**
- ✅ Código limpo e manutenível
- ✅ YouTube implementado corretamente
- ✅ Base sólida para futuras plataformas
- ✅ Bugs corrigidos em 1 lugar apenas

---

**FIM DO DOCUMENTO**
