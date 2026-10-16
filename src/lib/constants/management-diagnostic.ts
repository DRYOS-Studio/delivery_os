export type LevelInfo = {
  n: number;
  name: string;
  desc: string;
};

export const LEVELS: readonly LevelInfo[] = [
  {
    n: 1,
    name: "Inicial",
    desc: "Atividades feitas de forma improvisada, dependentes de pessoas específicas, sem registro nem padrão.",
  },
  {
    n: 2,
    name: "Informal",
    desc: "Existem práticas recorrentes, mas pouco documentadas; resultados variam e há foco em “apagar incêndios”.",
  },
  {
    n: 3,
    name: "Definido",
    desc: "Práticas principais definidas e conhecidas pela equipe, com responsáveis claros na maior parte do tempo.",
  },
  {
    n: 4,
    name: "Gerenciado",
    desc: "Processos medidos por indicadores com metas, acompanhados periodicamente e apoiados por sistemas.",
  },
  {
    n: 5,
    name: "Otimizado",
    desc: "Melhoria contínua, processos integrados e decisões baseadas em dados, com baixa dependência de pessoas específicas.",
  },
] as const;

export type QuestionType = "scale" | "single" | "multi";

export type BaseQuestion = {
  id: string;
  dim: string;
  text: string;
  k: string; // chave curta/indicador
  t: QuestionType;
  noscore?: boolean;
};

export type ScaleQuestion = BaseQuestion & {
  t: "scale";
  low: string;
  high: string;
  rev?: boolean;
};

export type SingleQuestion = BaseQuestion & {
  t: "single";
  opts: readonly (readonly [string, number | null])[];
};

export type MultiQuestion = BaseQuestion & {
  t: "multi";
  opts: readonly (readonly [string, string])[];
};

export type Question = ScaleQuestion | SingleQuestion | MultiQuestion;

export type Dimension = {
  id: string;
  name: string;
  short: string;
  qs: readonly Question[];
};

