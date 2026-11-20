import type { Scenario } from "@/features/assistant/preview/scenario";

// The views the server builds, with the figures of the approved mock (answer views design).
const brl = (amount: number) => ({ amount, currency: "BRL" });

const october = { from: "2026-10-01", to: "2026-10-31" };

export const viewScenarios: Scenario[] = [
  {
    id: "view-ranking",
    form: "ranking",
    note: "get_category_totals → show ranking",
    handled: true,
    question: "Onde mais gastei em outubro?",
    answer: "A maior parte foi para moradia; mercado vem em seguida.",
    views: [
      {
        id: "v-ranking",
        form: "ranking",
        payload: {
          title: { key: "assistantView.ranking.title" },
          window: october,
          verdict: {
            key: "assistantView.ranking.verdict",
            params: {
              name: { text: "Moradia" },
              share: { bp: 3907 },
              total: { money: brl(819105) },
            },
          },
          prov: {
            key: "assistantView.prov.categories",
            params: { count: { count: 12 } },
          },
          open: { screen: "/reports", params: october },
          next: ["Comparar com setembro", "Mostrar o mapa do ano"],
          rows: {
            head: [
              "assistantView.col.category",
              "assistantView.col.total",
              "assistantView.col.share",
            ],
            rows: [
              [{ text: "Moradia" }, { money: brl(320000) }, { bp: 3907 }],
              [{ text: "Mercado" }, { money: brl(149700) }, { bp: 1828 }],
              [{ text: "Restaurantes" }, { money: brl(86430) }, { bp: 1055 }],
              [{ text: "Transporte" }, { money: brl(41275) }, { bp: 504 }],
              [{ text: "Assinaturas" }, { money: brl(28940) }, { bp: 353 }],
              [
                { text: "assistantView.ranking.rest", count: 7 },
                { money: brl(192760) },
                { bp: 2353 },
              ],
            ],
          },
          data: {
            total: brl(819105),
            items: [
              {
                account_id: "c1",
                name: "Moradia",
                amount: brl(320000),
                share_bp: 3907,
                rank: 1,
              },
              {
                account_id: "c2",
                name: "Mercado",
                amount: brl(149700),
                share_bp: 1828,
                rank: 2,
              },
              {
                account_id: "c3",
                name: "Restaurantes",
                amount: brl(86430),
                share_bp: 1055,
                rank: 3,
              },
              {
                account_id: "c4",
                name: "Transporte",
                amount: brl(41275),
                share_bp: 504,
                rank: 4,
              },
              {
                account_id: "c5",
                name: "Assinaturas",
                amount: brl(28940),
                share_bp: 353,
                rank: 5,
              },
            ],
            rest: { count: 7, amount: brl(192760), share_bp: 2353 },
          },
        },
      },
    ],
  },
  {
    id: "view-compare",
    form: "compare",
    note: "get_category_totals × 2 → show compare",
    handled: true,
    question: "Gastei mais em outubro ou em setembro?",
    answer: "Outubro foi mais caro, puxado pelo mercado.",
    views: [
      {
        id: "v-compare",
        form: "compare",
        payload: {
          title: { key: "assistantView.compare.title" },
          window: { from: "2026-09-01", to: "2026-10-31" },
          verdict: {
            key: "assistantView.compare.verdict_more",
            params: {
              amount: { money: brl(36325) },
              name: { text: "Mercado" },
              name_amount: { money: brl(31240) },
            },
          },
          prov: {
            key: "assistantView.prov.categories",
            params: { count: { count: 4 } },
          },
          open: { screen: "/reports", params: october },
          next: ["O que mais subiu no mercado?"],
          rows: {
            head: [
              "assistantView.col.category",
              "assistantView.col.before",
              "assistantView.col.after",
            ],
            rows: [
              [
                { text: "Mercado" },
                { money: brl(118460) },
                { money: brl(149700) },
              ],
              [
                { text: "Restaurantes" },
                { money: brl(61020) },
                { money: brl(86430) },
              ],
              [
                { text: "Transporte" },
                { money: brl(39800) },
                { money: brl(41275) },
              ],
              [{ text: "Lazer" }, { money: brl(52000) }, { money: brl(30200) }],
            ],
          },
          data: {
            periods: [{ from: "2026-09-01", to: "2026-09-30" }, october],
            items: [
              {
                account_id: "c2",
                name: "Mercado",
                before: brl(118460),
                after: brl(149700),
              },
              {
                account_id: "c3",
                name: "Restaurantes",
                before: brl(61020),
                after: brl(86430),
              },
              {
                account_id: "c4",
                name: "Transporte",
                before: brl(39800),
                after: brl(41275),
              },
              {
                account_id: "c6",
                name: "Lazer",
                before: brl(52000),
                after: brl(30200),
              },
            ],
            difference: brl(36325),
          },
        },
      },
    ],
  },
];

const budgetItem = (
  id: string,
  name: string,
  spent: number,
  limit: number,
) => ({
  budget_id: id,
  name,
  spent: brl(spent),
  limit: brl(limit),
  over: brl(Math.max(spent - limit, 0)),
});

viewScenarios.push({
  id: "view-budget",
  form: "budget",
  note: "get_budgets_and_goals → show budget",
  handled: true,
  question: "Como estou no orçamento de novembro?",
  answer: "Dois orçamentos passaram do limite; transporte e lazer têm folga.",
  views: [
    {
      id: "v-budget",
      form: "budget",
      payload: {
        title: { key: "assistantView.budget.title" },
        window: { from: "2026-11-01", to: "2026-11-30" },
        verdict: {
          key: "assistantView.budget.verdict_over",
          params: {
            count: { count: 2 },
            name: { text: "Restaurantes" },
            amount: { money: brl(11890) },
          },
        },
        open: {
          screen: "/planning",
          params: { tab: "budgets", month: "2026-11" },
        },
        next: ["Onde cortar em restaurantes?"],
        rows: {
          head: [
            "assistantView.col.category",
            "assistantView.col.spent",
            "assistantView.col.limit",
          ],
          rows: [
            [
              { text: "Mercado" },
              { money: brl(151230) },
              { money: brl(140000) },
            ],
            [
              { text: "Restaurantes" },
              { money: brl(71890) },
              { money: brl(60000) },
            ],
            [
              { text: "Transporte" },
              { money: brl(21240) },
              { money: brl(50000) },
            ],
            [{ text: "Lazer" }, { money: brl(9500) }, { money: brl(40000) }],
          ],
        },
        data: {
          month: "2026-11",
          day: 19,
          days: 30,
          items: [
            budgetItem("b1", "Mercado", 151230, 140000),
            budgetItem("b2", "Restaurantes", 71890, 60000),
            budgetItem("b3", "Transporte", 21240, 50000),
            budgetItem("b4", "Lazer", 9500, 40000),
          ],
        },
      },
    },
  ],
});
