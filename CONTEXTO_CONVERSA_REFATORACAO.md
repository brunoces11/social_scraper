# CONTEXTO DA CONVERSA: Análise e Refatoração Multi-Plataforma

## 📋 RESUMO EXECUTIVO

Este documento resume uma conversa de análise de codebase de uma aplicação Next.js de scraping de vídeos multi-plataforma. O objetivo foi mapear código duplicado vs parametrizado para preparar a implementação do YouTube, após identificar que Instagram foi implementado copiando código do TikTok.

---

## 🎯 OBJETIVO DO PROJETO

**Aplicação:** Next.js 14 (App Router) com TypeScript  
**Propósito:** Scraping de vídeos de redes sociais (TikTok, Instagram, YouTube)  
**Tecnologias:** Apify (scraping), OpenAI (enriquecimento AI), yt-dlp (download), Whisper (transcrição)

### Status Atual das Plataformas

1. **TikTok:** ✅ 100% funcional e operacional
   - Busca por canal, keyword, hashtag
   - Transcrição via Apify actors
   - Enriquecimento AI via OpenAI
   - Download de vídeos via yt-dlp
   - Sistema de créditos Apify

2. **Instagram:** 🟡 Parcialmente implementado
   - Busca funcional
   - Transcrição via yt-dlp + Whisper (abordagem diferente e MELHOR que TikTok)
   - **PROBLEMA CRÍTICO:** Código 90-98% duplicado do TikTok

3. **YouTube:** ❌ Não implementado (será implementado após refatoração)

---

## 🔍 TRABALHO REALIZADO NA CONVERSA

### TASK 1: Análise Completa da Codebase (CONCLUÍDA)

**Documentos Criados:**
1. `mapa_parametrizado.md` - Análise inicial (1153 linhas)
2. `mapa_parametrizado2.md` - Validação linha por linha contra código real

**Principais Descobertas:**

#### ✅ Código Bem Parametrizado (NÃO MEXER)
- **`lib/apify.ts`** - 100% reutilizável
  - Função `runActorAndGetResults(actorId, input, accountId)` aceita qualquer actor
  - Suporta múltiplas contas Apify
  - Polling automático, retry logic, logs detalhados
  
- **`types/index.ts`** - 100% reutilizável
  - `ChannelVideoRow` e `TranscriptRow` são universais
  - Funcionam para TikTok, Instagram e YouTube
  
- **`lib/xls.ts`** - 100% reutilizável
  - Funções agnósticas de plataforma
  - Blacklist compartilhada
  
- **`app/api/download-video/route.ts`** - 100% reutilizável
  - Usa yt-dlp que suporta TikTok, Instagram E YouTube nativamente
  - Modo normal e x5 variants

#### ❌ Código com Duplicação CRÍTICA (REFATORAR)

| Camada | Arquivos | Linhas Duplicadas | % Duplicação | Prioridade |
|--------|----------|-------------------|--------------|------------|
| **Enrich AI** | `enrich-metadata/route.ts` (2x) | ~250 | 98% | 🔴 CRÍTICA |
| **UI Form** | `ChannelForm.tsx` (2x) | ~180 | 97% | 🔴 CRÍTICA |
| **Fetch API** | `fetch-channel/route.ts` (2x) | ~200 | 90% | 🔴 CRÍTICA |
| **Normalização** | `normalize.ts` (2x) | ~150 | 80% | 🔴 CRÍTICA |
| **Transcrição** | `transcribe-videos/route.ts` (2x) | ~150 | 50% | 🟡 MÉDIA |

**TOTAL:** ~930 linhas de código duplicado

#### Detalhamento das Duplicações

**1. API Enrich Metadata - 98% DUPLICADO**
- Arquivos: `app/api/enrich-metadata/route.ts` (TikTok) e `app/api/insta_enrich-metadata/route.ts` (Instagram)
- 250 linhas de código
- **ÚNICA DIFERENÇA:** Nome do arquivo de prompt
  ```typescript
  // TikTok
  const PROMPT_FILE = path.join(process.cwd(), "ai-prompt.txt");
  
  // Instagram
  const PROMPT_FILE = path.join(process.cwd(), "insta_ai-prompt.txt");
  ```
