# — DRYOS Delivery

**Sistema operacional de entrega da DRYOS**

`— PRD v1.1 · Maio 2026 · Pronto para construção`

---

## — 01 Visão

DRYOS Delivery é o sistema operacional interno da DRYOS para gerir a entrega de tudo que a casa vende — Core, Sparks e Studio. Não é mais um PM genérico. É a camada que conecta **Proposta → Implantação → Operação contínua → Renovação**, com inteligência específica sobre os produtos da DRYOS e continuidade narrativa com a marca (os 7 vilões, o diagnóstico, os quick wins).

Cobre três modelos de negócio que coexistem dentro da DRYOS:
- **Core** — implantação 2-4 semanas + operação contínua recorrente
- **Spark** — setup 7-14 dias + operação contínua recorrente com SLA
- **Studio** — projeto sob medida, finito ou com cláusula de evolução pra recorrência

A face interna é ferramenta de trabalho diário. A face externa é relatório premium pro cliente, com narrativa dos vilões derrotados e quick wins entregues — diferencial vendável que justifica recorrência.

---

## — 02 Por que existir

PMs genéricos (Asana, ClickUp, Monday, Notion) falham em três dores específicas da DRYOS:

**Não modelam ciclo de vida estendido.** Eles assumem "projeto tem início e fim". Mas Core e Spark não terminam — viram operação contínua. Studio Launch tem edições episódicas que repetem. Forçar tudo no formato "tem fim" faz cliente recorrente sumir da régua e operação perpétua parecer "projeto eterno em andamento".

**Não conectam diagnóstico → entrega → relatório.** A DRYOS vende contra os 7 vilões. PMs tradicionais não têm conceito de vilão, severidade inicial, quick win com peso, % derrotado. Resultado: o diferencial narrativo da DRYOS morre na entrega.

**Não separam infra de dados.** A DRYOS sempre cuida da infra. Pode adicionar camada analítica (Pulse, Insights) ou trabalho pontual de dados (ETL, migração). Cada um tem ritmo próprio. PMs genéricos misturam tudo em "tarefas".

DRYOS Delivery resolve essas três dores e nada mais. Não tenta substituir Toggl, GitHub, Slack/Discord ou o Cockpit do Lançamento — esses ficam onde estão.

---

## — 03 Princípios

`— 01` **Sistema é mapa, não cofre.** Bitwarden guarda senha. Delivery guarda a referência.

`— 02` **Decisão ≠ tarefa.** Decisão é registro perpétuo do que foi resolvido. Tarefa é o que executa. Sistema mantém separados.

`— 03` **Operação não termina; Frentes vão e vêm.** Operação é o contrato comercial. Frente é o fluxo de entrega. Operação Core nunca tem data de fim — tem Frentes que abrem e fecham.

`— 04` **Status acionável obrigatório.** Toda Frente carrega status no formato "aguardando X de Y desde Z". Status genérico ("em andamento") está proibido.

`— 05` **Tudo escrito como se cliente fosse ler.** Exceto o explicitamente marcado interno. Esse princípio força disciplina e habilita o link público sem trabalho duplicado.

`— 06` **Os 7 vilões são universo de marca.** Não custom por cliente. Novos vilões viram parte permanente do grupo.

`— 07` **Não substituir o que funciona fora.** Toggl, GitHub, Discord, Cockpit — Delivery aponta, não recria.

`— 08` **Cream papel é padrão.** Modo escuro replica o tratamento da seção Core do site.

`— 09` **Pills coloridas são o sistema canônico de status.** Toda situação vira pill com cor funcional. Seis cores cobrem todos os estados (neutro, oak/marca, sage/positivo, ok, warning, critical). Novos estados precisam caber numa cor existente; adicionar nova cor é decisão deliberada de design system, não improviso.

`— 10` **Ícones são funcionais, nunca decorativos.** Todo ícone descreve uma natureza (entidade, ação, status). Lucide-style, stroke 1.75, cor oak por padrão.

`— 11` **Hierarquia tipográfica calibrada.** Funnel Display em peso 600-700 fica reservado pra números grandes (KPIs principais), hero da Operação, nomes de cliente e títulos display. Hierarquia secundária (títulos de seção, cards, navegação) usa peso 500-600 em 14-16px com Onest. Mono pra metadata, datas, contagens.

---

## — 04 Modelo de domínio

### Hierarquia central

