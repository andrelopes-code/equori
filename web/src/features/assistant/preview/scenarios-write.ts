import {
  brl,
  day,
  expired,
  proposal,
  text,
} from "@/features/assistant/preview/preview-proposal";
import type { Scenario } from "@/features/assistant/preview/scenario";

// Proposals whose action has a body of its own (bodies/body-kind.ts).
export const writeHandled: Scenario[] = [
  {
    id: "record",
    form: "Registrar transação",
    note: "record_transaction",
    handled: true,
    question: "Gastei 86,90 no Outback ontem no cartão Itaú",
    steps: ["list_accounts", "record_transaction"],
    answer: "Confirme o lançamento abaixo.",
    proposals: [
      proposal("rec", "record_transaction", {
        action: "record_transaction",
        changes: [
          { field: "date", after: day("2026-11-18") },
          { field: "description", after: text("Outback") },
          { field: "amount", after: brl("-86.90") },
          { field: "account", after: text("Cartão Itaú") },
          { field: "category", after: text("Restaurantes") },
        ],
      }),
    ],
  },
  {
    id: "categorize",
    form: "Categorizar",
    note: "categorize_transactions",
    handled: true,
    question: "Coloca todas as compras do iFood em Restaurantes",
    steps: ["search_transactions", "categorize_transactions"],
    answer: "Encontrei 3 compras do iFood fora de Restaurantes.",
    proposals: [
      proposal("cat", "categorize_transactions", {
        action: "categorize_transactions",
        changes: [{ field: "category", after: text("Restaurantes") }],
        items: [
          {
            description: "iFood *Madero",
            date: "2026-11-02",
            amount: brl("-64.90"),
            category: "Mercado",
          },
          {
            description: "iFood *Sushi Leblon",
            date: "2026-11-09",
            amount: brl("-112.00"),
          },
          {
            description: "iFood *Padaria",
            date: "2026-11-14",
            amount: brl("-28.50"),
            category: "Mercado",
          },
        ],
      }),
    ],
  },
  {
    id: "rule-dependent",
    form: "Regra + operação dependente",
    note: "manage_rule.create_rule, e categorize esperando por ela",
    handled: true,
    question: "Daqui pra frente, Uber é sempre Transporte",
    steps: ["list_rules", "manage_rule", "categorize_transactions"],
    answer:
      "A regra vale para o futuro; as 2 corridas antigas também podem ser movidas.",
    proposals: [
      proposal("rule", "manage_rule", {
        action: "manage_rule.create_rule",
        changes: [
          { field: "rule", after: text("Uber") },
          { field: "pattern", after: text("UBER*TRIP*") },
          { field: "category", after: text("Transporte") },
        ],
      }),
      proposal(
        "rule-cat",
        "categorize_transactions",
        {
          action: "categorize_transactions",
          changes: [{ field: "category", after: text("Transporte") }],
          items: [
            {
              description: "UBER *TRIP",
              date: "2026-11-03",
              amount: brl("-23.40"),
              category: "Lazer",
            },
            {
              description: "UBER *TRIP",
              date: "2026-11-11",
              amount: brl("-31.10"),
            },
          ],
        },
        { status: "waiting", waiting_for: ["rule"] },
      ),
    ],
  },
  {
    id: "void",
    form: "Anular (irreversível)",
    note: "void_transaction; começa desmarcada",
    handled: true,
    question: "Esse Outback de 389 entrou duplicado, apaga um",
    steps: ["search_transactions", "void_transaction"],
    answer: "Há dois lançamentos iguais em 12/10. Anular o segundo:",
    proposals: [
      proposal("void", "void_transaction", {
        action: "void_transaction",
        target: "Outback",
        destructive: true,
        changes: [{ field: "reason", after: text("Duplicado") }],
        items: [
          {
            description: "Outback",
            date: "2026-10-12",
            amount: brl("-389.00"),
            account: "Cartão Itaú",
          },
        ],
      }),
    ],
  },
  {
    id: "schedule",
    form: "Agendamento",
    note: "manage_schedule.create",
    handled: true,
    question: "Agenda o aluguel de 3.200 todo dia 5",
    steps: ["list_schedules", "manage_schedule"],
    answer: "Agendamento mensal a partir de dezembro:",
    proposals: [
      proposal("sch", "manage_schedule", {
        action: "manage_schedule.create",
        changes: [
          { field: "description", after: text("Aluguel") },
          { field: "amount", after: brl("-3200.00") },
          { field: "account", after: text("Itaú") },
          { field: "date", after: day("2026-12-05") },
        ],
        recurrence: { frequency: "monthly", interval: 1, day: 5 },
      }),
    ],
  },
  {
    id: "investment",
    form: "Compra de ativo",
    note: "record_investment.buy",
    handled: true,
    question: "Comprei 100 PETR4 a 34,20 na XP",
    steps: ["get_portfolio", "record_investment"],
    answer: "Confirme a compra:",
    proposals: [
      proposal("inv", "record_investment", {
        action: "record_investment.buy",
        changes: [
          { field: "instrument", after: text("PETR4") },
          { field: "quantity", after: text("100") },
          { field: "price", after: text("R$ 34,20") },
          { field: "amount", after: brl("3420.00") },
          { field: "account", after: text("XP Investimentos") },
        ],
      }),
    ],
  },
  {
    id: "limit",
    form: "Limite de crédito",
    note: "manage_card.set_credit_limit",
    handled: true,
    question: "O Itaú aumentou meu limite para 12 mil",
    steps: ["get_account_details", "manage_card"],
    answer: "Atualizar o limite do cartão:",
    proposals: [
      proposal("lim", "manage_card", {
        action: "manage_card.set_credit_limit",
        target: "Cartão Itaú",
        changes: [
          { field: "limit", before: brl("8000.00"), after: brl("12000.00") },
        ],
      }),
    ],
  },
  {
    id: "payment",
    form: "Pagamento de fatura",
    note: "settle_statement.pay",
    handled: true,
    question: "Paga a fatura de novembro do Itaú com a conta corrente",
    steps: ["get_statement", "settle_statement"],
    answer: "A fatura fecha em R$ 2.918,38.",
    proposals: [
      proposal("pay", "settle_statement", {
        action: "settle_statement.pay",
        changes: [
          { field: "statement", after: text("2026-11") },
          { field: "amount", after: brl("2918.38") },
          { field: "account", after: text("Itaú") },
          { field: "date", after: day("2026-11-25") },
        ],
      }),
    ],
  },
  {
    id: "file",
    form: "Importar extrato",
    note: "import_statement_file",
    handled: true,
    question: "Importa esse extrato no Nubank",
    steps: ["list_accounts", "import_statement_file"],
    answer: "O arquivo tem 48 lançamentos de outubro.",
    proposals: [
      proposal("file", "import_statement_file", {
        action: "import_statement_file",
        changes: [
          { field: "source", after: text("nubank-outubro.ofx") },
          { field: "account", after: text("Nubank") },
          { field: "count", after: text("48") },
          { field: "from", after: day("2026-10-01") },
          { field: "until", after: day("2026-10-31") },
        ],
      }),
    ],
  },
];