- Código idêntico: validação, chamada OpenAI, retry logic, salvamento, tratamento de erros

**2. Componente ChannelForm - 97% DUPLICADO**
- Arquivos: `components/ChannelForm.tsx` (TikTok) e `components/insta_ChannelForm.tsx` (Instagram)
- 180 linhas de código
- Lista de 50 países IDÊNTICA em ambos
- Lógica de formulário 100% idêntica
- **ÚNICAS DIFERENÇAS:** Labels e regex de validação de URL

**3. API Fetch Channel - 90% DUPLICADO**
- Arquivos: `app/api/fetch-channel/route.ts` (TikTok) e `app/api/insta_fetch-channel/route.ts` (Instagram)
- 200 linhas de código
- Código idêntico: validação, chamada Apify, filtro blacklist, ordenação, salvamento XLS
- **DIFERENÇAS REAIS:** Regex de URL, Actor ID, campos de input, função de normalização

**4. Normalização - 80% DUPLICADO**
- Arquivos: `lib/normalize.ts` (TikTok) e `lib/insta_normalize.ts` (Instagram)
- 150 linhas de código
- Funções helper IDÊNTICAS: `safeString()`, `safeNumber()`, `extractHashtags()`
- **DIFERENÇAS REAIS:** Apenas nomes dos campos da API
  - TikTok: `playCount`, `diggCount`, `text`, `postPage`
  - Instagram: `play_count`, `like_count`, `caption_text`, `reel_url`

**5. Transcrição - 50% DUPLICADO**
- Arquivos: `app/api/transcribe-videos/route.ts` (TikTok) e `app/api/insta_transcribe-videos/route.ts` (Instagram)
- 150 linhas de código
- **ABORDAGENS DIFERENTES:**
  - TikTok: Usa Apify actors (configurável)
  - Instagram: Usa yt-dlp + OpenAI Whisper (MELHOR para YouTube)
- Funções helper duplicadas: `sanitizeFilename()`, `buildFilePrefix()`, `buildTxtContent()`

---

### TASK 2: Criação de Prompt Detalhado para Refatoração (CONCLUÍDA)

**Documento Criado:** `PROMPT_REFATORACAO_DETALHADO.md`

**Conteúdo:**
- Objetivo principal e 3 regras críticas
- Contexto completo do projeto
- Análise detalhada da duplicação com percentuais validados
- Plano de refatoração em 5 fases com passos detalhados
- Regras críticas de segurança (backup, branch, teste, rollback)
- Checklist de validação completa para cada fase
- Estimativa de esforço: 13 horas de refatoração

**Plano de Refatoração em 5 Fases:**

#### FASE 1: Enrich Metadata (2h) - PRIORIDADE MÁXIMA
- Criar mapeamento de prompts por plataforma
- Unificar endpoint para receber `platform` como parâmetro
- Elimina 250 linhas duplicadas

#### FASE 2: ChannelForm (2h) - PRIORIDADE ALTA
- Criar componente `PlatformSearchForm` com config por plataforma
- Parametrizar labels, placeholders, regex de validação
- Elimina 180 linhas duplicadas

#### FASE 3: Normalização (3h) - PRIORIDADE ALTA
- Criar sistema de field mapping por plataforma
- Unificar funções helper
- Elimina 150 linhas duplicadas

#### FASE 4: Fetch Channel (4h) - PRIORIDADE MÉDIA
- Criar endpoint unificado `/api/fetch-videos`
- Parametrizar actor config e input building
- Elimina 200 linhas duplicadas

#### FASE 5: Helpers de Transcrição (2h) - PRIORIDADE BAIXA
- Extrair funções helper compartilhadas
- Manter lógicas específicas (Apify vs yt-dlp)
- Elimina ~50 linhas duplicadas