```
Cliente
  └─ Operação (contrato comercial — preço, recorrência, faturamento)
        └─ Frente (entrega — ciclo próprio, time, status)
              ├─ Tipo de ciclo
              └─ Domínio
```

### Tipos de ciclo (da Frente)

| Tipo | Forma | Onde se aplica | Métrica |
|---|---|---|---|
| **A** | Finito puro | Studio Custom one-off | Marcos no prazo |
| **B** | Finito → recorrente | Studio com cláusula de evolução | Marcos + decisão de evolução |
| **C** | Contínuo desde o início | Core, Sparks | SLA mensal, saúde, expansão |
| **D** | Episódico recorrente | Studio Launch — Edições | Performance da edição + capacidade do calendário |
| **E** | Contínuo de manutenção | Evergreen | Uptime, taxa de erro, integridade de dados |

### Domínios (da Frente)

- **Infra** — sempre presente em qualquer Frente da DRYOS
- **Dados Analíticos** — opcional, contínuo (relatórios, narrativa por IA, modelos)
- **Dados Técnicos** — opcional, pontual (ETL, migração, enriquecimento)

Os três domínios podem coexistir na mesma Operação como Frentes paralelas com ciclos próprios.

### Entidades

**Cliente** — empresa atendida pela DRYOS. Carrega pessoas externas, vilões em luta agregados das Operações, credenciais (referências Bitwarden).

**Operação** — instância vendida (um Core, um Spark Inbox, um Studio Launch). Contrato comercial, preço, recorrência, faturamento. Vinculada a um Diagnóstico que originou.

**Frente** — fluxo de entrega dentro da Operação. Tipo de ciclo + domínio + responsável + alocação de pessoas + status acionável + fase atual.

**Pessoa** — interna (Dryos, com especialidade) ou externa (cliente ou parceiro do cliente, com papel).

**Alocação** — relação Pessoa ↔ Frente com papel (Responsável, Executor, Aprovador, Plantão), capacidade comprometida (% semana) e período.

**Briefing** — form vivo anexado à Operação. Toda alteração gera versão e referencia origem (manual ou via Decisão de Reunião).

**Reunião** — vinculada a Cliente e uma ou mais Operações. Tipo (kick-off, alinhamento, status, war room, encerramento), participantes, anotações, visibilidade (interna ou com cliente).

**Decisão** — sub-item de Reunião. Descrição, dono, status (pendente, em andamento, executada, revogada), Operação/Frente afetada, visibilidade própria (mesmo em reunião com cliente, decisão individual pode ser interna).

**Vilão** — entidade fixa do catálogo da marca. 7 registros iniciais (Manualis, Silos, Retrabalho, Lento, Achismo, Drenador, Enganador). Editáveis por admin, nunca deletáveis (apenas arquiváveis).

**Diagnóstico** — vinculado ao Cliente, precede a Operação. Vilões detectados com severidade inicial (baixo / médio / alto / crítico) + evidência. Recomendação de produto. Pode ser preenchido via formulário Tally.

**Operação ↔ Vilão** — relação M:N. Severidade inicial (do diagnóstico), progresso atual (% derrotado, 0-100).

**Quick Win** — unidade de avanço. Vinculado a Operação (e opcionalmente Frente). Descrição, data, executor, impacto em N vilões. Soma trava em 100% por vilão na Operação. Visibilidade padrão: compartilhada.

**Catálogo de Quick Wins** — tipos pré-definidos com pesos sugeridos por vilão. Modelo híbrido: responsável escolhe tipo e pode ajustar caso a caso justificando.

**Credencial** — referência a item no Bitwarden. Nome, plataforma, vault, item ID, lista de Pessoas internas com acesso, tipo de acesso. Nunca armazena a senha.

**Anexo** — arquivo vinculado a Cliente, Operação, Frente ou Reunião. Supabase Storage.

**SLA** — campos estruturados no cadastro da Operação (tempo de resposta, uptime mínimo, janela de atendimento). Em Frente Tipo C/E, vira régua da saúde.

**Template de Formulário** — referência a formulário Tally + qual entidade alimenta no Delivery (cadastro de Cliente, Briefing técnico, Diagnóstico, Post-mortem de Edição).

**Notificação** — envio pra Discord via webhook. Eventos: status parado +7 dias, decisão pendente vencendo, formulário preenchido, edição entrando em janela crítica, SLA estourado.

### Papéis

