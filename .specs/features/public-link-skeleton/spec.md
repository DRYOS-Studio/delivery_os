# public-link-skeleton Specification

## Problem Statement

Tudo que foi construído até aqui (briefing, frentes, reuniões, decisões, anexos) só é visível a usuários **autenticados** internos da DRYOS. O modelo de marca, no entanto, prevê **link público com token** pra cada Operação — papel "Visualizador externo" mencionado no PRD.

Sem isso:
- Cliente não tem onde ver progresso da Operação dele. Volta a depender de Slack/email/reuniões manuais.
- O esforço de marcar `visibility=cliente` em reuniões/decisões fica sem destino. Inv. 05 perde sentido prático.
- Princípio 05 ("Tudo escrito como se cliente fosse ler") fica abstrato; sem canal externo, ninguém revisa por essa lente.

Esta feature traz o **esqueleto** do canal externo: token-based public route, view filtrada com **Frentes + actionable_status**, **reuniões/decisões com visibility=cliente** e **anexos não-meeting**. Sem briefing público (decisão deliberada — pode entrar v2 quando o briefing tiver visibility própria).

Esta é a última peça da sem 03.

## Goals

- [ ] Toda Operação pode ter **múltiplos public links** (admin gera/revoga). Token uuid sortido.
- [ ] Rota pública `/public/[token]` (fora do grupo `(app)`, sem auth) que valida token e renderiza view filtrada
- [ ] View pública mostra: Hero compacto (nome da Op + cliente + produto) + lista de Frentes com actionable_status + timeline de reuniões+decisões (apenas visibility=cliente) + lista de anexos da Op (com meeting_id NULL) com download
- [ ] Admin tem UI em `/operations/[id]` (section nova "Acesso público") pra:
  - Gerar novo link (campo "Nome/destinatário" opcional + botão "Gerar")
  - Ver links ativos (lista com nome, criado, último acesso, URL completa, "Revogar")
  - Copiar URL
- [ ] Acesso loga `last_accessed_at` no link (update lightweight no GET)
- [ ] Sem auth no `/public/[token]` — quem tem o link entra
- [ ] Anexos públicos: download via Route Handler dedicado `/public/[token]/attachments/[aid]/download` (signed URL temp; valida que attachment é da Op do token e meeting_id IS NULL OR meeting tem visibility=cliente)

## Out of Scope

- **Briefing público** — decisão deliberada; pula MVP. Razão: briefing hoje não tem visibility própria por campo; cliente pode ver demais se for público inteiro. Quando briefing ganhar visibility por seção (ou flag global), entra.
- **Vilões + diagnóstico público** — vem com a sem 04.
- **SLA público** — vem com feature `sla` (sem 03 restante ou v2).
- **Comentários do cliente externo** — fora do escopo do MVP; cliente é viewer.
- **Email de invite com link** — admin copia URL manualmente. Discord integration pode automatizar isso depois.
- **Expiração automática de link** — coluna `expires_at` reservada no schema mas validação não é feita no MVP. UI mostra "(sem expiração)". Validar começa na v2.
- **Rate limit** — sem middleware no MVP. Token é secreto; abuse raro. Vercel/Supabase têm limits globais.
- **Logs detalhados de acesso (IP, user agent)** — só `last_accessed_at`. Auditoria detalhada vem com painel admin.
- **Per-link visibility override** — não. Visibility é por entidade (meeting/decision). Link só filtra.
- **Customização do que aparece por link** — não. Todos os links da mesma Op mostram o mesmo conteúdo. "Múltiplos links" serve só pra revogar individualmente.
- **Dark mode toggle público** — usa light por default.
- **Modo dev/preview pra admin** — sem botão "Ver como cliente". Admin abre URL pública na navegação privada/outro browser.

---

## User Stories

### P1: Schema public_links + revogação ⭐ MVP

**User Story**: Como admin, posso gerar múltiplos links públicos por Operação e revogar individualmente.

**Why P1**: Schema é base de tudo.

**Acceptance Criteria**:

1. Tabela `public_links`:
   - id uuid PK
   - operation_id uuid NOT NULL FK CASCADE
   - token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
   - label text (opcional — "Time do cliente X")
   - last_accessed_at timestamptz NULL
   - revoked_at timestamptz NULL (soft — facilita re-ativar se preciso)
   - expires_at timestamptz NULL (reservado, sem validação MVP)
   - created_at, updated_at timestamptz
2. Index único em token
3. RLS authenticated full crud em `public_links`
4. **Acesso público** ao token: query feita via `createAdmin()` server-side bypassa RLS (no Route Handler de validação) — ou cria policy específica permitindo SELECT por token. Decisão design: usar `createAdmin()` simples.
5. Trigger updated_at

---

### P1: UI admin em /operations/[id] "Acesso público" ⭐ MVP

**User Story**: Como admin, em /operations/[id] vejo section nova "Acesso público" com lista de links + botão "Gerar".

**Acceptance Criteria**:

1. Section nova depois de `AttachmentsSection` e antes de FinanceCards
2. Header h2 + Pill contagem + form inline "Gerar novo link" (input label opcional + button "Gerar")
3. Lista cada link: 
   - URL completa (mono, copy button)
   - Label (se houver)
   - Criado em + último acesso (relativo)
   - Pill "Revogado" se revoked_at NOT NULL
   - Botões "Copiar URL" + "Revogar" (só ativos)
4. Empty state: "Nenhum link público gerado. Gere o primeiro pra compartilhar com o cliente."
5. Actions:
   - `createPublicLinkAction(operationId, label?)` 
   - `revokePublicLinkAction(linkId)` — set revoked_at = now()

---

### P1: Rota /public/[token] com view filtrada ⭐ MVP