// Proposals whose action has no body: the card draws the list of fields.
export const writeFallback: Scenario[] = [
  {
    id: "card-purchase",
    form: "Compra parcelada no cartão",
    note: "handle_card_purchase",
    handled: false,
    question: "Comprei uma geladeira de 3.024 em 12x no cartão Itaú",
    steps: ["get_account_details", "handle_card_purchase"],
    answer: "Confirme a compra parcelada:",
    proposals: [
      proposal("cp", "handle_card_purchase", {
        action: "handle_card_purchase",
        changes: [
          { field: "description", after: text("Geladeira Brastemp") },
          { field: "amount", after: brl("-3024.00") },
          { field: "installments", after: text("12") },
          { field: "installment_amount", after: brl("-252.00") },
          { field: "account", after: text("Cartão Itaú") },
          { field: "first_statement", after: text("2026-12") },
        ],
      }),
    ],
  },
  {
    id: "change",
    form: "Corrigir transação",
    note: "change_transaction",
    handled: false,
    question: "O mercado de ontem foi 212,40, não 21,24",
    steps: ["search_transactions", "change_transaction"],
    answer: "Corrigir o valor do lançamento:",
    proposals: [
      proposal("chg", "change_transaction", {
        action: "change_transaction",
        target: "Pão de Açúcar",
        changes: [
          { field: "amount", before: brl("-21.24"), after: brl("-212.40") },
        ],
      }),
    ],
  },
  {
    id: "reconcile",
    form: "Conferir saldo",
    note: "reconcile_account",
    handled: false,
    question: "O app do banco diz 2.100,00 na conta Itaú",
    steps: ["get_balances", "reconcile_account"],
    answer: "Há uma diferença de R$ 65,90 entre o banco e o equori.",
    proposals: [
      proposal("rcn", "reconcile_account", {
        action: "reconcile_account",
        target: "Itaú",
        changes: [
          { field: "balance", before: brl("2034.10"), after: brl("2100.00") },
          { field: "adjustment", after: brl("65.90") },
          { field: "date", after: day("2026-11-19") },
        ],
      }),
    ],
  },
  {
    id: "goal",
    form: "Meta de economia",
    note: "manage_budget_or_goal.create_goal",
    handled: false,
    question: "Quero juntar 15 mil para viajar até julho",
    steps: ["get_budgets_and_goals", "manage_budget_or_goal"],
    answer: "Isso pede R$ 1.875,00 por mês a partir de dezembro.",
    proposals: [
      proposal("goal", "manage_budget_or_goal", {
        action: "manage_budget_or_goal.create_goal",
        changes: [
          { field: "name", after: text("Viagem Japão") },
          { field: "target", after: brl("15000.00") },
          { field: "date", after: day("2027-07-31") },
          { field: "monthly", after: brl("1875.00") },
        ],
      }),
    ],
  },
  {
    id: "budget",
    form: "Orçamento mensal",
    note: "manage_budget_or_goal.create_budget",
    handled: false,
    question: "Limita restaurante a 600 por mês",
    steps: ["get_budgets_and_goals", "manage_budget_or_goal"],
    answer: "A média dos últimos 3 meses foi R$ 742,00.",
    proposals: [
      proposal("bud", "manage_budget_or_goal", {
        action: "manage_budget_or_goal.create_budget",
        changes: [
          { field: "category", after: text("Restaurantes") },
          { field: "amount", after: brl("600.00") },
          { field: "from", after: day("2026-12-01") },
        ],
      }),
    ],
  },
  {
    id: "fixed-income",
    form: "Aplicação em renda fixa",
    note: "record_fixed_income",
    handled: false,
    question: "Apliquei 10 mil num CDB do Inter a 110% do CDI até 2028",
    steps: ["get_portfolio", "record_fixed_income"],
    answer: "Confirme a aplicação:",
    proposals: [
      proposal("fi", "record_fixed_income", {
        action: "record_fixed_income",
        changes: [
          { field: "instrument", after: text("CDB Banco Inter") },
          { field: "amount", after: brl("10000.00") },
          { field: "rate", after: text("110% do CDI") },
          { field: "maturity", after: day("2028-11-19") },
          { field: "account", after: text("Inter") },
        ],
      }),
    ],
  },
  {
    id: "transfer",
    form: "Transferência de custódia",
    note: "transfer_custody",
    handled: false,
    question: "Transferi minhas 200 ITSA4 da Clear para a XP",
    steps: ["get_holding_lots", "transfer_custody"],
    answer: "O preço médio de R$ 9,84 segue com as ações.",
    proposals: [
      proposal("tc", "transfer_custody", {
        action: "transfer_custody",
        changes: [
          { field: "instrument", after: text("ITSA4") },
          { field: "quantity", after: text("200") },
          { field: "account", before: text("Clear"), after: text("XP") },
          { field: "date", after: day("2026-11-19") },
        ],
      }),
    ],
  },
  {
    id: "occurrence",
    form: "Realizar ocorrência",
    note: "manage_occurrence.realize",
    handled: false,
    question: "A conta de luz veio 187,30, pode lançar",
    steps: ["list_schedules", "manage_occurrence"],
    answer: "O agendamento previa R$ 160,00.",
    proposals: [
      proposal("occ", "manage_occurrence", {
        action: "manage_occurrence.realize",
        target: "Conta de luz — novembro",
        changes: [
          { field: "amount", before: brl("-160.00"), after: brl("-187.30") },
          { field: "date", after: day("2026-11-19") },
        ],
      }),
    ],
  },
];