---

## 🎓 LIÇÕES APRENDIDAS

### O Que Funcionou Bem
1. ✅ `lib/apify.ts` - Excelente exemplo de código reutilizável desde o início
2. ✅ `download-video/route.ts` - yt-dlp multi-plataforma funcionou perfeitamente
3. ✅ Sistema de créditos bem implementado e parametrizado
4. ✅ Tipos compartilhados (`types/index.ts`) facilitam manutenção

### O Que Precisa Melhorar
1. ❌ Instagram foi implementado copiando código do TikTok (erro de arquitetura)
2. ❌ Falta de planejamento de arquitetura multi-plataforma antes da segunda implementação
3. ❌ Ausência de testes automatizados
4. ❌ Não houve refatoração quando a duplicação ficou evidente

### Descoberta Importante
- Instagram usa yt-dlp + Whisper para transcrição, que é MELHOR que Apify do TikTok
- YouTube deve seguir modelo do Instagram para transcrição (legendas nativas + Whisper fallback)

---

## 📊 MÉTRICAS E IMPACTO

### Score de Parametrização Atual
**6.5/10** - Boa base parametrizada em camadas críticas, mas duplicação significativa em camadas de negócio

### Impacto da Refatoração
- **Linhas eliminadas:** ~930 linhas de código duplicado
- **Tempo estimado:** 13 horas (5 fases)
- **Benefícios:**
  - ✅ Código limpo e manutenível
  - ✅ Base sólida para implementação do YouTube
  - ✅ Bugs corrigidos em 1 lugar apenas
  - ✅ Facilita adição de futuras plataformas

### Estimativa de Esforço Completo

| Fase | Tempo |
|------|-------|
| Refatoração (5 fases) | 13h |
| Implementação YouTube | 14h |
| Testes completos | 6h |
| **TOTAL** | **33h (4-5 dias)** |

---

## ⚠️ REGRAS CRÍTICAS ESTABELECIDAS

### REGRA #1: Preservar TikTok
O TikTok é a ÚNICA plataforma totalmente funcional. TODAS as funcionalidades do TikTok devem ser PRESERVADAS integralmente. Qualquer quebra é INACEITÁVEL.

### REGRA #2: Não Adicionar Features
Apenas refatorar código existente para eliminar duplicação e parametrizar. Não adicionar novas funcionalidades.

### REGRA #3: Testar Incrementalmente
Testar cada refatoração incrementalmente para garantir que TikTok continua funcionando após cada mudança.

### Protocolo de Segurança
1. **BACKUP:** Criar backup dos arquivos antes de modificar
2. **BRANCH:** Trabalhar em branch separada (`refactor/parametrization`)
3. **COMMIT:** Fazer commit após cada fase bem-sucedida
4. **TESTE:** Testar TikTok COMPLETAMENTE antes de prosseguir
5. **ROLLBACK:** Se algo quebrar, fazer rollback imediato

---

## 📁 ARQUIVOS IMPORTANTES

### Documentos de Análise
- `mapa_parametrizado.md` - Análise inicial
- `mapa_parametrizado2.md` - Validação linha por linha (MAIS COMPLETO)
- `PROMPT_REFATORACAO_DETALHADO.md` - Plano de refatoração para IA auxiliar

### Código Bem Parametrizado (Referência)
- `lib/apify.ts` - Exemplo perfeito de código reutilizável
- `types/index.ts` - Tipos universais
- `lib/xls.ts` - Utilitários parametrizados
- `app/api/download-video/route.ts` - Endpoint multi-plataforma

