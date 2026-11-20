import type { Scenario } from "@/features/assistant/preview/scenario";

// Views as the server builds them from the mock's figures (payloads written by the builders).
export const builtScenarios: Scenario[] = [
  {
    id: "built-changes",
    form: "changes",
    note: "get_category_totals × 2 → show changes",
    handled: true,
    question: "O que mudou de setembro para outubro?",
    answer: "O aumento veio quase todo de mercado e restaurantes.",
    views: [
      {
        id: "v-changes",
        form: "changes",
        payload: {
          title: { key: "assistantView.changes.title" },
          window: { from: "2026-09-01", to: "2026-10-31" },
          verdict: {
            key: "assistantView.changes.verdict_more",
            params: {
              amount: { money: { amount: 45495, currency: "BRL" } },
              first: { text: "Mercado" },
              second: { text: "Restaurantes" },
              top: { money: { amount: 56650, currency: "BRL" } },
            },
          },
          prov: {
            key: "assistantView.prov.categories",
            params: { count: { count: 6 } },
          },
          open: {
            screen: "/reports",
            params: { from: "2026-10-01", to: "2026-10-31" },
          },
          next: [],
          rows: {
            head: ["assistantView.col.category", "assistantView.col.change"],
            rows: [
              [
                { text: "Mercado" },
                { money: { amount: 31240, currency: "BRL" } },
              ],
              [
                { text: "Restaurantes" },
                { money: { amount: 25410, currency: "BRL" } },
              ],
              [
                { text: "Viagens" },
                { money: { amount: 18800, currency: "BRL" } },
              ],
              [
                { text: "Transporte" },
                { money: { amount: 1475, currency: "BRL" } },
              ],
              [
                { text: "Saúde" },
                { money: { amount: -9630, currency: "BRL" } },
              ],
              [
                { text: "Lazer" },
                { money: { amount: -21800, currency: "BRL" } },
              ],
            ],
          },
          data: {
            periods: [
              { from: "2026-09-01", to: "2026-09-30" },
              { from: "2026-10-01", to: "2026-10-31" },
            ],
            items: [
              {
                account_id: "c0",
                name: "Mercado",
                delta: { amount: 31240, currency: "BRL" },
              },
              {
                account_id: "c1",
                name: "Restaurantes",
                delta: { amount: 25410, currency: "BRL" },
              },
              {
                account_id: "c2",
                name: "Viagens",
                delta: { amount: 18800, currency: "BRL" },
              },
              {
                account_id: "c3",
                name: "Transporte",
                delta: { amount: 1475, currency: "BRL" },
              },
              {
                account_id: "c4",
                name: "Saúde",
                delta: { amount: -9630, currency: "BRL" },
              },
              {
                account_id: "c5",
                name: "Lazer",
                delta: { amount: -21800, currency: "BRL" },
              },
            ],
            difference: { amount: 45495, currency: "BRL" },
          },
        },
      },
    ],
  },
  {
    id: "built-treemap",
    form: "treemap",
    note: "get_category_totals → show treemap",
    handled: true,
    question: "Como se divide meu gasto do ano?",
    answer: "Moradia e educação dominam o ano.",
    views: [
      {
        id: "v-treemap",
        form: "treemap",
        payload: {
          title: { key: "assistantView.treemap.title" },
          window: { from: "2026-01-01", to: "2026-11-30" },
          verdict: {
            key: "assistantView.treemap.verdict",
            params: {
              first: { text: "Moradia" },
              second: { text: "Educação" },
              share: { bp: 5498 },
              total: { money: { amount: 10412000, currency: "BRL" } },
            },
          },
          prov: {
            key: "assistantView.prov.categories",
            params: { count: { count: 11 } },
          },
          open: {
            screen: "/reports",
            params: { from: "2026-01-01", to: "2026-11-30" },
          },
          next: [],
          rows: {
            head: [
              "assistantView.col.category",
              "assistantView.col.total",
              "assistantView.col.share",
            ],
            rows: [
              [
                { text: "Moradia" },
                { money: { amount: 3520000, currency: "BRL" } },
                { bp: 3381 },
              ],
              [
                { text: "Educação" },
                { money: { amount: 2204000, currency: "BRL" } },
                { bp: 2117 },
              ],
              [
                { text: "Mercado" },
                { money: { amount: 1643000, currency: "BRL" } },
                { bp: 1578 },
              ],
              [
                { text: "Restaurantes" },
                { money: { amount: 912000, currency: "BRL" } },
                { bp: 876 },
              ],
              [
                { text: "Saúde" },
                { money: { amount: 624000, currency: "BRL" } },
                { bp: 599 },
              ],
              [
                { text: "Transporte" },
                { money: { amount: 487000, currency: "BRL" } },
                { bp: 468 },
              ],
              [
                { text: "Assinaturas" },
                { money: { amount: 318000, currency: "BRL" } },
                { bp: 305 },
              ],
              [
                { text: "assistantView.ranking.rest", count: 4 },
                { money: { amount: 704000, currency: "BRL" } },
                { bp: 676 },
              ],
            ],
          },
          data: {
            total: { amount: 10412000, currency: "BRL" },
            cells: [
              {
                account_id: "c0",
                name: "Moradia",
                amount: { amount: 3520000, currency: "BRL" },
                share_bp: 3381,
                rest: false,
                x: 0,
                y: 0,
                w: 33.80714560122935,
                h: 100,
              },
              {
                account_id: "c1",
                name: "Educação",
                amount: { amount: 2204000, currency: "BRL" },
                share_bp: 2117,
                rest: false,
                x: 33.80714560122935,
                y: 0,
                w: 36.94775259316173,
                h: 57.291395892903566,
              },
              {
                account_id: "c2",
                name: "Mercado",
                amount: { amount: 1643000, currency: "BRL" },
                share_bp: 1578,
                rest: false,
                x: 33.80714560122935,
                y: 57.291395892903566,
                w: 36.94775259316173,
                h: 42.70860410709644,
              },
              {
                account_id: "c3",
                name: "Restaurantes",
                amount: { amount: 912000, currency: "BRL" },
                share_bp: 876,
                rest: false,
                x: 70.75489819439107,
                y: 0,
                w: 17.364279197080297,
                h: 50.44334975369458,
              },
              {
                account_id: "c4",
                name: "Saúde",
                amount: { amount: 624000, currency: "BRL" },
                share_bp: 599,
                rest: false,
                x: 88.11917739147137,
                y: 0,
                w: 11.880822608528623,
                h: 50.44334975369458,
              },
              {
                account_id: "c5",
                name: "Transporte",
                amount: { amount: 487000, currency: "BRL" },
                share_bp: 468,
                rest: false,
                x: 70.75489819439107,
                y: 50.44334975369458,
                w: 15.601263720023315,
                h: 29.98023437260961,
              },
              {
                account_id: "c6",
                name: "Assinaturas",
                amount: { amount: 318000, currency: "BRL" },
                share_bp: 305,
                rest: false,
                x: 70.75489819439107,
                y: 80.42358412630418,
                w: 15.601263720023315,
                h: 19.576415873695804,
              },
              {
                name: "assistantView.ranking.rest",
                amount: { amount: 704000, currency: "BRL" },
                share_bp: 676,
                rest: true,
                count: 4,
                x: 86.35616191441439,
                y: 50.44334975369458,
                w: 13.643838085585605,
                h: 49.55665024630542,
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-series",
    form: "series",
    note: "get_financial_indicators → show series",
    handled: true,
    question: "Como meus gastos andaram no ano?",
    answer: "Outubro pesou mais que o normal.",
    views: [
      {
        id: "v-series",
        form: "series",
        payload: {
          title: { key: "assistantView.series.title" },
          window: { from: "2025-12-01", to: "2026-11-30" },
          verdict: {
            key: "assistantView.series.verdict",
            params: {
              average: { money: { amount: 755646, currency: "BRL" } },
              month: { month: "2026-10" },
              rank: { count: 3 },
            },
          },
          prov: {
            key: "assistantView.prov.months",
            params: { count: { count: 11 } },
          },
          open: { screen: "/reports" },
          next: [],
          rows: {
            head: ["assistantView.col.month", "assistantView.col.spent"],
            rows: [
              [
                { month: "2025-12" },
                { money: { amount: 985000, currency: "BRL" } },
              ],
              [
                { month: "2026-01" },
                { money: { amount: 712000, currency: "BRL" } },
              ],
              [
                { month: "2026-02" },
                { money: { amount: 698000, currency: "BRL" } },
              ],
              [
                { month: "2026-03" },
                { money: { amount: 745000, currency: "BRL" } },
              ],
              [
                { month: "2026-04" },
                { money: { amount: 689000, currency: "BRL" } },
              ],
              [
                { month: "2026-05" },
                { money: { amount: 721000, currency: "BRL" } },
              ],
              [
                { month: "2026-06" },
                { money: { amount: 842000, currency: "BRL" } },
              ],
              [
                { month: "2026-07" },
                { money: { amount: 705000, currency: "BRL" } },
              ],
              [
                { month: "2026-08" },
                { money: { amount: 664000, currency: "BRL" } },
              ],
              [
                { month: "2026-09" },
                { money: { amount: 732000, currency: "BRL" } },
              ],
              [
                { month: "2026-10" },
                { money: { amount: 819105, currency: "BRL" } },
              ],
              [
                { month: "2026-11" },
                { money: { amount: 511500, currency: "BRL" } },
              ],
            ],
          },
          data: {
            months: [
              {
                month: "2025-12",
                amount: { amount: 985000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-01",
                amount: { amount: 712000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-02",
                amount: { amount: 698000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-03",
                amount: { amount: 745000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-04",
                amount: { amount: 689000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-05",
                amount: { amount: 721000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-06",
                amount: { amount: 842000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-07",
                amount: { amount: 705000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-08",
                amount: { amount: 664000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-09",
                amount: { amount: 732000, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-10",
                amount: { amount: 819105, currency: "BRL" },
                partial: false,
              },
              {
                month: "2026-11",
                amount: { amount: 511500, currency: "BRL" },
                partial: true,
              },
            ],
            average: { amount: 755646, currency: "BRL" },
            focus: "2026-10",
          },
        },
      },
    ],
  },
  {
    id: "built-waterfall",
    form: "waterfall",
    note: "get_financial_indicators → show waterfall",
    handled: true,
    question: "Quanto sobrou em outubro?",
    answer: "O mês fechou positivo.",
    views: [
      {
        id: "v-waterfall",
        form: "waterfall",
        payload: {
          title: { key: "assistantView.waterfall.title" },
          window: { from: "2026-10-01", to: "2026-10-31" },
          verdict: {
            key: "assistantView.waterfall.verdict_saved",
            params: {
              amount: { money: { amount: 420895, currency: "BRL" } },
              expense: { money: { amount: 819105, currency: "BRL" } },
              income: { money: { amount: 1240000, currency: "BRL" } },
            },
          },
          open: { screen: "/reports" },
          next: [],
          rows: {
            head: ["assistantView.col.step", "assistantView.col.value"],
            rows: [
              [
                { text: "assistantView.waterfall.start" },
                { money: { amount: 482000, currency: "BRL" } },
              ],
              [
                { text: "assistantView.waterfall.income" },
                { money: { amount: 1240000, currency: "BRL" } },
              ],
              [
                { text: "assistantView.waterfall.expense" },
                { money: { amount: -819105, currency: "BRL" } },
              ],
              [
                { text: "assistantView.waterfall.other" },
                { money: { amount: 0, currency: "BRL" } },
              ],
              [
                { text: "assistantView.waterfall.end" },
                { money: { amount: 902895, currency: "BRL" } },
              ],
            ],
          },
          data: {
            month: "2026-10",
            steps: [
              { kind: "start", amount: { amount: 482000, currency: "BRL" } },
              { kind: "income", amount: { amount: 1240000, currency: "BRL" } },
              { kind: "expense", amount: { amount: -819105, currency: "BRL" } },
              { kind: "other", amount: { amount: 0, currency: "BRL" } },
              { kind: "end", amount: { amount: 902895, currency: "BRL" } },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-indicators",
    form: "indicators",
    note: "get_financial_indicators → show indicators",
    handled: true,
    question: "Como foi meu mês em números?",
    answer: "A poupança subiu; a reserva ainda está abaixo de 6 meses.",
    views: [
      {
        id: "v-indicators",
        form: "indicators",
        payload: {
          title: { key: "assistantView.indicators.title" },
          window: { from: "2026-10-01", to: "2026-10-31" },
          verdict: {
            key: "assistantView.indicators.verdict",
            params: { liquidity: { bp: 42000 }, savings: { bp: 3394 } },
          },
          prov: {
            key: "assistantView.prov.months",
            params: { count: { count: 11 } },
          },
          open: { screen: "/reports" },
          next: [],
          rows: {
            head: ["assistantView.col.indicator", "assistantView.col.value"],
            rows: [
              [{ text: "assistantView.indicators.savings" }, { bp: 3394 }],
              [{ text: "assistantView.indicators.committed" }, { bp: 4900 }],
              [{ text: "assistantView.indicators.liquidity" }, { bp: 42000 }],
            ],
          },
          data: {
            month: "2026-10",
            tiles: [
              {
                kind: "savings",
                bp: 3394,
                series: [
                  1792, 4067, 4183, 3792, 4258, 3992, 2983, 4125, 4467, 3900,
                  3394,
                ],
              },
              {
                kind: "committed",
                bp: 4900,
                series: [
                  5200, 5100, 5000, 5200, 4900, 5000, 4800, 4900, 4800, 4700,
                  4900,
                ],
              },
              {
                kind: "liquidity",
                bp: 42000,
                series: [
                  20000, 22000, 24000, 26000, 28000, 30000, 32000, 34000, 36000,
                  38000, 42000,
                ],
              },
            ],
          },
        },
      },
    ],
  },
];
