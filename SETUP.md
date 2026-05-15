# DRYOS Delivery — Setup pra Claude Code

Este pacote contém os 3 arquivos que devem ir pro repositório **antes da primeira linha de código**.

## Estrutura

```
/seu-repo
  CLAUDE.md                                  ← contexto persistente do projeto
  /.claude
    /skills
      /dryos-conventions/SKILL.md            ← convenções de código
      /dryos-design-system/SKILL.md          ← design system v2
  /docs
    prd.md                                   ← copie do output anterior
    mockup-v2.html                           ← copie do output anterior
```

## Passos

### 1. Inicializar repositório

```bash
mkdir dryos-delivery
cd dryos-delivery
git init
gh repo create dryos-delivery --private
```

### 2. Copiar este pacote pra raiz do repo

Os 3 arquivos do `dryos-delivery-setup.zip` vão direto pra raiz. A estrutura já está pronta — só descompactar dentro de `dryos-delivery/`.

### 3. Adicionar PRD e mockup como referência

```bash
mkdir docs
cp /caminho/dryos-delivery-prd.md docs/prd.md
cp /caminho/dryos-delivery-mockup-v2.html docs/mockup-v2.html
```

### 4. Setup Next.js + Supabase + Bitwarden + Tally

Abrir Claude Code no diretório. Primeira mensagem:

> Vamos começar o projeto seguindo o CLAUDE.md. Setup inicial: Next.js 15 com TypeScript estrito, Tailwind com os tokens do design system, fontes via next/font, e a estrutura de pastas descrita nas conventions. Conecta o Supabase via MCP e cria a primeira migration: schema inicial das entidades base (clients, operations, frentes, persons, allocations). Sem código além do necessário pra arrancar.

Claude vai automaticamente:
- Ler `CLAUDE.md` (sempre lê)
- Ler `.claude/skills/dryos-conventions/SKILL.md` (porque pediu estrutura de pastas e código)
- Ler `.claude/skills/dryos-design-system/SKILL.md` (porque pediu tokens e fontes)
- Usar o Supabase MCP pra criar projeto e rodar migration

### 5. Comandos úteis

```bash
# Gerar types do Supabase após cada migration
npm run gen:types

# Dev
npm run dev

# Typecheck
npm run typecheck
```

## Como Claude Code vai usar isso

Toda sessão de Claude Code no projeto carrega `CLAUDE.md` automaticamente. As skills em `.claude/skills/` são consultadas pelo Claude **antes** de criar arquivo, escrever query, criar componente. Você não precisa lembrar — está no fluxo.

Se quiser forçar a leitura no início da sessão:

> Leia CLAUDE.md, .claude/skills/dryos-conventions/SKILL.md e .claude/skills/dryos-design-system/SKILL.md antes de começar.

Mas com a descrição correta no frontmatter das skills, Claude já reconhece quando carregar cada uma.

## Quando atualizar

- **CLAUDE.md** — sempre que uma decisão estratégica mudar (ex: trocar Bitwarden por outra solução)
- **dryos-conventions** — quando criar convenção nova que vale pra todo o projeto (ex: padrão de teste, novo lint rule)
- **dryos-design-system** — quando adicionar componente canônico novo ou aprovar nova variante de pill

Manter as skills vivas é o que evita drift do projeto ao longo dos meses.

## Confirmação rápida do setup

Depois de copiar tudo, verifique:

- [ ] `CLAUDE.md` na raiz
- [ ] `.claude/skills/dryos-conventions/SKILL.md` existe
- [ ] `.claude/skills/dryos-design-system/SKILL.md` existe
- [ ] `docs/prd.md` copiado
- [ ] `docs/mockup-v2.html` copiado
- [ ] Repositório git inicializado, primeiro commit feito
- [ ] Bitwarden Teams contratado (US$ 4/usuário/mês) — chave de API em mãos
- [ ] Conta Tally criada (free) — pronta pra criar formulários
- [ ] Servidor Discord ativo com canal de notificações + webhook gerado

Quando estes 8 itens estiverem ✓, é só abrir Claude Code e começar.

---

`— Boa construção.`