- **Admin** — sócios/gestores. Edita Catálogo, vê todo o financeiro, gerencia equipe e papéis.
- **Membro** — restante do time interno. Cria/edita operações onde alocado. Vê financeiro só das próprias.
- **Visualizador externo** — sem login. Acessa via link público com token, somente leitura, view filtrada.

---

## — 05 Telas principais

### Home (operação interna — Membro e Admin)

Cumprimento humano no topo + saudação contextual (quantas Operações ativas, quantas em janela crítica). Tabs em pílula pra alternar entre estados (Em construção, Em operação, Janela crítica, Todas) com contagem ao lado.

Operações exibidas como **cards em grid responsivo** (2-3 colunas), cada card com:
- Pill de linha (Core, Spark X, Studio Y)
- Pill de status (saudável, atenção, SLA em risco, countdown)
- Nome do cliente em display
- Status acionável + "desde Y"
- Footer: avatares do time alocado + ação rápida ou pill de renovação

### Operação aberta

**Hero com fundo oak sólido** + gradiente sage sutil, texto cream. Breadcrumb mono à esquerda, ações (compartilhar, menu) à direita. Pill da linha + status, nome do cliente em display gigante, faixa de meta horizontal (ativa desde, recorrência, responsável, renovação).

Abaixo do hero, **seções em cards individuais** com radius 10px e borda fina:
- Vilões em luta — grid de cards com mini-ilustração, nome, citação, % grande, barra com gradiente oak→sage, severidade inicial
- Frentes — tabela visual com ícone por tipo + título + status + pills de tipo/saúde + avatares
- Briefing vivo — card sage com border-left, texto em display, meta de alteração
- Reuniões e decisões — timeline de cards individuais, com border-left oak (com cliente) ou cinza (interna)
- Financeiro — cards horizontais com ícone, label, valor display, sub mono
- Credenciais — lista de cards com ícone de cadeado, nome, meta Bitwarden, botão "Abrir"

### Link público pro cliente

Header limpo com logo + breadcrumb editorial. **Hero com gradiente oak→escuro**, headline display gigante com palavra-chave destacada em sage ("perdeu *62%* de força"), lede curta, e **bloco lateral de KPI** mostrando quick wins do mês.

Seções:
- Vilões em luta — cards grandes com avatar 120px à esquerda, narrativa no meio, bloco de progresso à direita com % gigante em sage
- Conquistas do mês — grid de cards com ícone sage, data mono, título display, texto, pills de impacto (vilão +X%)
- Próximos movimentos — lista numerada com circles oak, texto display, ETA em pill
- Time — cards quadrados com avatar circular, nome, papel

Zero jargão técnico. Tudo traduzido pra linguagem de negócio.

### Painel do Admin

Cumprimento "Bom dia, *Rafael.*" + data + linha de contexto.

**4 KPIs em cards** com ícone, label, valor display gigante, gráfico preenchido com gradiente sage/oak, pill de delta positivo, texto de contexto.

**3 blocos de ação** lado a lado:
- Atenção imediata (5 itens) com ícone alerta vermelho
- Janela crítica (2 itens) com ícone relógio âmbar
- Renovações 60d (3 itens) com ícone check verde

Cada item: título do problema + sub mono + pill colorida indicando estado.

**2 blocos agregados:**
- Capacidade por especialidade — barras horizontais oak (saudável) / sage (folga) / vermelho (sobrecarga)
- Vilões da carteira — duas colunas (Mais derrotados em sage, Mais resistentes em mute)

**Pipeline em tabela** com header surface + linhas hover, mostrando cliente, linha (pill), responsável, prazo.

### Catálogo (admin)

- Vilões (7 + ilustrações, descrições, cores)
- Quick Wins (tipos + pesos por vilão)
- Tipos de Frente + templates
- Templates de Briefing por linha de produto
- Tipos de Reunião
- Formulários Tally (referência)
- Especialidades

---

## — 06 Design system

### Linguagem visual

**Produto contemporâneo com personalidade DRYOS.** Cards radius 10px com sombra suave. Pills coloridas como sistema de status. Sage como cor de ação principal no light mode (gradientes, conquistas, métricas positivas). Oak como cor de marca e ênfase. Ícones lucide-style funcionais em todo lugar. Hero oak sólido com gradiente sage em telas-chave.

Mesma alma da marca DRYOS — fontes editoriais, paleta oak/cream/sage, em-dashes em labels mono — mas com vocabulário de produto SaaS de qualidade (Linear/Vercel/Stripe). Mais legível em uso intenso, com hierarquia tipográfica calibrada.

