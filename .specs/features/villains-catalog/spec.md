# villains-catalog Specification

## Problem Statement

A semana 04 abre o coração narrativo do DRYOS Delivery: **os 7 vilões da ineficiência operacional**. PRD §04 deixa explícito que são "entidade fixa do catálogo da marca. 7 registros iniciais. Editáveis por admin, nunca deletáveis (apenas arquiváveis)" (Inv. 06).

Sem esse catálogo:
- Diagnóstico (próxima feature) não tem o que listar
- Operation × Villain (M:N com severidade + progresso) não existe
- Quick Wins não têm contra quem somar impacto
- Cliente externo não vê narrativa de marca no relatório público
- Painel agregado da sem 05 ("vilão mais derrotado do trimestre") fica sem catálogo

Esta feature é a **fundação narrativa**: 1 tabela seed com os 7 vilões canon + rota `/catalog/villains` (edit + archive) substituindo o placeholder genérico de catálogo.

## Goals

- [ ] Tabela `villains` com schema completo (name, slug, quote, description, icon_name, pill_variant, archived_at)
- [ ] Seed dos 7 vilões na mesma migration: Manualis, Silos, Retrabalho, Lento, Achismo, Drenador, Enganador
- [ ] Citações canon: 3 do mockup (Manualis, Silos, Achismo) + 4 propostas no mesmo tom (Retrabalho, Lento, Drenador, Enganador) — admin pode ajustar
- [ ] Rota `/catalog` substitui PlaceholderSection: lista os 7 com card visual (icon + pill + name + quote + description) + Link "Editar"
- [ ] `/catalog/villains/[id]/edit`: form edit (name, slug, quote, description, icon_name, pill_variant) + Archive
- [ ] Archive bloqueia se vilão está em uso (qualquer FK em operation_villains — virá na próxima feature; **placeholder** pra MVP: sempre permite archive)
- [ ] Inv. 06 enforced: sem DELETE policy no RLS (só authenticated SELECT/INSERT/UPDATE)

## Out of Scope

- **CREATE de vilão novo via UI** — Inv. 06 diz "7 fixos da marca". Adicionar 8º vilão = decisão de marca, não admin operacional. Pula MVP.
- **Re-ativar vilão arquivado** — não vamos arquivar nenhum dos 7 no MVP, então flow de unarchive é teórico. Se aparecer, set `archived_at = NULL` via SQL.
- **Vilão custom por cliente** — explicitamente vedado por Inv. 06.
- **Estatísticas agregadas** ("vilão mais derrotado") — vem com painel admin sem 05.
- **Visual ilustração 120px** mencionada no PRD — usa Lucide icons no MVP. Ilustrações dedicadas viram v2.
- **Ordering customizável** — fixo por `display_order` int (campo extra).
- **Ícone upload custom** — usa lucide-react name string.
- **i18n** — só pt-BR.
- **Tooltips** — quote no card já dá contexto.

---

## User Stories

### P1: Tabela villains + seed 7 ⭐ MVP

**User Story**: Schema cria a tabela e popula os 7 vilões canon.

**Acceptance Criteria**:

1. Migration:
   - CREATE TABLE `villains`:
     - id uuid PK
     - name text NOT NULL (ex: "Capitão Manualis")
     - slug text UNIQUE NOT NULL (ex: "manualis")
     - quote text NOT NULL (ex: "Sempre foi assim.")
     - description text NOT NULL (uma frase narrativa)
     - icon_name text NOT NULL (lucide-react name, ex: "ClipboardList")
     - pill_variant text NOT NULL (sage/oak/warning/critical/neutral)
     - display_order int NOT NULL UNIQUE (1-7)
     - archived_at timestamptz
     - created_at, updated_at
   - 7 INSERTs:
     1. Manualis (slug: manualis, icon: ClipboardList, variant: oak)
     2. Silos (slug: silos, icon: Database, variant: warning)
     3. Retrabalho (slug: retrabalho, icon: RotateCcw, variant: oak)
     4. Lento (slug: lento, icon: Hourglass, variant: warning)
     5. Achismo (slug: achismo, icon: HelpCircle, variant: critical)
     6. Drenador (slug: drenador, icon: Droplet, variant: critical)
     7. Enganador (slug: enganador, icon: EyeOff, variant: critical)
   - CHECK pill_variant IN (...) enforcing valid values