export const DIMS: readonly Dimension[] = [
  {
    id: "estr",
    name: "Estratégia e governança",
    short: "Estratégia",
    qs: [
      {
        id: "estr_1",
        dim: "estr",
        t: "single",
        text: "A empresa tem metas formais para os próximos 12 meses?",
        k: "Metas anuais",
        opts: [
          ["Não existem metas definidas", 1],
          ["Metas gerais, apenas na cabeça do dono", 2],
          ["Metas definidas, mas pouco acompanhadas", 3],
          ["Metas formais acompanhadas periodicamente", 4],
          ["Planejamento com metas desdobradas por área e revisões periódicas", 5],
        ],
      },
      {
        id: "estr_2",
        dim: "estr",
        t: "single",
        text: "Existe orçamento anual?",
        k: "Orçamento anual",
        opts: [
          ["Não existe", 1],
          ["Existe de forma informal", 2],
          ["Existe, mas não é acompanhado", 3],
          ["Existe e é comparado com o realizado mensalmente", 5],
        ],
      },
      {
        id: "estr_3",
        dim: "estr",
        t: "scale",
        text: "Grau de dependência do dono para o funcionamento diário da empresa",
        k: "Dependência do dono",
        low: "Funciona sem o dono",
        high: "Tudo depende do dono",
        rev: true,
      },
      {
        id: "estr_4",
        dim: "estr",
        t: "single",
        text: "Existem alçadas de aprovação (limites para compras, descontos, contratações)?",
        k: "Alçadas de aprovação",
        opts: [
          ["Não existem", 1],
          ["Existem informalmente", 2],
          ["Formalizadas para alguns temas", 3],
          ["Formalizadas e respeitadas", 5],
        ],
      },
      {
        id: "estr_5",
        dim: "estr",
        t: "single",
        text: "Como acontecem as reuniões de gestão/sócios para decisões importantes?",
        k: "Fóruns de decisão",
        opts: [
          ["Não há reuniões de gestão", 1],
          ["Esporádicas, quando surge um problema", 2],
          ["Periódicas, sem pauta nem registro", 3],
          ["Periódicas, com pauta e registro de decisões", 5],
        ],
      },
    ],
  },
  {
    id: "pess",
    name: "Estrutura e pessoas",
    short: "Pessoas",
    qs: [
      {
        id: "pess_1",
        dim: "pess",
        t: "single",
        text: "Existe organograma?",
        k: "Organograma",
        opts: [
          ["Não existe", 1],
          ["Existe, mas está desatualizado", 2],
          ["Atualizado", 4],
          ["Atualizado, divulgado e com descrições de cargo", 5],
        ],
      },
      {
        id: "pess_2",
        dim: "pess",
        t: "scale",
        text: "Clareza de papéis e responsabilidades (cada pessoa sabe o que é seu)",
        k: "Clareza de papéis",
        low: "Muito confusa",
        high: "Muito clara",
      },
      {
        id: "pess_3",
        dim: "pess",
        t: "single",
        text: "As pessoas-chave (sem as quais a operação para) têm substituto preparado?",
        k: "Substitutos para pessoas-chave",
        opts: [
          ["Nenhuma tem substituto", 1],
          ["Poucas têm", 2],
          ["Cerca de metade", 3],
          ["A maioria tem", 4],
          ["Todas têm", 5],
        ],
      },
      {
        id: "pess_4",
        dim: "pess",
        t: "single",
        text: "Como é a integração (onboarding) de novos colaboradores?",
        k: "Integração de novos colaboradores",
        opts: [
          ["Aprende fazendo", 1],
          ["Acompanhamento informal por um colega", 2],
          ["Roteiro básico de integração", 3],
          ["Programa estruturado com materiais e acompanhamento", 5],
        ],
      },
      {
        id: "pess_5",
        dim: "pess",
        t: "single",
        text: "Como está a rotatividade (turnover) da equipe?",
        k: "Rotatividade",
        opts: [
          ["Alta", 1],
          ["Não é medida", 2],
          ["Moderada", 3],
          ["Baixa", 5],
        ],
      },
    ],
  },
  {
    id: "com",
    name: "Comercial e marketing",
    short: "Comercial",
    qs: [
      {
        id: "com_1",
        dim: "com",
        t: "single",
        text: "Como o funil/pipeline de vendas é controlado?",
        k: "Controle do funil de vendas",
        opts: [
          ["Não é controlado", 1],
          ["Na memória ou em caderno", 2],
          ["Em planilha", 3],
          ["Em CRM", 4],
          ["Em CRM, com metas e previsão de vendas", 5],
        ],
      },
      {
        id: "com_2",
        dim: "com",
        t: "single",
        text: "Existem metas comerciais?",
        k: "Metas comerciais",
        opts: [
          ["Não existem", 1],
          ["Apenas metas gerais", 2],
          ["Por vendedor/canal, sem acompanhamento", 3],
          ["Por vendedor/canal, acompanhadas semanalmente", 5],
        ],
      },
      {
        id: "com_3",
        dim: "com",
        t: "single",
        text: "Como são definidos preços, descontos e condições comerciais?",
        k: "Política de preços e descontos",
        opts: [
          ["Caso a caso, sem critério", 1],
          ["Critérios informais", 2],
          ["Tabela de preços definida", 3],
          ["Política formal com alçadas de desconto", 5],
        ],
      },
      {
        id: "com_4",
        dim: "com",
        t: "scale",
        text: "Quanto as vendas dependem pessoalmente do dono?",
        k: "Dependência do dono nas vendas",
        low: "Nada",
        high: "Totalmente",
        rev: true,
      },
      {
        id: "com_5",
        dim: "com",
        t: "single",
        text: "O retorno das ações de marketing/aquisição é medido?",
        k: "Medição de marketing",
        opts: [
          ["Não é medido", 1],
          ["Eventualmente", 2],
          ["Para alguns canais", 3],
          ["Para todos os canais, com custo por cliente", 5],
        ],
      },
    ],
  },
  {
    id: "atd",
    name: "Atendimento e pós-venda",
    short: "Atendimento",
    qs: [
      {
        id: "atd_1",
        dim: "atd",
        t: "single",
        text: "Como são registradas as solicitações e reclamações dos clientes?",
        k: "Registro de solicitações",
        opts: [
          ["Não são registradas", 1],
          ["Ficam no WhatsApp/e-mail, sem controle", 2],
          ["Planilha de controle", 3],
          ["Sistema ou plataforma de atendimento", 5],
        ],
      },
      {
        id: "atd_2",
        dim: "atd",
        t: "single",
        text: "Existe prazo de resposta definido para o cliente?",
        k: "Prazo de resposta",
        opts: [
          ["Não", 1],
          ["Informal", 2],
          ["Definido", 4],
          ["Definido e medido", 5],
        ],
      },
      {
        id: "atd_3",
        dim: "atd",
        t: "single",
        text: "A satisfação dos clientes é medida?",
        k: "Medição de satisfação",
        opts: [
          ["Não", 1],
          ["Eventualmente", 2],
          ["Periodicamente", 4],
          ["Periodicamente (ex.: NPS) com plano de ação", 5],
        ],
      },
      {
        id: "atd_4",
        dim: "atd",
        t: "scale",
        text: "Reclamações recorrentes são analisadas e tratadas na causa?",
        k: "Tratamento da causa de reclamações",
        low: "Nunca",
        high: "Sempre",
      },
    ],
  },
  {
    id: "ops",
    name: "Operações e entrega",
    short: "Operações",
    qs: [
      {
        id: "ops_1",
        dim: "ops",
        t: "single",
        text: "O fluxo de produção/entrega do serviço está definido e padronizado?",
        k: "Padronização da operação",
        opts: [
          ["Cada um faz do seu jeito", 1],
          ["Há um jeito comum, não documentado", 2],
          ["Etapas principais documentadas", 3],
          ["Documentado e seguido por todos", 4],
          ["Documentado, medido e melhorado continuamente", 5],
        ],
      },
      {
        id: "ops_2",
        dim: "ops",
        t: "single",
        text: "Como é feito o planejamento da produção/agenda de entregas?",
        k: "Planejamento da operação",
        opts: [
          ["Não há planejamento", 1],
          ["Dia a dia, conforme demanda", 2],
          ["Planejamento semanal", 3],
          ["Planejamento com base em capacidade e prioridades", 5],
        ],
      },
      {
        id: "ops_3",
        dim: "ops",
        t: "scale",
        text: "Cumprimento dos prazos prometidos ao cliente",
        k: "Cumprimento de prazos",
        low: "Atrasos frequentes",
        high: "Sempre no prazo",
      },
      {
        id: "ops_4",
        dim: "ops",
        t: "single",
        text: "Como a qualidade é controlada?",
        k: "Controle de qualidade",
        opts: [
          ["Não há controle", 1],
          ["Inspeção eventual", 2],
          ["Checklists de conferência", 3],
          ["Indicadores de qualidade com tratamento de falhas", 5],
        ],
      },
      {
        id: "ops_5",
        dim: "ops",
        t: "single",
        text: "A produtividade e o custo da operação são medidos?",
        k: "Medição de custo e produtividade",
        opts: [
          ["Não", 1],
          ["Apenas estimados", 2],
          ["Parcialmente", 3],
          ["Sim, periodicamente", 5],
        ],
      },
    ],
  },
  {
    id: "sup",
    name: "Compras e estoque",
    short: "Compras",
    qs: [
      {
        id: "sup_1",
        dim: "sup",
        t: "single",
        text: "Como funciona o processo de compras?",
        k: "Processo de compras",
        opts: [
          ["Cada um compra o que precisa", 1],
          ["Centralizado, sem regras", 2],
          ["Centralizado, com cotação", 3],
          ["Política com cotação mínima e alçadas", 5],
        ],
      },
      {
        id: "sup_2",
        dim: "sup",
        t: "single",
        text: "Como o estoque é controlado?",
        k: "Controle de estoque",
        opts: [
          ["Não há controle", 1],
          ["Contagem eventual", 2],
          ["Planilha", 3],
          ["Sistema com inventários periódicos", 5],
          ["Não se aplica (empresa sem estoque)", null],
        ],
      },
      {
        id: "sup_3",
        dim: "sup",
        t: "single",
        text: "Como os fornecedores são selecionados e avaliados?",
        k: "Gestão de fornecedores",
        opts: [
          ["Sem critério", 1],
          ["Informalmente", 2],
          ["Cadastro com critérios básicos", 3],
          ["Homologação e avaliação periódica", 5],
        ],
      },
      {
        id: "sup_4",
        dim: "sup",
        t: "scale",
        text: "Frequência de faltas, perdas ou compras urgentes",
        k: "Faltas e compras urgentes",
        low: "Raramente",
        high: "Muito frequente",
        rev: true,
      },
    ],
  },
  {
    id: "fin",
    name: "Financeiro",
    short: "Financeiro",
    qs: [
      {
        id: "fin_1",
        dim: "fin",
        t: "single",
        text: "Como o fluxo de caixa é controlado?",
        k: "Fluxo de caixa",
        opts: [
          ["Não é controlado", 1],
          ["Pelo extrato bancário", 1],
          ["Planilha só com o realizado", 2],
          ["Planilha com projeção", 4],
          ["Sistema/ERP com projeção", 5],
        ],
      },
      {
        id: "fin_2",
        dim: "fin",
        t: "single",
        text: "Com que frequência é feita a conciliação bancária?",
        k: "Conciliação bancária",
        opts: [
          ["Não é feita", 1],
          ["Mensal", 3],
          ["Semanal", 4],
          ["Diária", 5],
        ],
      },
      {
        id: "fin_3",
        dim: "fin",
        t: "single",
        text: "As finanças da empresa estão separadas das finanças pessoais dos sócios?",
        k: "Separação PF/PJ",
        opts: [
          ["Misturadas", 1],
          ["Parcialmente separadas", 3],
          ["Totalmente separadas", 5],
        ],
      },
      {
        id: "fin_4",
        dim: "fin",
        t: "single",
        text: "Quando os números do mês ficam disponíveis (fechamento)?",
        k: "Fechamento mensal",
        opts: [
          ["Não há fechamento gerencial", 1],
          ["Depois do dia 20 do mês seguinte", 2],
          ["Até o dia 15", 3],
          ["Até o 10º dia útil", 4],
          ["Até o 5º dia útil, com DRE gerencial", 5],
        ],
      },
      {
        id: "fin_5",
        dim: "fin",
        t: "single",
        text: "A empresa conhece sua margem de contribuição?",
        k: "Conhecimento de margens",
        opts: [
          ["Não", 1],
          ["Apenas uma estimativa geral", 2],
          ["Por linha de negócio", 3],
          ["Por produto/serviço", 4],
          ["Por produto/serviço e por cliente", 5],
        ],
      },
      {
        id: "fin_6",
        dim: "fin",
        t: "multi",
        text: "Quais controles financeiros existem?",
        k: "Controles financeiros",
        opts: [
          ["Segregação de funções (quem lança ≠ quem aprova/paga)", "seg"],
          ["Dupla aprovação de pagamentos", "dupla"],
          ["Política de despesas e reembolsos", "desp"],
          ["Acompanhamento da inadimplência", "inad"],
          ["Controle de contratos e vencimentos", "contr"],
        ],
      },
    ],
  },
  {
    id: "rh",
    name: "RH e departamento pessoal",
    short: "RH / DP",
    qs: [
      {
        id: "rh_1",
        dim: "rh",
        t: "single",
        text: "Como funciona o recrutamento e a seleção?",
        k: "Recrutamento e seleção",
        opts: [
          ["Improvisado, quando surge a urgência", 1],
          ["Principalmente por indicação", 2],
          ["Processo básico definido", 3],
          ["Processo estruturado com perfil de cargo", 5],
        ],
      },
      {
        id: "rh_2",
        dim: "rh",
        t: "single",
        text: "Existe avaliação de desempenho?",
        k: "Avaliação de desempenho",
        opts: [
          ["Não", 1],
          ["Informal", 2],
          ["Formal, anual", 4],
          ["Formal, com metas e feedback periódico", 5],
        ],
      },
      {
        id: "rh_3",
        dim: "rh",
        t: "single",
        text: "Como é a qualidade da folha, ponto, férias e benefícios?",
        k: "Qualidade da folha e DP",
        opts: [
          ["Erros frequentes", 1],
          ["Erros eventuais", 3],
          ["Sem erros, com conferência", 5],
        ],
      },
      {
        id: "rh_4",
        dim: "rh",
        t: "single",
        text: "Como avalia o risco de passivo trabalhista?",
        k: "Risco trabalhista",
        opts: [
          ["Há riscos relevantes conhecidos", 1],
          ["Possivelmente há riscos", 2],
          ["Não sei avaliar", 2],
          ["Baixo risco, monitorado", 5],
        ],
      },
      {
        id: "rh_5",
        dim: "rh",
        t: "multi",
        text: "Quais práticas de gestão de pessoas existem?",
        k: "Práticas de gestão de pessoas",
        opts: [
          ["Plano de cargos e salários", "cargos"],
          ["Pesquisa de clima", "clima"],
          ["Remuneração variável com regras claras", "var"],
          ["Plano de treinamentos", "trein"],
        ],
      },
    ],
  },
  {
    id: "doc",
    name: "Documentação e padronização",
    short: "Documentação",
    qs: [
      {
        id: "doc_1",
        dim: "doc",
        t: "single",
        text: "Existem procedimentos documentados (POPs, checklists, manuais)?",
        k: "Procedimentos documentados",
        opts: [
          ["Nenhum", 1],
          ["Poucos e desatualizados", 2],
          ["Os principais estão documentados", 3],
          ["A maioria, atualizada", 4],
          ["Todos, com rotina de revisão", 5],
        ],
      },
      {
        id: "doc_2",
        dim: "doc",
        t: "scale",
        text: "As mesmas atividades são feitas da mesma forma por pessoas diferentes?",
        k: "Padronização das atividades",
        low: "Cada um do seu jeito",
        high: "Totalmente padronizado",
      },
      {
        id: "doc_3",
        dim: "doc",
        t: "single",
        text: "Onde ficam os documentos e modelos?",
        k: "Armazenamento de documentos",
        opts: [
          ["Não há local definido", 1],
          ["Arquivos espalhados", 2],
          ["Pasta organizada em rede/nuvem", 4],
          ["Ferramenta de gestão do conhecimento", 5],
        ],
      },
      {
        id: "doc_4",
        dim: "doc",
        t: "single",
        text: "Quem mantém a documentação atualizada?",
        k: "Responsável pela documentação",
        opts: [
          ["Ninguém", 1],
          ["Informalmente, quando lembram", 3],
          ["Responsável definido e rotina de revisão", 5],
        ],
      },
    ],
  },
  {
    id: "tec",
    name: "Tecnologia e sistemas",
    short: "Tecnologia",
    qs: [
      {
        id: "tec_1",
        dim: "tec",
        t: "single",
        text: "Qual é o principal sistema de gestão?",
        k: "Sistema de gestão",
        opts: [
          ["Não há sistema, só planilhas", 1],
          ["Sistemas isolados por área", 2],
          ["ERP parcialmente utilizado", 3],
          ["ERP bem utilizado", 4],
          ["ERP e CRM integrados", 5],
        ],
      },
      {
        id: "tec_2",
        dim: "tec",
        t: "scale",
        text: "Dependência de planilhas para atividades críticas",
        k: "Dependência de planilhas",
        low: "Baixa",
        high: "Muito alta",
        rev: true,
      },
      {
        id: "tec_3",
        dim: "tec",
        t: "single",
        text: "Os sistemas conversam entre si?",
        k: "Integração de sistemas",
        opts: [
          ["Não há integração", 1],
          ["Exportação/importação manual", 2],
          ["Parcialmente integrados", 3],
          ["Integrados automaticamente", 5],
        ],
      },
      {
        id: "tec_4",
        dim: "tec",
        t: "scale",
        text: "Confiança nos dados e relatórios dos sistemas",
        k: "Confiança nos dados",
        low: "Nenhuma",
        high: "Total",
      },
      {
        id: "tec_5",
        dim: "tec",
        t: "multi",
        text: "Quais práticas de TI e segurança existem?",
        k: "Práticas de TI e segurança",
        opts: [
          ["Backup periódico e testado", "backup"],
          ["Acessos e senhas individuais", "acessos"],
          ["Antivírus/proteção", "av"],
          ["Inventário de equipamentos e licenças", "inv"],
        ],
      },
    ],
  },
  {
    id: "kpi",
    name: "Indicadores e gestão",
    short: "Indicadores",
    qs: [
      {
        id: "kpi_1",
        dim: "kpi",
        t: "single",
        text: "Como os indicadores de desempenho são acompanhados?",
        k: "Acompanhamento de indicadores",
        opts: [
          ["Não são acompanhados", 1],
          ["Alguns números, de cabeça", 2],
          ["Planilhas sem metas", 3],
          ["Relatórios periódicos com metas", 4],
          ["Dashboard automatizado com metas", 5],
        ],
      },
      {
        id: "kpi_2",
        dim: "kpi",
        t: "single",
        text: "Qual é o ritmo das reuniões de resultados?",
        k: "Rotina de reuniões de resultado",
        opts: [
          ["Sem rotina", 1],
          ["Esporádicas", 2],
          ["Mensal", 3],
          ["Semanal (operacional) e mensal (resultados)", 5],
        ],
      },
      {
        id: "kpi_3",
        dim: "kpi",
        t: "scale",
        text: "As reuniões geram decisões com responsáveis e prazos acompanhados?",
        k: "Reuniões com plano de ação",
        low: "Nunca",
        high: "Sempre",
      },
      {
        id: "kpi_4",
        dim: "kpi",
        t: "single",
        text: "Quanto tempo leva para obter uma informação gerencial (ex.: vendas do mês, caixa)?",
        k: "Tempo de acesso à informação",
        opts: [
          ["Dias ou semanas", 1],
          ["Alguns dias", 2],
          ["Algumas horas", 3],
          ["Imediato", 5],
        ],
      },
    ],
  },
  {
    id: "rot",
    name: "Comunicação e rotinas",
    short: "Comunicação",
    qs: [
      {
        id: "rot_1",
        dim: "rot",
        t: "single",
        text: "Como as demandas internas são solicitadas e acompanhadas?",
        k: "Gestão de demandas internas",
        opts: [
          ["WhatsApp/verbal, sem controle", 1],
          ["E-mail e mensagens, sem acompanhamento", 2],
          ["Lista ou planilha de tarefas", 3],
          ["Ferramenta de tarefas com responsáveis e prazos", 5],
        ],
      },
      {
        id: "rot_2",
        dim: "rot",
        t: "scale",
        text: "Eficiência da comunicação entre as áreas",
        k: "Comunicação entre áreas",
        low: "Muito ruim",
        high: "Excelente",
      },
      {
        id: "rot_3",
        dim: "rot",
        t: "single",
        text: "Como as rotinas recorrentes (diárias, semanais, mensais) são garantidas?",
        k: "Rotinas recorrentes",
        opts: [
          ["São esquecidas com frequência", 1],
          ["Dependem da memória das pessoas", 2],
          ["Calendário de rotinas", 3],
          ["Checklists com responsáveis e conferência", 5],
        ],
      },
      {
        id: "rot_4",
        dim: "rot",
        t: "scale",
        text: "Frequência de conflitos ou ruídos entre áreas",
        k: "Conflitos entre áreas",
        low: "Raramente",
        high: "Muito frequente",
        rev: true,
      },
    ],
  },
  {
    id: "risk",
    name: "Riscos, controles e compliance",
    short: "Riscos",
    qs: [
      {
        id: "risk_1",
        dim: "risk",
        t: "multi",
        text: "Quais controles e proteções existem?",
        k: "Controles e proteções",
        opts: [
          ["Seguros adequados (patrimônio, responsabilidade)", "seguro"],
          ["Plano de contingência", "conting"],
          ["Controle de quem acessa contas bancárias", "banco"],
          ["Inventários periódicos de bens/estoque", "invent"],
          ["Auditoria (interna ou externa)", "audit"],
        ],
      },
      {
        id: "risk_2",
        dim: "risk",
        t: "single",
        text: "Obrigações legais (licenças, alvarás, certidões, LGPD) são controladas?",
        k: "Obrigações legais",
        opts: [
          ["Não são controladas", 1],
          ["Tratadas quando surge um problema", 2],
          ["Controle parcial", 3],
          ["Calendário controlado com responsável", 5],
        ],
      },
      {
        id: "risk_3",
        dim: "risk",
        t: "single",
        text: "Como são gerenciados os contratos com clientes e fornecedores?",
        k: "Gestão de contratos",
        opts: [
          ["Não há contratos formais", 1],
          ["Modelos informais", 2],
          ["Contratos sem controle de vencimentos", 3],
          ["Contratos revisados e com vencimentos controlados", 5],
        ],
      },
      {
        id: "risk_4",
        dim: "risk",
        t: "single",
        text: "Os principais riscos do negócio estão mapeados?",
        k: "Mapeamento de riscos",
        opts: [
          ["Não", 1],
          ["Conhecidos informalmente", 2],
          ["Existe uma lista", 3],
          ["Matriz de riscos com responsáveis e ações", 5],
        ],
      },
      {
        id: "risk_5",
        dim: "risk",
        t: "multi",
        noscore: true,
        text: "A empresa já passou por algum destes eventos? (não pontua; gera alertas)",
        k: "Eventos ocorridos",
        opts: [
          ["Fraude ou desvio", "fraude"],
          ["Multa fiscal ou trabalhista", "multa"],
          ["Falta de caixa para compromissos", "caixa"],
          ["Perda de dados", "dados"],
          ["Saída de pessoa-chave com impacto", "saida"],
        ],
      },
    ],
  },
] as const;

