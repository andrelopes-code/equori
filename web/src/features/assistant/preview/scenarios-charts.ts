import type { Scenario } from "@/features/assistant/preview/scenario";
import type {
  AssistantView,
  ViewPlot,
  ViewValue,
} from "@/features/assistant/view/view-types";

// Charts the model describes over a read with form chart (answer views design, section 11).
const brl = (amount: number): ViewValue => ({
  money: { amount, currency: "BRL" },
});
const month = (m: string): ViewValue => ({ month: m });
const text = (t: string): ViewValue => ({ text: t });

const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
];

const year = { from: "2026-01-01", to: "2026-11-30" };

export const chartScenarios: Scenario[] = [
  {
    id: "chart-income",
    form: "chart",
    note: "get_account_history flows → show chart, bars by month with the average",
    handled: true,
    question:
      "Monte um gráfico dos meus rendimentos nos meses deste ano, conta Algum dinheiro",
    answer:
      "Outubro foi o mês mais forte; fevereiro e julho ficaram sem entradas.",
    views: [
      chart({
        id: "v-chart-income",
        title: "Entradas de Algum dinheiro em 2026",
        window: year,
        head: ["assistantView.chart.period", "Entradas"],
        rows: zip(months, [
          [312000],
          [0],
          [298050],
          [301200],
          [355000],
          [287400],
          [0],
          [310990],
          [322000],
          [498700],
          [140000],
        ]),
        plot: {
          label: 0,
          series: [{ column: 1, kind: "bar", tone: "success" }],
          marks: [{ kind: "average", column: 1, value: brl(256849) }],
        },
        verdict: total(2825340, "2026-10", 498700),
        count: 23,
      }),
    ],
  },
  {
    id: "chart-flows",
    form: "chart",
    note: "get_account_history flows → show chart, two series and a line",
    handled: true,
    question: "Entradas e saídas da conta corrente por mês, em colunas",
    answer: "As saídas passaram das entradas só em junho.",
    views: [
      chart({
        id: "v-chart-flows",
        title: "Entradas e saídas da conta corrente",
        window: { from: "2026-06-01", to: "2026-11-30" },
        head: ["assistantView.chart.period", "Entradas", "Saídas"],
        rows: zip(months.slice(5), [
          [820000, 905300],
          [820000, 611250],
          [845000, 702980],
          [820000, 688410],
          [910000, 745020],
          [820000, 401330],
        ]),
        plot: {
          label: 0,
          series: [
            { column: 1, kind: "bar", tone: "success" },
            { column: 2, kind: "line", tone: "danger", curve: "monotone" },
          ],
          marks: [],
        },
        verdict: total(5035000, "2026-10", 910000),
        count: 214,
      }),
    ],
  },
  {
    id: "chart-split",
    form: "chart",
    note: "search_transactions → show chart, split by category, stacked",
    handled: true,
    question: "Como se dividiram meus gastos por categoria nos últimos meses?",
    answer: "Moradia pesa todo mês; restaurantes cresceram em outubro.",
    views: [
      chart({
        id: "v-chart-split",
        title: "Gastos por categoria",
        window: { from: "2026-07-01", to: "2026-10-31" },
        head: [
          "assistantView.chart.period",
          "Moradia",
          "Mercado",
          "Restaurantes",
          "assistantView.chart.others",
        ],
        rows: zip(months.slice(6, 10), [
          [320000, 142000, 51000, 98000],
          [320000, 151300, 63800, 87200],
          [320000, 139900, 58400, 120400],
          [320000, 149700, 86430, 104300],
        ]),
        plot: {
          label: 0,
          series: [1, 2, 3, 4].map((column) => ({
            column,
            kind: "bar" as const,
            stack: true,
          })),
          marks: [],
        },
        verdict: total(2532430, "2026-10", 660430),
        count: 187,
      }),
    ],
  },
  {
    id: "chart-pie",
    form: "chart",
    note: "get_category_totals → show chart, a pie by category",
    handled: true,
    question: "Mostre em pizza onde foi meu dinheiro em outubro",
    answer: "Moradia sozinha leva quase dois quintos.",
    views: [
      chart({
        id: "v-chart-pie",
        title: "Gastos de outubro",
        window: { from: "2026-10-01", to: "2026-10-31" },
        head: ["assistantView.chart.item", "Total"],
        rows: [
          [text("Moradia"), brl(320000)],
          [text("Mercado"), brl(149700)],
          [text("Restaurantes"), brl(86430)],
          [text("Transporte"), brl(41275)],
          [{ text: "assistantView.chart.rest", count: 8 }, brl(221700)],
        ],
        plot: {
          label: 0,
          series: [{ column: 1, kind: "pie" }],
          marks: [],
        },
        verdict: {
          key: "assistantView.chart.verdict_total",
          params: {
            total: brl(819105),
            label: text("Moradia"),
            top: brl(320000),
          },
        },
        count: 96,
      }),
    ],
  },
  {
    id: "chart-axes",
    form: "chart",
    note: "get_account_history balances → show chart, step line and a count on the end axis",
    handled: true,
    question: "Saldo da reserva no fim de cada mês e quantos lançamentos teve",
    answer: "O saldo subiu todo mês, com menos lançamentos a partir de agosto.",
    views: [
      chart({
        id: "v-chart-axes",
        title: "Reserva: saldo e lançamentos",
        window: { from: "2026-05-01", to: "2026-10-31" },
        head: ["assistantView.chart.period", "Saldo", "Lançamentos"],
        rows: months
          .slice(4, 10)
          .map((m, i) => [
            month(m),
            brl([1820000, 1905400, 1991000, 2088700, 2160300, 2251900][i] ?? 0),
            { count: [14, 12, 15, 6, 5, 7][i] ?? 0 },
          ]),
        plot: {
          label: 0,
          series: [
            { column: 1, kind: "line", curve: "step" },
            { column: 2, kind: "bar", axis: "end", tone: "neutral" },
          ],
          marks: [],
        },
        verdict: {
          key: "assistantView.chart.verdict_range",
          params: { low: brl(1820000), high: brl(2251900) },
        },
        count: 59,
      }),
    ],
  },
  {
    id: "chart-payees",
    form: "chart",
    note: "search_transactions → show chart, payees as horizontal bars",
    handled: true,
    question: "Com quem mais gastei no cartão este ano?",
    answer: "O supermercado do bairro lidera com folga.",
    views: [
      chart({
        id: "v-chart-payees",
        title: "Maiores favorecidos do cartão em 2026",
        window: year,
        head: ["assistantView.chart.item", "Gasto"],
        rows: [
          [text("Supermercado Bom Preço"), brl(1284050)],
          [text("Posto Avenida"), brl(512300)],
          [text("Farmácia Central"), brl(301870)],
          [text("Restaurante Sabor da Casa"), brl(254400)],
          [text("Livraria Página"), brl(98900)],
        ],
        plot: {
          label: 0,
          orientation: "horizontal",
          series: [{ column: 1, kind: "bar" }],
          marks: [],
        },
        verdict: {
          key: "assistantView.chart.verdict_total",
          params: {
            total: brl(2451520),
            label: text("Supermercado Bom Preço"),
            top: brl(1284050),
          },
        },
        count: 148,
      }),
    ],
  },
];

interface ChartInput {
  id: string;
  title: string;
  window: { from: string; to: string };
  head: string[];
  rows: ViewValue[][];
  plot: ViewPlot;
  verdict: AssistantView["payload"]["verdict"];
  count: number;
}

function chart(input: ChartInput): AssistantView {
  return {
    id: input.id,
    form: "chart",
    payload: {
      title: {
        key: "assistantView.chart.title",
        params: { title: text(input.title) },
      },
      window: input.window,
      verdict: input.verdict,
      prov: {
        key: "assistantView.chart.prov",
        params: { count: { count: input.count } },
      },
      next: [],
      rows: { head: input.head, rows: input.rows },
      plot: input.plot,
      data: {},
    },
  };
}

function zip(labels: string[], values: number[][]): ViewValue[][] {
  return labels.map((m, i) => [month(m), ...(values[i] ?? []).map(brl)]);
}

function total(
  amount: number,
  label: string,
  top: number,
): AssistantView["payload"]["verdict"] {
  return {
    key: "assistantView.chart.verdict_total",
    params: { total: brl(amount), label: month(label), top: brl(top) },
  };
}