2. RLS:
   - SELECT + INSERT + UPDATE pra authenticated
   - **SEM** policy DELETE (Inv. 06: nunca deletar)
3. Trigger updated_at
4. Index em archived_at IS NULL (parcial)

---

### P1: Catálogo read em /catalog ⭐ MVP

**User Story**: Em /catalog vejo grid dos 7 vilões com visual rico.

**Acceptance Criteria**:

1. Substitui `PlaceholderSection` atual em `/catalog`
2. Header h1 "Catálogo" + subtitle "Universo de marca: os 7 vilões da ineficiência"
3. Grid responsivo (3 cols desktop, 1 mobile): cada card mostra:
   - Icon (Lucide dynamic, stroke 1.75, w-8 h-8) com bg do variant
   - Name (font-display large)
   - Quote (italic, smaller)
   - Description (text-mute)
   - Pill com slug
   - Link "Editar →" no canto
4. Vilões arquivados ficam no fim com opacity reduzida + Pill "Arquivado"

---

### P1: Edit page com archive ⭐ MVP

**User Story**: Em `/catalog/villains/[id]/edit`, posso ajustar conteúdo do vilão.

**Acceptance Criteria**:

1. UUID guard
2. Form: name (required), slug (required, lowercase + hyphens), quote (required), description (required, max 500), icon_name (select com 20 lucide options), pill_variant (select 5 valores)
3. Submit → update via action; redirect /catalog
4. Botão "Arquivar" (ghost critical, window.confirm)
5. Se já arquivado: botão "Restaurar"
6. Botão "Remover" **NÃO existe** (Inv. 06)

---

### P2: Visual ilustração custom

Pula MVP. Lucide icons cobrem.

---

### P3: Reorder via drag-and-drop

Pula. `display_order` permite mudança via edit form (input number).

---

## Edge Cases

- **slug duplicado** → DB constraint UNIQUE; UI mostra erro inline `validation_slug`
- **display_order duplicado** → UNIQUE; UI mostra erro
- **Tentar DELETE via SQL direto authenticated** → rejeitado pela ausência de policy
- **Service role / admin** podem DELETE — aceito (escape hatch)
- **Vilão arquivado referenciado em operation_villains** (futura feature) → CASCADE faria mal; usar SET NULL? **Decisão pra esta feature**: deixar FK na próxima migration, não aqui. Esta tabela só.
- **icon_name inválido** (não existe em lucide) → UI renderiza fallback genérico (HelpCircle); admin precisa corrigir

---

## Success Criteria

- [ ] typecheck + build verdes (rotas: 35 + 1 = 36)
- [ ] /catalog mostra 7 vilões com icons + cores
- [ ] Editar Manualis → mudar quote → reflete
- [ ] Arquivar Drenador → fica no fim com badge "Arquivado"
- [ ] Restaurar Drenador → volta ao normal
- [ ] Tentar DELETE via SQL direto → rejeitado por RLS
- [ ] Screenshots: catalog grid, edit form, archived state

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Adicionar 8º vilão | Não no MVP | Inv. 06 fixa 7 |
| icon_name como text | Sim (lucide name) | Flexível, sem migrar quando trocar ícone |
| pill_variant | Texto + CHECK | Reusa palette existente |
| Ordering | display_order int UNIQUE | Estável e editável |
| Quote required | Sim | Identidade narrativa |
| Description required | Sim | Cliente lê |
| Soft delete only | Sim | Inv. 06; sem policy DELETE no RLS |
| Restaurar | Sim | Set archived_at = NULL via action |
| Visual custom | Lucide icons | MVP simples; ilustrações dedicadas viram v2 |
| Tabela em schema public | Sim | Default; sem schema dedicado |
| Naming canon | Mockup mostra "Capitão Manualis", "Senhor dos Silos", "Dama do Retrabalho", "General Lento", "Oráculo do Achismo", "Drenador", "Enganador" | Preservar prefixos no name; slug é curto sem prefixo |
| Citações faltantes | Propor no mesmo tom (1ª pessoa, defensiva) | Admin ajusta no edit se quiser |