export const QMAP: Record<string, Question> = {};
DIMS.forEach((d) =>
  d.qs.forEach((q) => {
    QMAP[q.id] = q;
  }),
);

export const TXT: Record<string, readonly [string, string, string]> = {
  estr: [
    "A direção da empresa ainda depende fortemente da visão e da presença do dono, com metas e regras de decisão pouco formalizadas. Isso tende a concentrar decisões, dificultar a delegação e reduzir a previsibilidade.",
    "Há direcionamento estratégico e alguns instrumentos de gestão, mas o acompanhamento ainda é irregular. O próximo passo é transformar metas em rotina de acompanhamento com responsáveis.",
    "A governança está estruturada, com metas, alçadas e fóruns de decisão. O foco passa a ser desdobrar metas por área e manter a disciplina de revisão.",
  ],
  pess: [
    "Papéis, responsabilidades e substitutos não estão claros, o que gera sobreposição, atividades sem dono e risco de interrupção quando pessoas-chave se ausentam.",
    "A estrutura é razoavelmente conhecida, mas há lacunas em descrições de função, integração de novos colaboradores ou sucessão de pessoas-chave.",
    "A estrutura organizacional é clara e as pessoas sabem o que se espera delas. O desafio é manter o desenvolvimento e a retenção alinhados ao crescimento.",
  ],
  com: [
    "O processo comercial é pouco estruturado e depende de esforço individual, com baixa visibilidade do funil e de regras de preço, o que limita a previsibilidade de receita.",
    "Existe uma base de controle comercial, mas metas, funil e medição de canais ainda não formam uma rotina de gestão consistente.",
    "A área comercial opera com funil, metas e regras claras. O foco é aumentar a previsibilidade e a eficiência dos canais.",
  ],
  atd: [
    "O atendimento é essencialmente reativo e sem registro estruturado, o que impede medir prazos, identificar causas de reclamações e proteger a base de clientes.",
    "Há algum controle do atendimento, mas faltam prazos medidos, análise de causa ou medição sistemática da satisfação.",
    "O atendimento é registrado, medido e usado como fonte de melhoria. O próximo passo é usar esses dados para retenção e expansão da base.",
  ],
  ops: [
    "A operação depende de improviso e do conhecimento de pessoas específicas, com planejamento e controle de qualidade limitados, o que aumenta o risco de atrasos, retrabalho e variação de resultado.",
    "A operação tem um modo de trabalho conhecido, mas a padronização, o planejamento de capacidade e a medição de custo e qualidade ainda são parciais.",
    "A operação é planejada, padronizada e medida. O foco passa a ser produtividade, redução de custos e melhoria contínua.",
  ],
  sup: [
    "Compras e estoques ocorrem sem regras claras, o que expõe a empresa a custos maiores, compras urgentes, faltas ou excessos de material.",
    "Há centralização e algum controle, mas políticas de compra, avaliação de fornecedores ou controle de estoque ainda são incompletos.",
    "Compras e estoques seguem política definida e controle sistemático. O foco é negociação, nível de serviço e capital de giro.",
  ],
  fin: [
    "A gestão financeira é frágil: controle de caixa, conciliação, fechamento e conhecimento de margens são limitados. Isso reduz a capacidade de antecipar problemas de caixa e de decidir com base em números.",
    "As rotinas financeiras básicas existem, mas projeção de caixa, fechamento ágil, margens ou controles internos ainda precisam de reforço.",
    "O financeiro opera com rotinas, projeções e controles consistentes. O foco é análise de rentabilidade, orçamento e apoio à decisão estratégica.",
  ],
  rh: [
    "A gestão de pessoas é reativa, com recrutamento improvisado, pouca avaliação de desempenho e possível exposição a erros de DP ou riscos trabalhistas.",
    "Há rotinas de DP e algumas práticas de gestão de pessoas, mas faltam padronização de seleção, avaliação e desenvolvimento.",
    "RH e DP são estruturados e confiáveis. O foco passa a ser desenvolvimento, engajamento e retenção.",
  ],
  doc: [
    "O conhecimento está concentrado na cabeça das pessoas, com pouca ou nenhuma documentação. Isso dificulta treinar, delegar, garantir qualidade e crescer sem perder controle.",
    "Parte dos processos está documentada, mas a padronização não é uniforme e a atualização depende de iniciativas pontuais.",
    "Os processos estão documentados, acessíveis e atualizados. O desafio é manter a documentação viva e efetivamente usada.",
  ],
  tec: [
    "A empresa depende de planilhas e sistemas isolados, com retrabalho de digitação e baixa confiança nos dados, o que limita a automação e a qualidade da informação.",
    "Existem sistemas de gestão, mas a utilização é parcial, as integrações são limitadas e ainda há dependência relevante de planilhas.",
    "Os sistemas são integrados e confiáveis, suportando a operação e a gestão. O foco é automação e uso analítico dos dados.",
  ],
  kpi: [
    "As decisões são tomadas majoritariamente por intuição, sem indicadores estruturados e sem rotina de reuniões de resultado com plano de ação.",
    "Alguns indicadores são acompanhados, mas sem metas claras, rotina consistente ou agilidade na obtenção das informações.",
    "A empresa acompanha indicadores com metas em rotina estruturada. O foco é aprofundar análises e acelerar a tomada de decisão.",
  ],
  rot: [
    "A informação circula de forma informal e fragmentada, com demandas sem controle e rotinas que dependem da memória, gerando ruídos, esquecimentos e retrabalho.",
    "Há canais e rotinas parcialmente organizados, mas ainda ocorrem perdas de informação e falhas de acompanhamento entre áreas.",
    "Comunicação e rotinas estão organizadas, com demandas rastreáveis e responsáveis claros.",
  ],
  risk: [
    "Riscos e obrigações legais não são acompanhados de forma estruturada e há poucos controles de proteção, o que expõe a empresa a perdas, multas ou interrupções.",
    "Há controles e cuidados pontuais, mas o mapeamento de riscos, contratos e obrigações ainda é parcial.",
    "Riscos, contratos e obrigações são monitorados com responsáveis e controles definidos. O foco é revisão periódica e prevenção.",
  ],
};

