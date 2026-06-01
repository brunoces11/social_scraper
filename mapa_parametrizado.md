# Mapa de Parametrização - Análise Completa da Codebase

**Data da Análise:** 01/06/2026  
**Objetivo:** Mapear código parametrizado e identificar gaps para implementação do scrape do YouTube

---

## 📋 SUMÁRIO EXECUTIVO

### Status Atual
- ✅ **TikTok:** Totalmente funcional e operacional
- 🟡 **Instagram:** Parcialmente implementado (transcrição via Whisper + yt-dlp)
- ❌ **YouTube:** Não implementado

### Nível de Parametrização Geral
**Score: 6/10** - Código possui boa base parametrizada, mas ainda há duplicação significativa e falta de abstração em camadas críticas.

---

## 🎯 ANÁLISE POR CAMADA

### 1. CAMADA DE TIPOS E INTERFACES

#### ✅ **PARAMETRIZADO** - `types/index.ts`

**Estruturas Compartilhadas:**
```typescript
- ChannelVideoRow: Interface universal para vídeos (TikTok + Instagram)
- TranscriptRow: Interface universal para transcrições
```

**Análise:**
- ✅ Tipos são agnósticos de plataforma
- ✅ Campos cobrem necessidades de TikTok e Instagram
- ✅ Estrutura suporta YouTube sem modificações

**Recomendação para YouTube:**
- ✅ **NENHUMA MODIFICAÇÃO NECESSÁRIA** - Os tipos atuais são suficientes
- Campos como `videoId`, `title`, `views`, `likes`, `hashtags` mapeiam perfeitamente para YouTube

---

### 2. CAMADA DE INTEGRAÇÃO APIFY

#### ✅ **TOTALMENTE PARAMETRIZADO** - `lib/apify.ts`

**Função Core:**
```typescript
runActorAndGetResults(actorId: string, input: Record<string, unknown>, accountId?: string)
```

**Análise:**
- ✅ **100% reutilizável** - Aceita qualquer actor ID
- ✅ Suporta múltiplas contas Apify
- ✅ Polling automático com timeout
- ✅ Tratamento de erros robusto
- ✅ Extração de logs para debugging

**Recomendação para YouTube:**
- ✅ **USAR DIRETAMENTE** - Nenhuma modificação necessária
- Apenas configurar actor do YouTube no `apify-actors.json`

---

### 3. CAMADA DE CONFIGURAÇÃO DE ACTORS

#### 🟡 **PARCIALMENTE PARAMETRIZADO** - `apify-actors.json`

**Estrutura Atual:**
```json
{
  "transcriptActors": [...],  // TikTok only
  "instaActors": [...]        // Instagram only
}
```

**Análise:**
- ⚠️ Estrutura separada por plataforma (não escalável)
- ✅ Configuração centralizada
- ⚠️ Falta padrão unificado para actors de busca/channel

**Gaps Identificados:**
1. ❌ Não há seção para actors de busca de canal (TikTok usa hardcoded)
2. ❌ Não há seção para YouTube
3. ❌ Estrutura não suporta múltiplos actors por função


**Proposta de Refatoração:**
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
      "transcriptActors": [...]
    },
    "youtube": {
      "channelActor": {
        "id": "streamers/youtube-scraper",
        "inputFields": {
          "channelUrls": "array",
          "searchQueries": "array"
        }
      },
      "transcriptActors": [...]
    }
  }
}
```

---

### 4. CAMADA DE NORMALIZAÇÃO DE DADOS

#### 🔴 **NÃO PARAMETRIZADO** - `lib/normalize.ts` e `lib/insta_normalize.ts`

**Arquivos Atuais:**
- `normalize.ts` - Específico para TikTok
- `insta_normalize.ts` - Específico para Instagram (2 funções separadas)

**Análise:**
- ❌ **DUPLICAÇÃO CRÍTICA** - Lógica similar em arquivos separados
- ❌ Funções helper duplicadas: `safeString()`, `safeNumber()`, `extractHashtags()`
- ❌ Não há abstração para diferentes formatos de API


**Gaps Identificados:**
1. ❌ Helpers duplicados em múltiplos arquivos
2. ❌ Lógica de mapeamento de campos hardcoded
3. ❌ Não há sistema de "field mapping" configurável

**Proposta de Refatoração:**
```typescript
// lib/normalize.ts (refatorado)
interface PlatformFieldMap {
  videoId: string[];
  title: string[];
  description: string[];
  views: string[];
  likes: string[];
  // ...
}

const PLATFORM_MAPS: Record<string, PlatformFieldMap> = {
  tiktok: {
    videoId: ['id', 'videoId'],
    title: ['text', 'desc', 'title'],
    views: ['playCount', 'views', 'viewCount'],
    // ...
  },
  instagram: {
    videoId: ['reel_id', 'id'],
    title: ['caption_text', 'description'],
    // ...
  },
  youtube: {
    videoId: ['id', 'videoId'],
    title: ['title', 'snippet.title'],
    views: ['statistics.viewCount', 'views'],
    // ...
  }
};