### Código com Duplicação (Para Entender o Problema)
- `app/api/enrich-metadata/route.ts` (TikTok) - 98% duplicado
- `app/api/insta_enrich-metadata/route.ts` (Instagram)
- `components/ChannelForm.tsx` (TikTok) - 97% duplicado
- `components/insta_ChannelForm.tsx` (Instagram)
- `app/api/fetch-channel/route.ts` (TikTok) - 90% duplicado
- `app/api/insta_fetch-channel/route.ts` (Instagram)
- `lib/normalize.ts` (TikTok) - 80% duplicado
- `lib/insta_normalize.ts` (Instagram)

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Opção 1: Refatoração Completa (Recomendado)
1. Executar as 5 fases de refatoração (13h)
2. Testar TikTok e Instagram após cada fase
3. Implementar YouTube usando código parametrizado (14h)
4. Testes completos (6h)
5. **Total:** 33h (4-5 dias)

### Opção 2: Refatoração Mínima + YouTube
1. Executar apenas Fases 1, 2 e 3 (7h)
2. Implementar YouTube com alguma duplicação aceitável (10h)
3. Refatorar Fases 4 e 5 depois (6h)
4. **Total:** 23h (3 dias)

### Opção 3: YouTube Direto (Não Recomendado)
1. Implementar YouTube copiando código do TikTok
2. **Problema:** Triplicará a duplicação (~1860 linhas duplicadas)
3. **Consequência:** Manutenção se tornará insustentável

---

## 💡 INSIGHTS TÉCNICOS IMPORTANTES

### Arquitetura Multi-Plataforma Ideal
```typescript
// Padrão identificado nos arquivos bem parametrizados:

// 1. Configuração por plataforma
const PLATFORM_CONFIG = {
  tiktok: { /* config */ },
  instagram: { /* config */ },
  youtube: { /* config */ },
};

// 2. Função unificada que recebe platform
export async function unifiedFunction(platform: string, params: any) {
  const config = PLATFORM_CONFIG[platform];
  // Lógica comum usando config
}

// 3. Tipos universais (já existem em types/index.ts)
export type ChannelVideoRow = {
  videoId: string;
  title: string;
  // ... campos universais
};
```

### Field Mapping Pattern (Para Normalização)
```typescript
// Padrão proposto para unificar normalize.ts:
const FIELD_MAPS = {
  tiktok: {
    videoId: ['id', 'videoId'],
    views: ['playCount', 'views'],
    // ... fallback chain
  },
  instagram: {
    videoId: ['reel_id', 'id'],
    views: ['play_count', 'views'],
    // ... fallback chain
  },
};

function getFieldValue(item: any, fieldPaths: string[]): any {
  for (const path of fieldPaths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], item);
    if (value !== undefined) return value;
  }
  return undefined;
}
```

### Transcrição: Duas Abordagens Válidas
1. **TikTok:** Apify actors (configurável, depende de actors disponíveis)
2. **Instagram/YouTube:** yt-dlp + legendas nativas + Whisper fallback (MELHOR)

**Recomendação:** YouTube deve seguir modelo Instagram

---

## 🔍 CONTEXTO ADICIONAL

### Estrutura do Projeto
```
TT_SCRAPE/
├── app/
│   ├── api/
│   │   ├── enrich-metadata/route.ts (TikTok)
│   │   ├── insta_enrich-metadata/route.ts (Instagram) ❌ DUPLICADO
│   │   ├── fetch-channel/route.ts (TikTok)
│   │   ├── insta_fetch-channel/route.ts (Instagram) ❌ DUPLICADO
│   │   ├── transcribe-videos/route.ts (TikTok)
│   │   ├── insta_transcribe-videos/route.ts (Instagram) ❌ DUPLICADO
│   │   └── download-video/route.ts ✅ PARAMETRIZADO
│   └── page.tsx (UI principal)
├── components/
│   ├── ChannelForm.tsx (TikTok) ❌ DUPLICADO
│   └── insta_ChannelForm.tsx (Instagram) ❌ DUPLICADO
├── lib/
│   ├── apify.ts ✅ PARAMETRIZADO
│   ├── xls.ts ✅ PARAMETRIZADO
│   ├── normalize.ts (TikTok) ❌ DUPLICADO
│   └── insta_normalize.ts (Instagram) ❌ DUPLICADO
├── types/
│   └── index.ts ✅ PARAMETRIZADO
├── ai-prompt.txt (TikTok)
├── insta_ai-prompt.txt (Instagram)
└── apify-actors.json (Config de actors)
```