// Results and decided states that replace a proposal.
export const writeOutcomes: Scenario[] = [
  {
    id: "receipt",
    form: "Recibo",
    note: "record_transaction executada",
    handled: true,
    question: "Gastei 42,90 no almoço hoje no Nubank",
    answer: "Lançado.",
    proposals: [
      proposal(
        "rcpt",
        "record_transaction",
        {
          action: "record_transaction",
          changes: [
            { field: "date", after: day("2026-11-19") },
            { field: "description", after: text("Almoço") },
            { field: "amount", after: brl("-42.90") },
            { field: "account", after: text("Nubank") },
            { field: "category", after: text("Restaurantes") },
          ],
        },
        {
          status: "executed",
          result: { transaction_id: "preview" },
          decided_at: "2026-11-19T10:01:00Z",
          undoable: true,
        },
      ),
    ],
  },
  {
    id: "executed",
    form: "Resultado executado",
    note: "Escrita executada sem recibo",
    handled: true,
    question: "Cria a regra do Spotify em Assinaturas",
    answer: "Regra criada.",
    proposals: [
      proposal(
        "done",
        "manage_rule",
        {
          action: "manage_rule.create_rule",
          changes: [
            { field: "rule", after: text("Spotify") },
            { field: "pattern", after: text("SPOTIFY*") },
            { field: "category", after: text("Assinaturas") },
          ],
        },
        {
          status: "executed",
          result: { rule_id: "preview" },
          decided_at: "2026-11-19T10:01:00Z",
          undoable: true,
        },
      ),
    ],
  },
  {
    id: "undone",
    form: "Resultado desfeito",
    note: "Escrita executada e desfeita",
    handled: true,
    question: "Cria o orçamento de Restaurantes",
    answer: "Orçamento criado.",
    proposals: [
      proposal(
        "undone",
        "manage_budget_or_goal",
        {
          action: "manage_budget_or_goal.create_budget",
          target: "Restaurantes",
          changes: [{ field: "amount", after: brl("700.00") }],
        },
        {
          status: "executed",
          result: { budget_id: "preview" },
          decided_at: "2026-11-19T10:01:00Z",
          undone_by: "preview-undo",
        },
      ),
    ],
  },
  {
    id: "failed",
    form: "Falha",
    note: "O motivo vem do servidor",
    handled: true,
    question: "Paga a fatura de outubro",
    answer: "Tentei pagar a fatura.",
    proposals: [
      proposal(
        "fail",
        "settle_statement",
        {
          action: "settle_statement.pay",
          changes: [
            { field: "statement", after: text("2026-10") },
            { field: "amount", after: brl("3760.00") },
            { field: "account", after: text("Itaú") },
          ],
        },
        {
          status: "failed",
          result: { detail: "A fatura de outubro já está paga." },
        },
      ),
    ],
  },
  {
    id: "expired",
    form: "Expirada",
    note: "Prazo de 15 minutos passou",
    handled: true,
    question: "Lança 25 de estacionamento",
    answer: "Confirme o lançamento.",
    proposals: [
      proposal(
        "exp",
        "record_transaction",
        {
          action: "record_transaction",
          changes: [
            { field: "description", after: text("Estacionamento") },
            { field: "amount", after: brl("-25.00") },
            { field: "account", after: text("Nubank") },
          ],
        },
        expired(),
      ),
    ],
  },
  {
    id: "rejected",
    form: "Recusada",
    note: "Pessoa recusou a proposta",
    handled: true,
    question: "Move o Netflix para Lazer",
    answer: "Mover 1 transação.",
    proposals: [
      proposal(
        "rej",
        "categorize_transactions",
        {
          action: "categorize_transactions",
          changes: [{ field: "category", after: text("Lazer") }],
          items: [
            {
              description: "Netflix",
              date: "2026-11-07",
              amount: brl("-55.90"),
              category: "Assinaturas",
            },
          ],
        },
        { status: "rejected", decided_at: "2026-11-19T10:01:00Z" },
      ),
    ],
  },
];

// Turns that end without a full answer.
export const turnStates: Scenario[] = [
  {
    id: "step-limit",
    form: "Limite de passos",
    note: "outcome step_limit",
    handled: true,
    question: "Revisa todas as transações do ano e acha duplicadas",
    steps: [
      "search_transactions",
      "search_transactions",
      "search_transactions",
      "get_transaction",
    ],
    outcome: "step_limit",
    answer: "Até agora encontrei 2 pares suspeitos em março e julho.",
  },
  {
    id: "turn-failed",
    form: "Turno falhou",
    note: "outcome failed",
    handled: true,
    question: "Quanto gastei em 2025?",
    outcome: "failed",
    answer: "",
  },
  {
    id: "turn-canceled",
    form: "Turno cancelado",
    note: "outcome canceled",
    handled: true,
    question: "Lista todas as transações de 2024",
    outcome: "canceled",
    answer: "",
  },
];