function normalizeVideos(rawItems: any[], platform: string): ChannelVideoRow[] {
  const fieldMap = PLATFORM_MAPS[platform];
  return rawItems.map(item => ({
    videoId: getFieldValue(item, fieldMap.videoId),
    title: getFieldValue(item, fieldMap.title),
    // ...
  }));
}
```


---

### 5. CAMADA DE API ROUTES - FETCH CHANNEL

#### 🔴 **NÃO PARAMETRIZADO** - APIs Duplicadas

**Arquivos:**
- `app/api/fetch-channel/route.ts` (TikTok)
- `app/api/insta_fetch-channel/route.ts` (Instagram)

**Análise de Duplicação:**

| Funcionalidade | TikTok | Instagram | Duplicado? |
|----------------|--------|-----------|------------|
| Validação de entrada | ✅ | ✅ | ❌ SIM |
| Validação de URL | ✅ | ✅ | ❌ SIM |
| Chamada Apify | ✅ | ✅ | ❌ SIM |
| Normalização | ✅ | ✅ | ❌ SIM |
| Filtro blacklist | ✅ | ✅ | ❌ SIM |
| Ordenação por views | ✅ | ✅ | ❌ SIM |
| Salvamento XLS | ✅ | ✅ | ❌ SIM |
| Tratamento de erros | ✅ | ✅ | ❌ SIM |

**Código Duplicado:** ~90% de similaridade

**Diferenças Reais:**
1. Padrão de validação de URL (regex diferente)
2. Actor ID usado
3. Campos de input do actor
4. Função de normalização chamada


**Proposta de Refatoração:**
```typescript
// app/api/fetch-videos/route.ts (unificado)
export async function POST(request: NextRequest) {
  const { platform, channelUrl, keyword, hashtag, maxVideos, countryCode, accountId } = await request.json();
  
  const config = PLATFORM_CONFIGS[platform];
  
  // Validação usando config
  if (channelUrl && !config.urlPattern.test(channelUrl)) {
    return NextResponse.json({ error: config.urlErrorMessage }, { status: 400 });
  }
  
  // Build input usando config
  const input = config.buildInput({ channelUrl, keyword, hashtag, maxVideos, countryCode });
  
  // Chamada Apify (já parametrizada)
  const rawItems = await runActorAndGetResults(config.actorId, input, accountId);
  
  // Normalização usando config
  const allRows = normalizeVideos(rawItems, platform);
  
  // Resto do código é idêntico...
}
```

**Benefícios:**
- ✅ Elimina 90% da duplicação
- ✅ YouTube requer apenas adicionar config
- ✅ Manutenção centralizada

---

### 6. CAMADA DE API ROUTES - TRANSCRIÇÃO

#### 🟡 **PARCIALMENTE PARAMETRIZADO** - `app/api/transcribe-videos/route.ts`

**Análise:**
- ✅ Suporta múltiplos actors via config (`apify-actors.json`)
- ✅ Lógica de fallback para erros
- ✅ Geração de arquivos .txt com metadata
- ⚠️ Lógica de naming de arquivos duplicada
- ⚠️ Funções helper duplicadas

**Instagram:** `app/api/insta_transcribe-videos/route.ts`
- ❌ **ABORDAGEM COMPLETAMENTE DIFERENTE**
- Usa yt-dlp + OpenAI Whisper (não usa Apify)
- Código 100% separado

**Análise Crítica:**
- Instagram não usa Apify porque não há actor de transcrição confiável
- Abordagem yt-dlp + Whisper é mais robusta
- **RECOMENDAÇÃO:** YouTube deve seguir modelo do Instagram (yt-dlp + Whisper)

**Justificativa:**
1. YouTube tem legendas nativas (mais fácil que TikTok)
2. yt-dlp suporta YouTube nativamente
3. Whisper funciona bem para vídeos sem legenda
4. Evita dependência de actors Apify instáveis


**Proposta de Refatoração:**
```typescript
// lib/transcription.ts (novo arquivo unificado)
interface TranscriptionStrategy {
  name: string;
  transcribe: (videoUrl: string, meta: VideoMeta) => Promise<string>;
}

class ApifyTranscriptionStrategy implements TranscriptionStrategy {
  // Lógica atual do TikTok
}

class YtDlpWhisperStrategy implements TranscriptionStrategy {
  // Lógica atual do Instagram
  // Reutilizável para YouTube
}