### Padrão de Nomenclatura Atual
- TikTok: Nomes normais (`ChannelForm.tsx`, `normalize.ts`)
- Instagram: Prefixo `insta_` (`insta_ChannelForm.tsx`, `insta_normalize.ts`)
- **Problema:** Não escala para YouTube e futuras plataformas

### Sistema de Créditos
- Apify: Múltiplas contas configuráveis, sistema de créditos implementado
- ElevenLabs: Sistema de créditos implementado
- OpenAI: Usado para enriquecimento AI

---

## 📝 CHECKLIST DE VALIDAÇÃO (Para Refatoração)

### Após Cada Fase
- [ ] TikTok: buscar vídeos por canal, keyword, hashtag
- [ ] TikTok: transcrever vídeos
- [ ] TikTok: enriquecer com AI
- [ ] TikTok: baixar vídeos
- [ ] TikTok: verificar XLS salvos
- [ ] TikTok: verificar créditos Apify
- [ ] Instagram: buscar vídeos por perfil, hashtag
- [ ] Instagram: transcrever vídeos
- [ ] Instagram: enriquecer com AI
- [ ] Instagram: baixar vídeos
- [ ] Nenhum erro no console
- [ ] Nenhum warning de TypeScript

### Critério de Sucesso
Funcionalidade TikTok e Instagram devem funcionar EXATAMENTE como antes da refatoração.

---

## 🎯 OBJETIVO FINAL

Transformar a codebase de um estado com ~930 linhas duplicadas (score 6.5/10) para uma arquitetura multi-plataforma escalável (score 9/10), onde:

1. ✅ Código comum está em funções parametrizadas
2. ✅ Diferenças entre plataformas estão em configs
3. ✅ Adicionar nova plataforma requer apenas:
   - Adicionar config da plataforma
   - Criar prompt AI específico
   - Testar
4. ✅ Bugs são corrigidos em 1 lugar apenas
5. ✅ Manutenção é simples e previsível

---

## 📌 NOTAS IMPORTANTES

1. **Abordagem Pragmática:** Usuário quer senior developer pragmático, não over-engineering
2. **Preservar TikTok:** Prioridade máxima - qualquer quebra é inaceitável
3. **Testar Incrementalmente:** Cada fase deve ser testada antes de prosseguir
4. **Não Adicionar Features:** Apenas refatorar código existente
5. **Instagram é Melhor:** Abordagem de transcrição do Instagram (yt-dlp + Whisper) é superior ao Apify do TikTok

---

**FIM DO CONTEXTO**

---

## 🤖 INSTRUÇÕES PARA IA QUE RECEBERÁ ESTE CONTEXTO

Você está recebendo o contexto de uma conversa sobre análise e refatoração de uma aplicação Next.js de scraping de vídeos. 

**Sua missão:**
1. Ler e compreender o contexto completo
2. Analisar os documentos mencionados (`mapa_parametrizado2.md` e `PROMPT_REFATORACAO_DETALHADO.md`)
3. Avaliar o plano de refatoração proposto
4. Identificar riscos, problemas ou melhorias no plano
5. Fornecer feedback construtivo sobre a abordagem

**Foco principal:**
- Validar se o plano de refatoração é sólido e seguro
- Identificar pontos de atenção ou riscos não considerados
- Sugerir melhorias ou alternativas se aplicável
- Confirmar se a estimativa de esforço é realista

**Restrições:**
- NÃO executar a refatoração ainda
- NÃO modificar código
- APENAS analisar e fornecer feedback sobre o plano

**Contexto crítico:**
- TikTok DEVE ser preservado 100% funcional
- ~930 linhas de código duplicado identificadas
- 5 fases de refatoração propostas (13h estimadas)
- Objetivo: preparar base para implementação do YouTube