**Referência canônica:** `docs/mockup-v2.html`

### Cores

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#FAFAF8` | Background principal |
| `--surface` | `#F2F2EE` | Cards secundários, hover |
| `--card` | `#FFFFFF` | Cards principais |
| `--ink` | `#0A0A0A` | Texto principal, botão primário |
| `--ink-soft` | `#1A1A1A` | Corpo |
| `--oak` | `#1F3A2A` | Cor de marca — labels, ícones, ênfase |
| `--oak-light` | `#4A6A52` | Variação |
| `--oak-50` | `#1F3A2A0F` | Fundo de pill oak, hover |
| `--sage` | `#93B596` | Cor de ação positiva, métricas, conquistas |
| `--sage-bg` | `#93B59624` | Fundo de pill sage |
| `--sage-deep` | `#5C8866` | Texto sage no light mode |
| `--mute` | `#6B6B68` | Texto secundário |
| `--line` | `rgba(26,26,26,0.08)` | Bordas sutis |
| `--critical` | `#B33A3A` | Erro, SLA em risco |
| `--warning` | `#B5751F` | Atenção, prazo apertado |
| `--ok` | `#2F6B3D` | Sucesso, no prazo |

Cada cor funcional (critical, warning, ok, oak, sage) tem versão `-bg` com 10-15% opacity pra pills.

### Tipografia

- **Funnel Display** (600-700) — KPIs principais, hero, nomes de cliente
- **Onest** (400-700) — corpo, títulos de seção (500-600), descrições
- **JetBrains Mono** (400-500) — metadata, datas, contagens, breadcrumbs

### Padrões recorrentes

- **Cards** com radius 10px, border 1px var(--line), shadow-sm sutil. Hover levanta com shadow-md + translateY(-1px).
- **Pills** com radius 99px (full pill), padding 0.2rem 0.55rem, mono 10-11px, cor funcional + bg da cor 10-15% opacity. Variantes: neutra, oak, sage, ok, warning, critical.
- **Hero da Operação** com bg oak + gradiente radial sage sutil no canto. Texto cream. Pill da linha em sage abaixo do breadcrumb.
- **Avatares** circulares 22-32px, bg oak por padrão, font display, iniciais.
- **Ícones** lucide-style, stroke 1.75, currentColor (assume cor do contexto). Sizes sm (14px), md (16px), lg (20px).
- **Reveal animation** (IntersectionObserver, fade + translateY) ao entrar na tela ou trocar de tela.

### Modo escuro

Replica o tratamento da seção Core do site: fundo `#0E0E0C`, texto cream, oak vira sage para contraste, mantém as mesmas pills funcionais. Hero da Operação vira surface escuro com border, não gradient oak.

### Stack visual

- Tailwind CSS + tokens do DS como variáveis
- shadcn/ui customizado (componentes acessíveis baseados em Radix UI)
- Lucide React (stroke 1.75, cor oak por padrão)
- Recharts pros gráficos (cor sage primária, oak secundária, gradientes)
- IntersectionObserver puro pra reveal animations
- Sem framer motion no MVP

---

## — 07 Integrações

### Obrigatórias no MVP

- **Supabase** — Postgres + Auth + Storage + Vault (cofre temporário)
- **Bitwarden Teams** — API pra referenciar credenciais (custo: US$ 4/usuário/mês)
- **Tally** — formulários externos via webhook
- **Discord** — notificações via webhook

### Futuras (v2+)

- **Toggl** — horas trabalhadas por Frente
- **GitHub** — vínculo entre Frente técnica e repositório
- **Cockpit do Lançamento** — embed/deep link nas Edições Tipo D

### Não construir nunca

- Gerenciador de senhas próprio (use Bitwarden)
- Form builder próprio (use Tally)
- Chat interno (use Discord)
- Time tracking próprio (use Toggl)

---

## — 08 Stack técnico

| Camada | Escolha |
|---|---|
| Banco | Supabase Postgres |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Criptografia at-rest | Supabase Vault (apenas como câmara temporária de senhas) |
| Frontend | Next.js 15 (App Router) |
| Hospedagem | Vercel |
| UI base | Tailwind + shadcn/ui customizado |
| Tipografia | Funnel Display + Onest + JetBrains Mono |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Form builder externo | Tally |
| Cofre de senhas externo | Bitwarden Teams |
| Notificação | Discord webhook |
| Ambiente de desenvolvimento | Claude Code |