const PLATFORM_STRATEGIES: Record<string, TranscriptionStrategy> = {
  tiktok: new ApifyTranscriptionStrategy(),
  instagram: new YtDlpWhisperStrategy(),
  youtube: new YtDlpWhisperStrategy(), // Mesma estratégia do Instagram
};
```

---

### 7. CAMADA DE API ROUTES - ENRIQUECIMENTO AI

#### ✅ **ALTAMENTE PARAMETRIZADO** - `app/api/enrich-metadata/route.ts`

**Análise:**
- ✅ Lógica 95% idêntica entre TikTok e Instagram
- ✅ Usa prompt customizável via arquivo
- ✅ Batch processing
- ✅ Retry logic
- ⚠️ Arquivos separados desnecessariamente

**Diferenças:**
- Arquivo de prompt: `ai-prompt.txt` vs `insta_ai-prompt.txt`
- Texto do prompt (menção a "TikTok" vs "Instagram Reels")


**Proposta de Refatoração:**
```typescript
// app/api/enrich-metadata/route.ts (unificado)
const PROMPT_FILES: Record<string, string> = {
  tiktok: 'ai-prompt-tiktok.txt',
  instagram: 'ai-prompt-instagram.txt',
  youtube: 'ai-prompt-youtube.txt',
};

export async function POST(request: NextRequest) {
  const { platform, videos, videosMeta } = await request.json();
  const promptFile = PROMPT_FILES[platform];
  // Resto do código idêntico
}
```

**Benefício:** Elimina duplicação de 200+ linhas

---

### 8. CAMADA DE API ROUTES - DOWNLOAD DE VÍDEOS

#### ✅ **TOTALMENTE PARAMETRIZADO** - `app/api/download-video/route.ts`

**Análise:**
- ✅ **EXCELENTE** - Usa yt-dlp que suporta TikTok, Instagram E YouTube
- ✅ Lógica de naming parametrizada
- ✅ Suporta modo normal e x5 variants
- ✅ FFmpeg processing configurável

**Recomendação para YouTube:**
- ✅ **USAR DIRETAMENTE** - Nenhuma modificação necessária
- yt-dlp já suporta YouTube nativamente
- Apenas testar se naming de arquivos funciona corretamente

---

### 9. CAMADA DE UTILITÁRIOS - XLS

#### ✅ **TOTALMENTE PARAMETRIZADO** - `lib/xls.ts`

**Análise:**
- ✅ Funções agnósticas de plataforma
- ✅ Interface `SearchRow` universal
- ✅ Blacklist compartilhada
- ✅ Salvamento/carregamento genérico

**Recomendação para YouTube:**
- ✅ **USAR DIRETAMENTE** - Nenhuma modificação necessária

---

### 10. CAMADA DE COMPONENTES UI

#### 🔴 **NÃO PARAMETRIZADO** - Componentes Duplicados

**Arquivos:**
- `components/ChannelForm.tsx` (TikTok)
- `components/insta_ChannelForm.tsx` (Instagram)

**Análise de Duplicação:**
- ❌ **95% de código idêntico**
- ❌ Lista de países duplicada (50 linhas)
- ❌ Lógica de validação duplicada
- ❌ Estrutura de formulário duplicada

**Diferenças Reais:**
1. Label: "Channel URL" vs "Profile URL"
2. Placeholder: "tiktok.com/@usuario" vs "instagram.com/username"
3. Regex de validação


**Proposta de Refatoração:**
```typescript
// components/PlatformSearchForm.tsx (unificado)
interface PlatformConfig {
  urlLabel: string;
  urlPlaceholder: string;
  urlPattern: RegExp;
  urlErrorMessage: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  tiktok: {
    urlLabel: 'Channel URL',
    urlPlaceholder: 'https://www.tiktok.com/@usuario',
    urlPattern: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/,
    urlErrorMessage: 'Invalid TikTok URL',
  },
  youtube: {
    urlLabel: 'Channel URL',
    urlPlaceholder: 'https://www.youtube.com/@channel',
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+\/?$/,
    urlErrorMessage: 'Invalid YouTube URL',
  },
  // ...
};