export const ACT: Record<
  string,
  {
    qw: readonly string[];
    d90: readonly string[];
    m12: readonly string[];
  }
> = {
  estr: {
    qw: [
      "Listar as decisões que hoje passam pelo dono e definir quais podem ser delegadas",
      "Definir 3 a 5 metas prioritárias para os próximos 12 meses",
    ],
    d90: [
      "Formalizar alçadas de aprovação (compras, descontos, contratações)",
      "Instituir reunião mensal de gestão com pauta e registro de decisões",
    ],
    m12: [
      "Elaborar planejamento estratégico e orçamento anual com desdobramento por área",
    ],
  },
  pess: {
    qw: [
      "Atualizar o organograma e validar responsáveis por área",
      "Identificar pessoas-chave e atividades sem substituto",
    ],
    d90: [
      "Descrever funções principais e montar matriz de responsabilidades (RACI) dos processos críticos",
      "Criar roteiro de integração de novos colaboradores",
    ],
    m12: [
      "Implantar plano de sucessão e desenvolvimento para funções críticas",
    ],
  },
  com: {
    qw: [
      "Registrar todas as oportunidades em um funil único (planilha ou CRM)",
      "Definir tabela de preços e regras de desconto vigentes",
    ],
    d90: [
      "Implantar CRM e rotina semanal de acompanhamento do funil",
      "Definir metas por vendedor/canal e medir a origem dos clientes",
    ],
    m12: [
      "Estruturar previsão de vendas e reduzir a dependência do dono no processo comercial",
    ],
  },
  atd: {
    qw: [
      "Centralizar o registro de solicitações e reclamações em um único controle",
      "Definir prazo padrão de resposta ao cliente",
    ],
    d90: [
      "Analisar as causas das reclamações mais recorrentes e tratar as principais",
      "Implantar pesquisa periódica de satisfação",
    ],
    m12: [
      "Estruturar rotina de pós-venda voltada à retenção e expansão da base",
    ],
  },
  ops: {
    qw: [
      "Mapear o fluxo principal de entrega e identificar os maiores gargalos",
      "Criar checklist de conferência para as etapas críticas",
    ],
    d90: [
      "Documentar e padronizar o processo principal com responsáveis",
      "Implantar planejamento semanal e indicadores de prazo e qualidade",
    ],
    m12: [
      "Medir custo e produtividade da operação e implantar ciclo de melhoria contínua",
    ],
  },
  sup: {
    qw: [
      "Centralizar as solicitações de compra em um único responsável/canal",
      "Levantar itens críticos e fornecedores únicos",
    ],
    d90: [
      "Formalizar política de compras com cotação mínima e alçadas",
      "Implantar controle de estoque com inventário periódico",
    ],
    m12: [
      "Implantar avaliação de fornecedores e gestão de níveis de estoque",
    ],
  },
  fin: {
    qw: [
      "Separar as contas da empresa e dos sócios e definir pró-labore",
      "Montar fluxo de caixa projetado para as próximas 13 semanas",
      "Iniciar conciliação bancária ao menos semanal",
    ],
    d90: [
      "Estruturar fechamento mensal com DRE gerencial até o 10º dia útil",
      "Implantar segregação de funções e dupla aprovação de pagamentos",
    ],
    m12: [
      "Implantar orçamento anual com acompanhamento orçado vs. realizado e análise de margem por produto/cliente",
    ],
  },
  rh: {
    qw: [
      "Revisar a rotina de folha e ponto com checklist de conferência",
      "Levantar possíveis riscos trabalhistas com o contador/jurídico",
    ],
    d90: [
      "Padronizar o processo de recrutamento com perfil de cargo",
      "Implantar ciclo simples de feedback e avaliação",
    ],
    m12: [
      "Estruturar plano de cargos e salários e plano de treinamentos",
    ],
  },
  doc: {
    qw: [
      "Escolher os 3 processos mais críticos e registrar o passo a passo em checklist",
      "Definir um repositório único e organizado para documentos",
    ],
    d90: [
      "Criar padrão de POP e documentar os processos prioritários com seus responsáveis",
    ],
    m12: [
      "Implantar rotina de revisão periódica da documentação e uso nos treinamentos",
    ],
  },
  tec: {
    qw: [
      "Inventariar sistemas, planilhas críticas e acessos",
      "Garantir backup periódico testado e acessos individuais",
    ],
    d90: [
      "Eliminar digitação duplicada nos processos de maior volume",
      "Definir requisitos para ERP/CRM ou para melhor uso do sistema atual",
    ],
    m12: [
      "Implantar ou otimizar ERP/CRM com integrações e automações prioritárias",
    ],
  },
  kpi: {
    qw: [
      "Definir 5 a 8 indicadores-chave com responsável e meta",
      "Instituir reunião mensal de resultados com plano de ação",
    ],
    d90: [
      "Montar painel de indicadores atualizado mensalmente",
      "Implantar reuniões semanais operacionais curtas",
    ],
    m12: [
      "Automatizar o painel de gestão a partir dos sistemas",
    ],
  },
  rot: {
    qw: [
      "Definir um canal oficial para demandas internas",
      "Listar as rotinas recorrentes com responsável e prazo",
    ],
    d90: [
      "Implantar ferramenta de gestão de tarefas com responsáveis e prazos",
      "Criar calendário de rotinas com checklists",
    ],
    m12: [
      "Revisar interfaces entre áreas e acordos de nível de serviço internos",
    ],
  },
  risk: {
    qw: [
      "Levantar licenças, certidões e contratos com vencimentos próximos",
      "Revisar quem tem acesso às contas bancárias",
    ],
    d90: [
      "Montar matriz de riscos com responsáveis e ações",
      "Implantar controle de contratos e obrigações legais",
    ],
    m12: [
      "Implantar ciclo periódico de revisão de controles internos e adequação à LGPD",
    ],
  },
};