Sem ORM. Queries diretas via cliente Supabase com types gerados. Sem Claude API no MVP (entra na v2 pra gerar resumo de status, sugerir riscos, redigir handoff).

---

## — 09 Escopo MVP

### Entra no MVP

- CRUD completo: Cliente, Operação, Frente, Pessoa, Alocação
- Tipos de ciclo da Frente (A/B/C/D/E) com state machine
- Domínios da Frente (Infra, Dados Analíticos, Dados Técnicos)
- Briefing vivo com histórico de alterações
- Reuniões com decisões estruturadas e visibilidade interna/compartilhada
- Diagnóstico com vilões detectados e severidade inicial
- Vilões da Operação com progresso (% derrotado)
- Quick Wins com catálogo + impacto em vilões
- Catálogo administrativo (área restrita)
- Credenciais como referência Bitwarden
- Anexos (Supabase Storage)
- SLA estruturado por Operação
- Status acionável obrigatório em formato definido
- Home com cards de Operação
- Operação aberta com 6 seções em cards
- Painel do Admin
- Link público com token (relatório de vilões)
- Tally integrado via webhook
- Discord notificações via webhook
- Papéis: Admin, Membro, Visualizador externo
- Modo escuro replicando tratamento Core

### Não entra no MVP (v2+)

- Heatmap visual de capacidade (dado já coletado, visualização vem depois)
- IA gerando resumo automático de status
- Cofre de senhas próprio (use Bitwarden, sempre)
- Form builder próprio (use Tally)
- Integração Toggl, GitHub
- Embed do Cockpit do Lançamento
- App móvel
- Relatório PDF mensal automático (dado coletado, geração depois)
- Cross-sell automatizado (sinal manual no MVP)
- Multi-idioma (português Brasil apenas)

---

## — 10 Cronograma 5 semanas

| Semana | Entregáveis |
|---|---|
| **— 01** | Setup Claude Code (CLAUDE.md + skills locais) · Schema Supabase + Auth + Bitwarden integration |
| **— 02** | CRUD base — Cliente, Operação, Frente, Pessoa, Alocação · Componentes base do DS v2 |
| **— 03** | Briefing vivo, Reuniões + Decisões, Anexos, SLA, status acionável, link público (esqueleto) |
| **— 04** | Diagnóstico, Vilões, Quick Wins, Catálogo administrativo |
| **— 05** | Painel do Admin + Tally webhook + Discord webhook + polimento + migração de Operações ativas |

---

## — 11 Métricas de sucesso

Adoção em 30 dias após go-live interno:
- 100% das Operações ativas migradas pro Delivery
- 100% das Frentes com status acionável atualizado pelo menos 1x por semana
- Pelo menos 3 clientes acessando o link público regularmente
- Reuniões com cliente registradas no sistema em 80%+ dos casos

Qualidade em 90 dias:
- Zero credencial de cliente armazenada fora do Bitwarden
- Zero briefing em PDF do Drive
- Painel do Admin aberto pelo menos 3x/semana pelo dono

Diferencial em 6 meses:
- Vilões e quick wins entram em pelo menos 50% das propostas comerciais como gancho
- Pelo menos 1 caso de marketing publicado usando dados do painel agregado (vilão mais derrotado do trimestre)

---

## — 12 Riscos e mitigações

**Risco: construir features que ninguém usa.**
Mitigação: cronograma de 5 semanas força foco. Tudo fora do MVP fica catalogado como v2 e só entra depois de provar uso.

**Risco: virar PM genérico ao longo do desenvolvimento.**
Mitigação: princípios `— 01` a `— 11` são contrato. Toda decisão de design passa por eles antes de ir pro código.

**Risco: cofre próprio acabar sendo construído por conveniência.**
Mitigação: Bitwarden Teams contratado antes da semana 1. Sem alternativa.

**Risco: link público virar vazamento de operação interna.**
Mitigação: princípio `— 05` + flag de visibilidade em cada Decisão e Reunião. Default seguro (interna).

**Risco: equipe não adotar status acionável e voltar pra "em andamento".**
Mitigação: o sistema não deixa salvar Frente com status genérico. Validação no banco.

**Risco: catálogo de quick wins ficar vazio ou inflado.**
Mitigação: popular com 8-12 tipos no go-live, baseado no histórico dos últimos meses da DRYOS. Revisar mensalmente nos primeiros 6 meses.