export default function PlatformSearchForm({ platform, onSubmit, isLoading }) {
  const config = PLATFORM_CONFIGS[platform];
  // Resto do código usa config
}
```

---

### 11. CAMADA DE COMPONENTES UI - PAINEL PRINCIPAL

#### 🔴 **NÃO PARAMETRIZADO** - `app/page.tsx` e `components/insta_Panel.tsx`

**Análise:**
- ❌ **DUPLICAÇÃO MASSIVA** - 800+ linhas duplicadas
- ❌ Lógica de estado duplicada
- ❌ Handlers de eventos duplicados
- ❌ Fluxo "Download All" duplicado

**Diferenças Reais:**
- Endpoints de API chamados
- Algumas mensagens de status

**Impacto:**
- Manutenção duplicada
- Bugs precisam ser corrigidos em 2 lugares
- Adicionar YouTube = duplicar mais 800 linhas

**Proposta de Refatoração:**
```typescript
// components/PlatformPanel.tsx (unificado)
export default function PlatformPanel({ platform }: { platform: 'tiktok' | 'instagram' | 'youtube' }) {
  const config = PLATFORM_CONFIGS[platform];
  
  const handleFetchChannel = async (params) => {
    const res = await fetch(config.endpoints.fetchChannel, {
      method: 'POST',
      body: JSON.stringify({ platform, ...params }),
    });
    // ...
  };
  
  // Resto da lógica idêntica
}
```

---

## 📊 RESUMO DE GAPS E PRIORIDADES

### 🔴 CRÍTICO - Refatoração Obrigatória

| Item | Arquivo(s) | Duplicação | Impacto YouTube |
|------|-----------|------------|-----------------|
| **1. API Routes - Fetch** | `fetch-channel/route.ts` (2x) | 90% | Bloqueante |
| **2. Normalização** | `normalize.ts` (2x) | 80% | Bloqueante |
| **3. UI - Painel** | `page.tsx`, `insta_Panel.tsx` | 95% | Bloqueante |
| **4. UI - Form** | `ChannelForm.tsx` (2x) | 95% | Bloqueante |

### 🟡 IMPORTANTE - Refatoração Recomendada

| Item | Arquivo(s) | Duplicação | Impacto YouTube |
|------|-----------|------------|-----------------|
| **5. Enrich Metadata** | `enrich-metadata/route.ts` (2x) | 95% | Médio |
| **6. Config Actors** | `apify-actors.json` | N/A | Médio |
| **7. Transcrição** | `transcribe-videos/route.ts` (2x) | 50% | Baixo |

### ✅ OK - Usar Diretamente

| Item | Arquivo(s) | Status | Ação YouTube |
|------|-----------|--------|--------------|
| **8. Tipos** | `types/index.ts` | ✅ Parametrizado | Nenhuma |
| **9. Apify Core** | `lib/apify.ts` | ✅ Parametrizado | Nenhuma |
| **10. Download** | `download-video/route.ts` | ✅ Parametrizado | Nenhuma |
| **11. XLS Utils** | `lib/xls.ts` | ✅ Parametrizado | Nenhuma |

---

## 🎯 ESTRATÉGIA DE IMPLEMENTAÇÃO YOUTUBE

### Abordagem Recomendada: **REFATORAR PRIMEIRO, DEPOIS ADICIONAR**

**Justificativa:**
1. Adicionar YouTube sem refatorar = triplicar código duplicado
2. Bugs futuros precisarão ser corrigidos em 3 lugares
3. Manutenção se tornará insustentável
4. Refatoração agora economiza 70% do tempo de implementação

---

### FASE 1: Refatoração da Base (Estimativa: 2-3 dias)

#### 1.1. Criar Sistema de Configuração de Plataformas
**Arquivo:** `lib/platform-config.ts` (novo)

```typescript
interface PlatformConfig {
  name: string;
  displayName: string;
  icon: string;
  
  // URL validation
  urlPattern: RegExp;
  urlLabel: string;
  urlPlaceholder: string;
  urlErrorMessage: string;
  
  // Apify actors
  channelActorId: string;
  channelActorInputBuilder: (params: SearchParams) => Record<string, unknown>;
  
  // Normalization
  fieldMap: FieldMap;
  
  // Transcription strategy
  transcriptionStrategy: 'apify' | 'ytdlp-whisper';
  transcriptionActorId?: string;
  