export type ProfileField = {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "textarea";
  opts?: readonly string[];
  def?: string;
  full?: boolean;
};

export const PROFILE_FIELDS: readonly ProfileField[] = [
  { id: "empresa", label: "Nome da empresa", type: "text" },
  {
    id: "setor",
    label: "Setor de atuação",
    type: "select",
    opts: [
      "",
      "Indústria",
      "Comércio / varejo",
      "Distribuição / atacado",
      "Serviços",
      "Tecnologia / software",
      "Saúde",
      "Educação",
      "Construção",
      "Agronegócio",
      "Outro",
    ],
  },
  {
    id: "pessoas",
    label: "Número de colaboradores",
    type: "select",
    opts: [
      "",
      "Até 9",
      "10 a 49",
      "50 a 99",
      "100 a 249",
      "250 a 499",
      "500 ou mais",
    ],
  },
  {
    id: "faturamento",
    label: "Faixa de faturamento anual (opcional)",
    type: "select",
    opts: [
      "",
      "Até R$ 360 mil",
      "R$ 360 mil a R$ 4,8 mi",
      "R$ 4,8 mi a R$ 30 mi",
      "R$ 30 mi a R$ 100 mi",
      "Acima de R$ 100 mi",
      "Prefere não informar",
    ],
  },
  { id: "respondente", label: "Respondente", type: "text" },
  { id: "cargo", label: "Cargo / função", type: "text" },
  { id: "data", label: "Data", type: "date" },
  {
    id: "consultor",
    label: "Consultor",
    type: "text",
    def: "Rafael Carvalho · dryos studio",
  },
  {
    id: "dores",
    label: "Principais dores ou problemas atuais",
    type: "textarea",
    full: true,
  },
  {
    id: "objetivos",
    label: "Objetivos para o projeto (o que precisa estar diferente)",
    type: "textarea",
    full: true,
  },
] as const;