**Risco: criar pills de status novas a cada situação que surge.**
Mitigação: princípio `— 09`. Novo estado tem que caber em uma das 6 cores existentes. Adicionar nova cor é decisão deliberada documentada no Catálogo, não improviso de PR.

---

## — 13 Glossário

**Cliente** — empresa atendida pela DRYOS, com uma ou mais Operações ativas ou históricas.

**Operação** — instância vendida de Core, Spark ou Studio. Carrega o contrato comercial.

**Frente** — fluxo de entrega dentro de uma Operação. Tem tipo de ciclo (A/B/C/D/E) e domínio (Infra, Dados Analíticos, Dados Técnicos).

**Diagnóstico** — análise prévia que identifica vilões em luta no cliente. Origina Operação(ões) e define a régua inicial de progresso dos vilões.

**Vilão** — um dos 7 inimigos da ineficiência operacional, conforme universo de marca da DRYOS.

**Quick Win** — unidade de avanço entregue que reduz a presença de um ou mais vilões na Operação. Mensurável em % derrotado.

**Edição** — uma ocorrência específica de Studio Launch. Cliente Launch tem múltiplas Edições ao longo do tempo.

**Evergreen** — funil contínuo de operação Tipo E. Manutenção e monitoramento de infra 24/7.

**Status acionável** — descrição da situação atual de uma Frente no formato "aguardando X de Y desde Z". Substitui "em andamento", "em revisão" e outros status genéricos.

**Briefing vivo** — documento estruturado que carrega o escopo acordado da Operação. Edita ao longo do tempo, com histórico. Origem de cada alteração é registrada.

**Decisão** — registro perpétuo do que foi resolvido em reunião. Diferente de tarefa. Pode afetar uma ou mais Frentes e alterar o briefing.

**Cofre de Referência** — estrutura no Delivery que aponta para itens no Bitwarden Teams. O Delivery sabe que existe, sabe onde, sabe quem pode ver — nunca toca a senha.

**Link público** — view filtrada e somente leitura da Operação, acessível via token, sem login. Apresenta o relatório de vilões e quick wins em formato de produto premium.

**Pill** — elemento visual canônico de status no DRYOS Delivery. Seis variantes funcionais cobrem todos os estados do sistema.

---

## — 14 Decisões registradas

Decisões deliberadas tomadas durante a conversa de design, registradas pra contexto futuro:

1. **Sistema interno tem natureza diferente do Core.** Core é RevOps pro cliente; Delivery é fábrica pra DRYOS entregar. Não duplicar Core internamente.

2. **Engagement não é monolítico.** Refatorado pra Operação composta de Frentes com ciclos paralelos.

3. **Cofre de senhas usa Bitwarden Teams.** Construir cofre próprio foi descartado por risco de segurança. Vaultwarden self-host fica como alternativa pra v2 se mensalidade incomodar.

4. **Os 7 vilões são universo de marca.** Sem custom por cliente. Novos vilões viram parte permanente.

5. **Catálogo é área administrativa explícita.** Todas as taxonomias da casa moram lá.

6. **Modo claro é padrão; escuro replica seção Core do site.** Não inventar tratamento próprio.

7. **Painel do Admin é dashboard de ação, não dashboard SaaS de vaidade.** Cada bloco existe pra disparar decisão.

8. **Status acionável é validado pelo banco.** Sistema não aceita status genérico.

9. **Tipo D (Launch episódico) e Tipo E (Evergreen) coexistem no mesmo Cliente Launch.** São Frentes diferentes da mesma Operação.

10. **Form builder externo via Tally.** Construir próprio fica explicitamente fora do escopo.

11. **Linguagem visual v2 (produto contemporâneo) é a oficial.** Cards com radius, pills coloridas, ícones funcionais, sage como cor de ação. v1 editorial puro foi descartada como linguagem principal. Mockup `docs/mockup-v2.html` é a referência canônica.

12. **Pills coloridas são sistema canônico de status.** Seis cores cobrem tudo. Novos estados cabem nelas; expansão de cores é decisão deliberada, não improviso.

13. **Ambiente de construção é Claude Code, não Lovable.** Schema modelado antes da UI, types do Supabase, MCP conectado, git versionado.

14. **Hierarquia tipográfica calibrada (princípio 11).** Display gigante só pra hero, KPIs principais e nomes de cliente. Resto da UI usa Onest em pesos 500-600 com tamanhos 14-16px, mais funcional, menos editorial.

---

`— FIM DO DOCUMENTO`

`Última revisão: maio de 2026 · Próxima revisão: ao fim do MVP`