  // API endpoints
  endpoints: {
    fetchChannel: string;
    transcribe: string;
    enrich: string;
  };
}
```


#### 1.2. Unificar Normalização
**Arquivo:** `lib/normalize.ts` (refatorar)

**Ações:**
1. Criar `PLATFORM_FIELD_MAPS` com mapeamentos para TikTok, Instagram, YouTube
2. Implementar `normalizeVideos(rawItems, platform)` genérico
3. Remover `insta_normalize.ts`
4. Mover helpers para funções compartilhadas

**Tempo:** 4-6 horas

---

#### 1.3. Unificar API Routes - Fetch Channel
**Arquivo:** `app/api/fetch-videos/route.ts` (novo, unificado)

**Ações:**
1. Criar endpoint único que recebe `platform` como parâmetro
2. Usar `PlatformConfig` para validação e input building
3. Remover `fetch-channel/route.ts` e `insta_fetch-channel/route.ts`
4. Atualizar chamadas no frontend

**Tempo:** 6-8 horas

---

#### 1.4. Unificar Componentes UI
**Arquivos:**
- `components/PlatformSearchForm.tsx` (novo)
- `components/PlatformPanel.tsx` (novo)

**Ações:**
1. Criar formulário genérico que usa `PlatformConfig`
2. Criar painel genérico com lógica compartilhada
3. Remover componentes duplicados
4. Atualizar `app/page.tsx` para usar componentes unificados

**Tempo:** 8-10 horas

---

### FASE 2: Implementação YouTube (Estimativa: 1-2 dias)

#### 2.1. Pesquisa e Seleção de Actor Apify
**Opções Identificadas:**
1. `streamers/youtube-scraper` - Popular, bem mantido
2. `cryptosignals/youtube-scraper` - Atualizado 2026
3. `scraper-engine/youtube-search-scraper` - Focado em busca

**Ação:** Testar actors e selecionar o mais adequado

**Tempo:** 2-3 horas

---

#### 2.2. Configurar YouTube no Sistema
**Arquivo:** `lib/platform-config.ts`

```typescript
export const PLATFORMS: Record<string, PlatformConfig> = {
  // ... tiktok, instagram
  
  youtube: {
    name: 'youtube',
    displayName: 'YouTube',
    icon: '📺',
    
    urlPattern: /^https?:\/\/(www\.)?youtube\.com\/(c\/|@)?[\w-]+\/?$/,
    urlLabel: 'Channel URL',
    urlPlaceholder: 'https://www.youtube.com/@channel',
    urlErrorMessage: 'Invalid YouTube URL. Use format: https://www.youtube.com/@channel',
    
    channelActorId: 'streamers/youtube-scraper', // ou outro selecionado
    channelActorInputBuilder: (params) => ({
      channelUrls: params.channelUrl ? [params.channelUrl] : undefined,
      searchQueries: params.keyword ? [params.keyword] : undefined,
      maxResults: params.maxVideos || 50,
    }),
    
    fieldMap: {
      videoId: ['id', 'videoId', 'snippet.resourceId.videoId'],
      title: ['title', 'snippet.title'],
      description: ['description', 'snippet.description'],
      views: ['statistics.viewCount', 'viewCount', 'views'],
      likes: ['statistics.likeCount', 'likeCount', 'likes'],
      comments: ['statistics.commentCount', 'commentCount'],
      publishDate: ['publishedAt', 'snippet.publishedAt'],
      videoUrl: ['url', 'videoUrl'],
    },
    
    transcriptionStrategy: 'ytdlp-whisper',
    
    endpoints: {
      fetchChannel: '/api/fetch-videos',
      transcribe: '/api/transcribe-videos',
      enrich: '/api/enrich-metadata',
    },
  },
};
```

**Tempo:** 1-2 horas


---

#### 2.3. Implementar Transcrição YouTube
**Estratégia:** Reutilizar lógica do Instagram (yt-dlp + Whisper)

**Ações:**
1. Refatorar `insta_transcribe-videos/route.ts` para ser genérico
2. Adicionar suporte para legendas nativas do YouTube (via yt-dlp)
3. Fallback para Whisper se não houver legendas

**Código Proposto:**
```typescript
// lib/transcription-strategies.ts (novo)
export async function transcribeWithYtDlp(videoUrl: string, platform: string): Promise<string> {
  // 1. Tentar baixar legendas nativas primeiro
  try {
    const subtitlesCmd = `yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format srt -o "temp.%(ext)s" "${videoUrl}"`;
    execSync(subtitlesCmd);
    const srtContent = fs.readFileSync('temp.en.srt', 'utf-8');
    return cleanSrtContent(srtContent);
  } catch {
    // 2. Fallback: baixar áudio + Whisper
    const audioPath = await downloadAudioWithYtDlp(videoUrl);
    return await transcribeWithWhisper(audioPath);
  }
}
```

**Tempo:** 4-6 horas

---

#### 2.4. Criar Prompt AI para YouTube
**Arquivo:** `ai-prompt-youtube.txt` (novo)

**Conteúdo:**
```
You are a YouTube content specialist. You receive video metadata (title, description, tags, transcription) and must return enriched versions optimized for YouTube SEO and engagement.