export type FlagRule = {
  dim: string;
  sev: "alta" | "média";
  t: string;
  d: string;
  test: (
    ans: (id: string) => unknown,
    has: (id: string, v: string) => boolean,
    multiAnswered: (id: string) => boolean,
  ) => boolean;
};

export const FLAGS_RULES: readonly FlagRule[] = [
  {
    dim: "estr",
    sev: "alta",
    t: "Alta dependência do dono",
    d: "O funcionamento diário depende fortemente do dono, o que cria gargalo decisório e risco de continuidade.",
    test: (ans) => {
      const v = ans("estr_3");
      return typeof v === "number" && v >= 4;
    },
  },
  {
    dim: "com",
    sev: "média",
    t: "Vendas concentradas no dono",
    d: "As vendas dependem pessoalmente do dono, limitando escala e previsibilidade comercial.",
    test: (ans) => {
      const v = ans("com_4");
      return typeof v === "number" && v >= 4;
    },
  },
  {
    dim: "pess",
    sev: "alta",
    t: "Pessoas-chave sem substituto",
    d: "Poucas ou nenhuma das pessoas-chave têm substituto preparado (risco de pessoa-chave).",
    test: (ans) => {
      const v = ans("pess_3");
      return typeof v === "number" && v <= 1;
    },
  },
  {
    dim: "pess",
    sev: "média",
    t: "Rotatividade alta",
    d: "A rotatividade foi indicada como alta, o que eleva custos de reposição e perda de conhecimento.",
    test: (ans) => ans("pess_5") === 0,
  },
  {
    dim: "fin",
    sev: "alta",
    t: "Caixa sem projeção",
    d: "O caixa não é controlado ou é acompanhado apenas pelo extrato bancário, sem visão antecipada de necessidades.",
    test: (ans) => {
      const v = ans("fin_1");
      return typeof v === "number" && v <= 1;
    },
  },
  {
    dim: "fin",
    sev: "alta",
    t: "Finanças da empresa misturadas às dos sócios",
    d: "A falta de separação entre PF e PJ distorce os resultados e dificulta o controle.",
    test: (ans) => ans("fin_3") === 0,
  },
  {
    dim: "fin",
    sev: "média",
    t: "Sem conciliação bancária",
    d: "A conciliação bancária não é realizada, aumentando o risco de erros e lançamentos não identificados.",
    test: (ans) => ans("fin_2") === 0,
  },
  {
    dim: "fin",
    sev: "alta",
    t: "Ausência de segregação de funções",
    d: "Não foi indicada segregação entre quem lança e quem aprova/paga, o que aumenta o risco de erros e fraudes.",
    test: (_, has, multi) => multi("fin_6") && !has("fin_6", "seg"),
  },
  {
    dim: "fin",
    sev: "média",
    t: "Margens desconhecidas",
    d: "A empresa não conhece suas margens, o que dificulta decisões de preço, mix e custos.",
    test: (ans) => ans("fin_5") === 0,
  },
  {
    dim: "tec",
    sev: "alta",
    t: "Sem backup testado",
    d: "Não foi indicado backup periódico e testado, o que expõe a empresa à perda de dados.",
    test: (_, has, multi) => multi("tec_5") && !has("tec_5", "backup"),
  },
  {
    dim: "tec",
    sev: "média",
    t: "Dados pouco confiáveis e dependência de planilhas",
    d: "Alta dependência de planilhas combinada com baixa confiança nos dados compromete as decisões.",
    test: (ans) => {
      const v2 = ans("tec_2");
      const v4 = ans("tec_4");
      return (
        typeof v2 === "number" &&
        v2 >= 4 &&
        typeof v4 === "number" &&
        v4 <= 2
      );
    },
  },
  {
    dim: "kpi",
    sev: "média",
    t: "Decisões sem indicadores",
    d: "Indicadores não são acompanhados de forma estruturada; decisões tendem a ser tomadas por intuição.",
    test: (ans) => {
      const v = ans("kpi_1");
      return typeof v === "number" && v <= 1;
    },
  },
  {
    dim: "doc",
    sev: "média",
    t: "Conhecimento não documentado",
    d: "Não há procedimentos documentados; o conhecimento está concentrado nas pessoas.",
    test: (ans) => ans("doc_1") === 0,
  },
  {
    dim: "atd",
    sev: "média",
    t: "Reclamações sem registro nem tratamento",
    d: "Solicitações não são registradas de forma controlada e as causas das reclamações raramente são tratadas.",
    test: (ans) => {
      const v1 = ans("atd_1");
      const v4 = ans("atd_4");
      return (
        typeof v1 === "number" &&
        v1 <= 1 &&
        typeof v4 === "number" &&
        v4 <= 2
      );
    },
  },
  {
    dim: "ops",
    sev: "média",
    t: "Atrasos frequentes nas entregas",
    d: "O cumprimento de prazos foi avaliado como baixo, com impacto direto na satisfação dos clientes.",
    test: (ans) => {
      const v = ans("ops_3");
      return typeof v === "number" && v <= 2;
    },
  },
  {
    dim: "rh",
    sev: "alta",
    t: "Risco trabalhista relevante",
    d: "Foram indicados riscos trabalhistas relevantes conhecidos.",
    test: (ans) => ans("rh_4") === 0,
  },
  {
    dim: "risk",
    sev: "alta",
    t: "Obrigações legais sem controle",
    d: "Licenças, certidões e obrigações (incluindo LGPD) não são controladas ou só são tratadas quando surge um problema.",
    test: (ans) => {
      const v = ans("risk_2");
      return typeof v === "number" && v <= 1;
    },
  },
  {
    dim: "risk",
    sev: "média",
    t: "Acesso bancário sem controle",
    d: "Não foi indicado controle de quem acessa as contas bancárias.",
    test: (_, has, multi) => multi("risk_1") && !has("risk_1", "banco"),
  },
  {
    dim: "risk",
    sev: "alta",
    t: "Histórico de fraude ou desvio",
    d: "A empresa já sofreu fraude ou desvio; recomenda-se priorizar controles internos.",
    test: (_, has) => has("risk_5", "fraude"),
  },
  {
    dim: "risk",
    sev: "alta",
    t: "Histórico de falta de caixa",
    d: "A empresa já enfrentou falta de caixa para seus compromissos.",
    test: (_, has) => has("risk_5", "caixa"),
  },
  {
    dim: "risk",
    sev: "média",
    t: "Histórico de multas",
    d: "A empresa já recebeu multa fiscal ou trabalhista.",
    test: (_, has) => has("risk_5", "multa"),
  },
  {
    dim: "risk",
    sev: "média",
    t: "Histórico de perda de dados",
    d: "A empresa já perdeu dados; reforçar backup e segurança da informação.",
    test: (_, has) => has("risk_5", "dados"),
  },
  {
    dim: "risk",
    sev: "média",
    t: "Impacto pela saída de pessoa-chave",
    d: "A saída de uma pessoa-chave já impactou a operação.",
    test: (_, has) => has("risk_5", "saida"),
  },
] as const;