**User Story**: Cliente abre URL `/public/<token>` e vê painel da Operação.

**Why P1**: É a feature.

**Acceptance Criteria**:

1. Rota fora do grupo `(app)` — fica em `/src/app/public/[token]/page.tsx`
2. Layout simples sem sidebar; logo DRYOS pequeno no topo
3. Validação:
   - `validatePublicToken(token)` → resolve operation_id ou null
   - Se inválido OU `revoked_at NOT NULL` → 404 com mensagem "Link inválido ou expirado"
   - Update `last_accessed_at = now()` (silencioso; fire-and-forget)
4. View pública mostra:
   - Hero: cliente + Op name + product_line + status pill
   - **Frentes**: lista compacta (não a `FrentesListSection` interna; nova `PublicFrentesList` enxuta) com nome, pill cycle, pill domain, actionable_status, dias desde update
   - **Timeline reuniões+decisões**: reusa lógica de merge+sort, **mas filtrando visibility=cliente** (server query); preview enxuto sem botão editar
   - **Anexos**: reusa lista mas sem delete button; download via `/public/[token]/attachments/[aid]/download` route handler
5. Footer "Powered by DRYOS Delivery"

---

### P1: Route handler download público ⭐ MVP

**User Story**: Cliente clica num anexo no link público → arquivo baixa.

**Acceptance Criteria**:

1. `/src/app/public/[token]/attachments/[aid]/download/route.ts` GET handler
2. Valida token (revoked, exists) + valida attachment pertence à Op do token + valida (meeting_id IS NULL OR meeting.visibility = 'cliente')
3. Gera signed URL TTL 5min com `createAdmin()` (bypassa RLS storage)
4. Redirect 302

---

### P1: Copy button ⭐ MVP

**User Story**: Click "Copiar URL" copia a URL completa pra clipboard.

**Acceptance Criteria**:

1. Client component pequeno (`CopyButton`) com navigator.clipboard.writeText
2. Visual feedback "Copiado ✓" por 2s

---

### P2: Logar IP/user-agent

Fora do MVP. Auditoria detalhada vem com painel admin.

---

### P3: Botão "Ver como cliente" no admin

Pula. Admin abre URL pública manualmente.

---

## Edge Cases

- **Token UUID válido mas linha não existe** → 404
- **Token UUID válido + revoked_at NOT NULL** → 404 (mensagem específica? não — só "Link inválido ou expirado". Razão: não revelar status pra atacante)
- **Token expirado (expires_at < now)** → MVP **não valida** (reservado pra v2)
- **Operação arquivada** → link ainda funciona (operação tem histórico válido). Pode adicionar pill "arquivada" no hero público.
- **Cliente acessa via prerendered cache** → `revalidatePath('/public/[token]')` chamado em revokeAction. `last_accessed_at` precisa rota dinâmica (`force-dynamic`) ou `revalidatePath` por mudança.
- **Attachment de meeting interno** → public route handler valida visibility da meeting; nega se interno
- **Briefing acidentalmente vazado** → não renderiza no MVP. Future: filtrar por seção quando visibility por seção for adicionada.
- **Multiple links pra mesma Op acessados simultaneamente** → ok; cada um atualiza seu próprio `last_accessed_at`
- **Token com caracteres inválidos** → UUID validation no Route Handler regex; 404 se não bate
- **CASCADE de Operation arquivada** → links permanecem ativos no DB (operations não é deletada, só archived). Cliente vê painel histórico.

---

## Success Criteria

- [ ] typecheck + build verdes (rotas: 31 + 2 = 33; sendo 1 page público + 1 route handler público)
- [ ] Acme/Core: gerar link com label "Cliente Acme" → URL copiada → abrir em janela privada
- [ ] View pública mostra:
  - Hero com nome
  - Frentes "Infra" + "Dados Analiticos" com actionable_status
  - Reunião visibility=cliente aparece; reunião interna NÃO aparece
  - Decisão visibility=cliente aparece; decisão interna NÃO aparece
  - Anexo da Op (sem meeting_id) listado com download
  - Anexo de meeting interno NÃO listado
- [ ] Click download de anexo → baixa via signed URL
- [ ] Revogar link → recarregar URL pública → 404
- [ ] Voltar pra /operations/[id] → ver "último acesso" preenchido após visita
- [ ] Screenshots: section admin com 2 links, view pública completa, 404 de link inválido

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Token mecanismo | Tabela separada `public_links` | Múltiplos links/Op, revogar individualmente, soft delete via revoked_at |
| Briefing público | Não no MVP | Sem visibility por seção; correriámos risco de vazar; cliente já tem reuniões/frentes/decisões |
| Auth | Sem login | Token é a credencial; cliente compartilha link internamente |
| `last_accessed_at` | Update fire-and-forget | Métrica útil de uso; sem custo (single UPDATE) |
| Rate limit | Não no MVP | Vercel/Supabase têm globais; token é secreto |
| Expires | Coluna reservada, não validada | MVP simples; v2 valida |
| Logs IP/UA | Não | Auditoria detalhada vem com painel admin |
| Public route fora do (app) | Sim, `/src/app/public/...` | Sem layout autenticado; sidebar, etc |
| Validate via `createAdmin` ou RLS policy | createAdmin server-side | Simples; sem precisar criar policy `anonymous` |
| Tabela visit_logs | Não | Single col last_accessed_at basta |
| Frentes filter | Mostra todas (mesmo archived?) | NÃO archived; filtra arquivadas (já é padrão) |
| Storage download | Signed URL via Route Handler | Mesmo padrão da auth route, mas via createAdmin |
| Dark mode no público | Light only | Cream papel é padrão de marca; toggle vem v2 |
| `force-dynamic` na page | Sim | Garante read fresh + last_accessed_at update |