Rules:
- Rewrite the title to be SEO-friendly and click-worthy (max 60 chars)
- Enhance description with timestamps, links, and relevant keywords
- Add 5-10 relevant tags for better discoverability
- Optimize transcription for YouTube's search algorithm
- If transcription starts with "ERRO:", return it unchanged
- Return ONLY valid JSON in the exact format specified
```

**Tempo:** 30 minutos


---

#### 2.5. Adicionar Tab YouTube na UI
**Arquivo:** `app/page.tsx`

**Ações:**
1. Adicionar botão/tab "YouTube" ao lado de TikTok e Instagram
2. Usar componente `PlatformPanel` unificado com `platform="youtube"`
3. Testar fluxo completo

**Tempo:** 2-3 horas

---

### FASE 3: Testes e Ajustes (Estimativa: 1 dia)

#### 3.1. Testes de Integração
- [ ] Busca por canal do YouTube
- [ ] Busca por palavra-chave
- [ ] Transcrição de vídeos (com e sem legendas)
- [ ] Enriquecimento AI
- [ ] Download de vídeos
- [ ] Fluxo "Download All"
- [ ] Salvamento XLS
- [ ] Blacklist

#### 3.2. Testes de Regressão
- [ ] TikTok continua funcionando
- [ ] Instagram continua funcionando
- [ ] Créditos Apify sendo contabilizados
- [ ] Créditos ElevenLabs sendo contabilizados

#### 3.3. Ajustes Finos
- Mensagens de erro específicas do YouTube
- Validação de URLs do YouTube (suportar formatos: /c/, /@, /channel/)
- Tratamento de vídeos privados/removidos
- Otimização de performance

**Tempo:** 6-8 horas

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### ✅ Pré-Requisitos
- [ ] Backup completo do código atual
- [ ] Criar branch `feature/youtube-integration`
- [ ] Documentar funcionalidades atuais do TikTok e Instagram
- [ ] Configurar ambiente de testes

### 🔧 Fase 1: Refatoração (Prioridade ALTA)
- [ ] **1.1** Criar `lib/platform-config.ts` com configs de TikTok e Instagram
- [ ] **1.2** Refatorar `lib/normalize.ts` para ser genérico
- [ ] **1.3** Criar `app/api/fetch-videos/route.ts` unificado
- [ ] **1.4** Criar `components/PlatformSearchForm.tsx` unificado
- [ ] **1.5** Criar `components/PlatformPanel.tsx` unificado
- [ ] **1.6** Atualizar `app/page.tsx` para usar componentes unificados
- [ ] **1.7** Remover arquivos duplicados antigos
- [ ] **1.8** Testar TikTok e Instagram após refatoração

### 🎬 Fase 2: YouTube (Prioridade MÉDIA)
- [ ] **2.1** Pesquisar e testar actors Apify para YouTube
- [ ] **2.2** Adicionar config do YouTube em `platform-config.ts`
- [ ] **2.3** Implementar transcrição YouTube (yt-dlp + legendas nativas)
- [ ] **2.4** Criar `ai-prompt-youtube.txt`
- [ ] **2.5** Adicionar tab YouTube na UI
- [ ] **2.6** Testar fluxo completo do YouTube

### 🧪 Fase 3: Testes (Prioridade ALTA)
- [ ] **3.1** Testes de integração YouTube
- [ ] **3.2** Testes de regressão TikTok e Instagram
- [ ] **3.3** Testes de edge cases (vídeos privados, URLs inválidas, etc.)
- [ ] **3.4** Testes de performance (múltiplos vídeos)
- [ ] **3.5** Validação de créditos Apify e OpenAI

### 📚 Fase 4: Documentação (Prioridade BAIXA)
- [ ] **4.1** Atualizar README com suporte ao YouTube
- [ ] **4.2** Documentar estrutura de configuração de plataformas
- [ ] **4.3** Criar guia de adição de novas plataformas
- [ ] **4.4** Documentar actors Apify recomendados

---

## 🎯 DECISÕES TÉCNICAS CRÍTICAS

### 1. Estratégia de Transcrição YouTube

**Opções Avaliadas:**

| Opção | Prós | Contras | Recomendação |
|-------|------|---------|--------------|
| **A) Apify Actor** | Integração consistente | Custo, confiabilidade variável | ❌ Não recomendado |
| **B) YouTube Data API v3** | Oficial, legendas nativas | Quota limits (10k/dia) | 🟡 Backup |
| **C) yt-dlp + Legendas Nativas** | Grátis, rápido, confiável | Requer yt-dlp instalado | ✅ **RECOMENDADO** |
| **D) yt-dlp + Whisper** | Funciona sem legendas | Custo OpenAI, mais lento | 🟡 Fallback |

**Decisão Final:** Usar **C como primário** e **D como fallback**

**Justificativa:**
1. YouTube tem legendas automáticas em 99% dos vídeos
2. yt-dlp extrai legendas instantaneamente (sem custo)
3. Whisper só é necessário para vídeos sem legendas
4. Mesma stack do Instagram (código reutilizável)

---

### 2. Seleção de Actor Apify para YouTube

**Critérios de Avaliação:**
- ✅ Atualizado recentemente (2025-2026)
- ✅ Suporte a busca por canal E palavra-chave
- ✅ Retorna metadata completa (views, likes, data)
- ✅ Boa documentação
- ✅ Preço razoável

**Candidatos:**

| Actor | Última Atualização | Recursos | Custo Estimado | Score |
|-------|-------------------|----------|----------------|-------|
| `streamers/youtube-scraper` | 2024 | ✅ Canal, busca, metadata | Médio | 8/10 |
| `cryptosignals/youtube-scraper` | 2026 | ✅ Canal, trending, comments | Médio | 9/10 |
| `scraper-engine/youtube-search-scraper` | 2025 | ✅ Busca focada | Baixo | 7/10 |

**Decisão Final:** Testar `cryptosignals/youtube-scraper` primeiro (mais recente)


---

### 3. Estrutura de URLs do YouTube

**Formatos Suportados:**
```
https://www.youtube.com/@username
https://www.youtube.com/c/channelname
https://www.youtube.com/channel/UC...
https://youtube.com/@username (sem www)
```

**Regex Proposto:**
```typescript
/^https?:\/\/(www\.)?youtube\.com\/(c\/|@|channel\/)?[\w-]+\/?$/
```

**Normalização:**
- Converter todos para formato `@username` quando possível
- Manter `channel/UC...` para canais sem @

---

### 4. Mapeamento de Campos YouTube → ChannelVideoRow

**YouTube Data API v3 Response:**
```json
{
  "id": "dQw4w9WgXcQ",
  "snippet": {
    "title": "Video Title",
    "description": "Description...",
    "publishedAt": "2024-01-01T00:00:00Z",
    "channelTitle": "Channel Name",
    "tags": ["tag1", "tag2"]
  },
  "statistics": {
    "viewCount": "1000000",
    "likeCount": "50000",
    "commentCount": "1000"
  }
}
```

**Mapeamento:**
```typescript
{
  videoId: item.id || item.snippet?.resourceId?.videoId,
  title: item.snippet?.title || '',
  description: item.snippet?.description || '',
  views: parseInt(item.statistics?.viewCount || '0'),
  likes: parseInt(item.statistics?.likeCount || '0'),
  comments: parseInt(item.statistics?.commentCount || '0'),
  hashtags: item.snippet?.tags || [],
  videoUrl: `https://www.youtube.com/watch?v=${item.id}`,
  publishDate: item.snippet?.publishedAt || '',
}
```


---

## ⚠️ RISCOS E MITIGAÇÕES

### Risco 1: Refatoração Quebrar Funcionalidades Existentes
**Probabilidade:** Média  
**Impacto:** Alto  
**Mitigação:**
- Criar suite de testes antes da refatoração
- Refatorar incrementalmente (uma camada por vez)
- Manter código antigo até validação completa
- Usar feature flags para rollback rápido

### Risco 2: Actor Apify do YouTube Não Funcionar Como Esperado
**Probabilidade:** Média  
**Impacto:** Alto  
**Mitigação:**
- Testar 2-3 actors diferentes antes de decidir
- Ter fallback para YouTube Data API v3
- Documentar limitações conhecidas
- Implementar retry logic robusto

### Risco 3: Legendas do YouTube Não Disponíveis
**Probabilidade:** Baixa (5% dos vídeos)  
**Impacto:** Médio  
**Mitigação:**
- Implementar fallback para Whisper
- Detectar idioma das legendas automaticamente
- Salvar arquivo mesmo sem transcrição (com flag de erro)

### Risco 4: Custo de Transcrição Explodir
**Probabilidade:** Baixa  
**Impacação:** Alto  
**Mitigação:**
- Priorizar legendas nativas (grátis)
- Implementar cache de transcrições
- Adicionar limite de caracteres Whisper por dia
- Alertas de uso de créditos

### Risco 5: Performance com Múltiplos Vídeos
**Probabilidade:** Média  
**Impacto:** Médio  
**Mitigação:**
- Implementar processamento em batch
- Adicionar progress indicators
- Timeout configurável
- Queue system para jobs grandes

---

## 📈 ESTIMATIVA DE ESFORÇO

### Cenário A: Implementação Direta (SEM Refatoração)
**Tempo Total:** 3-4 dias  
**Débito Técnico:** ALTO  
**Manutenibilidade:** BAIXA  

| Tarefa | Tempo |
|--------|-------|
| Criar `youtube_fetch-channel/route.ts` | 4h |
| Criar `youtube_normalize.ts` | 3h |
| Criar `youtube_transcribe-videos/route.ts` | 6h |
| Criar `youtube_enrich-metadata/route.ts` | 2h |
| Criar `youtube_ChannelForm.tsx` | 2h |
| Criar `youtube_Panel.tsx` | 8h |
| Testes | 6h |
| **TOTAL** | **31h** |

**Problemas:**
- ❌ Código triplicado
- ❌ Bugs precisam ser corrigidos em 3 lugares
- ❌ Adicionar nova plataforma = repetir tudo
- ❌ Manutenção insustentável

---

### Cenário B: Refatoração + Implementação (RECOMENDADO)
**Tempo Total:** 4-5 dias  
**Débito Técnico:** BAIXO  
**Manutenibilidade:** ALTA  

| Tarefa | Tempo |
|--------|-------|
| **FASE 1: Refatoração** | |
| Criar `platform-config.ts` | 4h |
| Refatorar `normalize.ts` | 6h |
| Unificar `fetch-videos/route.ts` | 8h |
| Unificar componentes UI | 10h |
| Testes de regressão | 4h |
| **FASE 2: YouTube** | |
| Pesquisar actors | 3h |
| Configurar YouTube | 2h |
| Implementar transcrição | 6h |
| Criar prompt AI | 1h |
| Adicionar tab UI | 3h |
| Testes YouTube | 6h |
| **TOTAL** | **53h** |

**Benefícios:**
- ✅ Código limpo e manutenível
- ✅ Bugs corrigidos em 1 lugar
- ✅ Adicionar nova plataforma = 4-6h
- ✅ Base sólida para crescimento


---

## 🎓 LIÇÕES APRENDIDAS E BOAS PRÁTICAS

### O Que Está Funcionando Bem

1. **✅ Integração Apify Centralizada**
   - `lib/apify.ts` é um excelente exemplo de código reutilizável
   - Suporta qualquer actor sem modificação
   - Lição: Abstrair integrações de terceiros desde o início

2. **✅ Tipos Compartilhados**
   - `ChannelVideoRow` e `TranscriptRow` funcionam para todas as plataformas
   - Lição: Pensar em abstrações universais antes de implementar

3. **✅ Download com yt-dlp**
   - Suporta múltiplas plataformas nativamente
   - Lição: Escolher ferramentas multi-plataforma quando possível

4. **✅ Sistema de Créditos**
   - Tracking de Apify e ElevenLabs funciona bem
   - Lição: Monitoramento de custos desde o início

### O Que Precisa Melhorar

1. **❌ Duplicação de Código**
   - Problema: Código copiado entre TikTok e Instagram
   - Causa: Falta de planejamento de arquitetura multi-plataforma
   - Solução: Refatorar para sistema de configuração

2. **❌ Falta de Testes Automatizados**
   - Problema: Mudanças podem quebrar funcionalidades
   - Causa: Foco em features, não em qualidade
   - Solução: Implementar testes unitários e de integração

3. **❌ Configuração Hardcoded**
   - Problema: Actor IDs e configs espalhados no código
   - Causa: Implementação rápida sem pensar em escalabilidade
   - Solução: Centralizar em arquivos de configuração

4. **❌ Tratamento de Erros Inconsistente**
   - Problema: Alguns endpoints retornam erros diferentes
   - Causa: Implementação incremental sem padrão
   - Solução: Criar middleware de erro padronizado


---

## 🚀 ROADMAP FUTURO

### Curto Prazo (1-2 meses)
- [ ] Implementar YouTube (seguindo este documento)
- [ ] Adicionar testes automatizados
- [ ] Implementar cache de transcrições
- [ ] Melhorar tratamento de erros

### Médio Prazo (3-6 meses)
- [ ] Adicionar Twitter/X
- [ ] Adicionar LinkedIn
- [ ] Sistema de queue para jobs grandes
- [ ] Dashboard de analytics

### Longo Prazo (6-12 meses)
- [ ] API pública
- [ ] Sistema de webhooks
- [ ] Integração com ferramentas de edição
- [ ] Suporte a múltiplos idiomas

---

## 📚 REFERÊNCIAS E RECURSOS

### Documentação Oficial
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [Apify Platform](https://docs.apify.com/)

### Actors Apify Recomendados
- [YouTube Scraper by Cryptosignals](https://apify.com/cryptosignals/youtube-scraper)
- [YouTube Scraper by Streamers](https://apify.com/streamers/youtube-scraper)
- [YouTube Search Scraper](https://apify.com/scraper-engine/youtube-search-scraper)

### Ferramentas e Bibliotecas
- [Next.js 16](https://nextjs.org/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [FFmpeg](https://ffmpeg.org/documentation.html)

---

## 🎯 CONCLUSÃO E RECOMENDAÇÃO FINAL

### Análise Geral da Codebase

**Pontos Fortes:**
- ✅ Funcionalidade TikTok robusta e testada em produção
- ✅ Integração Apify bem abstraída
- ✅ Tipos compartilhados facilitam expansão
- ✅ Download de vídeos universal (yt-dlp)

**Pontos Fracos:**
- ❌ **Duplicação crítica de código** (~1500 linhas duplicadas)
- ❌ Falta de sistema de configuração de plataformas
- ❌ Componentes UI não reutilizáveis
- ❌ Normalização de dados não parametrizada

**Score de Parametrização:** 6/10

---

### Recomendação Estratégica

**🎯 ABORDAGEM RECOMENDADA: Refatoração Incremental + YouTube**

**Justificativa:**
1. **Custo-Benefício:** Investir 22h extras agora economiza 100+ horas futuras
2. **Qualidade:** Código limpo facilita manutenção e debugging
3. **Escalabilidade:** Adicionar novas plataformas se torna trivial
4. **Profissionalismo:** Demonstra maturidade técnica e visão de longo prazo

**Ordem de Execução:**
```
1. Refatorar normalização (6h) → Impacto imediato
2. Unificar API routes (8h) → Elimina duplicação crítica
3. Unificar UI (10h) → Melhora UX e manutenibilidade
4. Adicionar YouTube (12h) → Nova funcionalidade
5. Testes completos (6h) → Garantia de qualidade
```

**Total:** 42 horas (~5 dias úteis)

---

### Próximos Passos Imediatos

1. **✅ Aprovar este documento** e alinhar expectativas
2. **✅ Criar branch** `feature/refactor-and-youtube`
3. **✅ Implementar testes** para TikTok e Instagram (baseline)
4. **✅ Iniciar Fase 1** (Refatoração) seguindo checklist
5. **✅ Code review** após cada fase
6. **✅ Deploy incremental** com feature flags

---

### Mensagem Final

Este projeto tem uma **base sólida**, mas está em um **ponto crítico de decisão**:

- **Caminho A (Rápido):** Duplicar código → Débito técnico insustentável
- **Caminho B (Correto):** Refatorar → Base escalável para crescimento

Como **senior developer pragmático**, recomendo fortemente o **Caminho B**. O investimento adicional de 22 horas agora evitará centenas de horas de retrabalho futuro e tornará o projeto verdadeiramente escalável.

**A escolha é sua, mas a recomendação técnica é clara: refatore primeiro, depois expanda.**

---

**Documento criado por:** Análise Técnica Automatizada  
**Data:** 01/06/2026  
**Versão:** 1.0  
**Status:** Pronto para Revisão

