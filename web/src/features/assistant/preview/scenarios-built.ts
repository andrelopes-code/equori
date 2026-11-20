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
  {
    id: "built-txs",
    form: "txs",
    note: "search_transactions → show txs",
    handled: true,
    question: "Quanto gastei no iFood este mês?",
    answer: "Cinco pedidos no mês.",
    views: [
      {
        id: "v-txs",
        form: "txs",
        payload: {
          title: { key: "assistantView.txs.title" },
          window: { from: "2026-11-02", to: "2026-11-14" },
          verdict: {
            key: "assistantView.txs.verdict",
            params: {
              average: { money: { amount: -5794, currency: "BRL" } },
              count: { count: 5 },
              total: { money: { amount: -28970, currency: "BRL" } },
            },
          },
          open: { screen: "/transactions" },
          next: [],
          rows: {
            head: [
              "assistantView.col.date",
              "assistantView.col.name",
              "assistantView.col.amount",
            ],
            rows: [
              [
                { date: "2026-11-14" },
                { text: "iFood *Padaria" },
                { money: { amount: -2850, currency: "BRL" } },
              ],
              [
                { date: "2026-11-12" },
                { text: "iFood *Burger King" },
                { money: { amount: -4590, currency: "BRL" } },
              ],
              [
                { date: "2026-11-09" },
                { text: "iFood *Sushi Leblon" },
                { money: { amount: -11200, currency: "BRL" } },
              ],
              [
                { date: "2026-11-06" },
                { text: "iFood *Pizzaria Bráz" },
                { money: { amount: -3840, currency: "BRL" } },
              ],
              [
                { date: "2026-11-02" },
                { text: "iFood *Madero" },
                { money: { amount: -6490, currency: "BRL" } },
              ],
            ],
          },
          data: {
            count: 5,
            total: { amount: -28970, currency: "BRL" },
            average: { amount: -5794, currency: "BRL" },
            items: [
              {
                id: "t1",
                date: "2026-11-14",
                name: "iFood *Padaria",
                account: "Nubank",
                category: "Restaurantes",
                amount: { amount: -2850, currency: "BRL" },
              },
              {
                id: "t2",
                date: "2026-11-12",
                name: "iFood *Burger King",
                account: "Nubank",
                category: "Restaurantes",
                amount: { amount: -4590, currency: "BRL" },
              },
              {
                id: "t3",
                date: "2026-11-09",
                name: "iFood *Sushi Leblon",
                account: "Cartão Itaú",
                category: "Restaurantes",
                amount: { amount: -11200, currency: "BRL" },
              },
              {
                id: "t4",
                date: "2026-11-06",
                name: "iFood *Pizzaria Bráz",
                account: "Nubank",
                category: "Restaurantes",
                amount: { amount: -3840, currency: "BRL" },
              },
              {
                id: "t5",
                date: "2026-11-02",
                name: "iFood *Madero",
                account: "Cartão Itaú",
                category: "Restaurantes",
                amount: { amount: -6490, currency: "BRL" },
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-outliers",
    form: "outliers",
    note: "search_transactions → show outliers",
    handled: true,
    question: "Teve alguma compra fora do normal?",
    answer: "Uma compra de eletrônicos foge do padrão.",
    views: [
      {
        id: "v-outliers",
        form: "outliers",
        payload: {
          title: { key: "assistantView.outliers.title" },
          window: {},
          verdict: {
            key: "assistantView.outliers.verdict",
            params: {
              amount: { money: { amount: 239900, currency: "BRL" } },
              category: { text: "Eletrônicos" },
              name: { text: "Fast Shop" },
              ratio: { times: 107098 },
            },
          },
          open: { screen: "/transactions" },
          next: [],
          rows: {
            head: [
              "assistantView.col.category",
              "assistantView.col.median",
              "assistantView.col.largest",
            ],
            rows: [
              [
                { text: "Eletrônicos" },
                { money: { amount: 22400, currency: "BRL" } },
                { money: { amount: 239900, currency: "BRL" } },
              ],
              [
                { text: "Mercado" },
                { money: { amount: 10495, currency: "BRL" } },
                { money: { amount: 30170, currency: "BRL" } },
              ],
              [
                { text: "Restaurantes" },
                { money: { amount: 5200, currency: "BRL" } },
                { money: { amount: 14500, currency: "BRL" } },
              ],
            ],
          },
          data: {
            rows: [
              {
                category: "Eletrônicos",
                median: { amount: 22400, currency: "BRL" },
                points: [
                  {
                    id: "e0",
                    name: "Loja 0",
                    amount: { amount: 8990, currency: "BRL" },
                    ratio_bp: 4013,
                  },
                  {
                    id: "e1",
                    name: "Loja 1",
                    amount: { amount: 12900, currency: "BRL" },
                    ratio_bp: 5759,
                  },
                  {
                    id: "e2",
                    name: "Loja 2",
                    amount: { amount: 19900, currency: "BRL" },
                    ratio_bp: 8884,
                  },
                  {
                    id: "e3",
                    name: "Loja 3",
                    amount: { amount: 24900, currency: "BRL" },
                    ratio_bp: 11116,
                  },
                  {
                    id: "e4",
                    name: "Loja 4",
                    amount: { amount: 34900, currency: "BRL" },
                    ratio_bp: 15580,
                  },
                  {
                    id: "e5",
                    name: "Fast Shop",
                    amount: { amount: 239900, currency: "BRL" },
                    ratio_bp: 107098,
                  },
                ],
                outlier: {
                  id: "e5",
                  name: "Fast Shop",
                  amount: { amount: 239900, currency: "BRL" },
                  ratio_bp: 107098,
                },
              },
              {
                category: "Mercado",
                median: { amount: 10495, currency: "BRL" },
                points: [
                  {
                    id: "m0",
                    name: "Mercado 0",
                    amount: { amount: 1890, currency: "BRL" },
                    ratio_bp: 1801,
                  },
                  {
                    id: "m1",
                    name: "Mercado 1",
                    amount: { amount: 3240, currency: "BRL" },
                    ratio_bp: 3087,
                  },
                  {
                    id: "m2",
                    name: "Mercado 2",
                    amount: { amount: 4510, currency: "BRL" },
                    ratio_bp: 4297,
                  },
                  {
                    id: "m3",
                    name: "Mercado 3",
                    amount: { amount: 6200, currency: "BRL" },
                    ratio_bp: 5908,
                  },
                  {
                    id: "m4",
                    name: "Mercado 4",
                    amount: { amount: 8830, currency: "BRL" },
                    ratio_bp: 8414,
                  },
                  {
                    id: "m5",
                    name: "Mercado 5",
                    amount: { amount: 9750, currency: "BRL" },
                    ratio_bp: 9290,
                  },
                  {
                    id: "m6",
                    name: "Mercado 6",
                    amount: { amount: 11240, currency: "BRL" },
                    ratio_bp: 10710,
                  },
                  {
                    id: "m7",
                    name: "Mercado 7",
                    amount: { amount: 13400, currency: "BRL" },
                    ratio_bp: 12768,
                  },
                  {
                    id: "m8",
                    name: "Mercado 8",
                    amount: { amount: 15620, currency: "BRL" },
                    ratio_bp: 14883,
                  },
                  {
                    id: "m9",
                    name: "Mercado 9",
                    amount: { amount: 21240, currency: "BRL" },
                    ratio_bp: 20238,
                  },
                  {
                    id: "m10",
                    name: "Mercado 10",
                    amount: { amount: 24800, currency: "BRL" },
                    ratio_bp: 23630,
                  },
                  {
                    id: "m11",
                    name: "Mercado 11",
                    amount: { amount: 30170, currency: "BRL" },
                    ratio_bp: 28747,
                  },
                ],
              },
              {
                category: "Restaurantes",
                median: { amount: 5200, currency: "BRL" },
                points: [
                  {
                    id: "r0",
                    name: "Restaurante 0",
                    amount: { amount: 2200, currency: "BRL" },
                    ratio_bp: 4231,
                  },
                  {
                    id: "r1",
                    name: "Restaurante 1",
                    amount: { amount: 2850, currency: "BRL" },
                    ratio_bp: 5481,
                  },
                  {
                    id: "r2",
                    name: "Restaurante 2",
                    amount: { amount: 3400, currency: "BRL" },
                    ratio_bp: 6538,
                  },
                  {
                    id: "r3",
                    name: "Restaurante 3",
                    amount: { amount: 3840, currency: "BRL" },
                    ratio_bp: 7385,
                  },
                  {
                    id: "r4",
                    name: "Restaurante 4",
                    amount: { amount: 4590, currency: "BRL" },
                    ratio_bp: 8827,
                  },
                  {
                    id: "r5",
                    name: "Restaurante 5",
                    amount: { amount: 5200, currency: "BRL" },
                    ratio_bp: 10000,
                  },
                  {
                    id: "r6",
                    name: "Restaurante 6",
                    amount: { amount: 6490, currency: "BRL" },
                    ratio_bp: 12481,
                  },
                  {
                    id: "r7",
                    name: "Restaurante 7",
                    amount: { amount: 7100, currency: "BRL" },
                    ratio_bp: 13654,
                  },
                  {
                    id: "r8",
                    name: "Restaurante 8",
                    amount: { amount: 8800, currency: "BRL" },
                    ratio_bp: 16923,
                  },
                  {
                    id: "r9",
                    name: "Restaurante 9",
                    amount: { amount: 11200, currency: "BRL" },
                    ratio_bp: 21538,
                  },
                  {
                    id: "r10",
                    name: "Restaurante 10",
                    amount: { amount: 14500, currency: "BRL" },
                    ratio_bp: 27885,
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-heat",
    form: "heat",
    note: "search_transactions → show heat",
    handled: true,
    question: "Em que dias eu gasto mais?",
    answer: "Os fins de semana pesam mais.",
    views: [
      {
        id: "v-heat",
        form: "heat",
        payload: {
          title: { key: "assistantView.heat.title" },
          window: { from: "2026-11-01", to: "2026-11-30" },
          verdict: {
            key: "assistantView.heat.verdict",
            params: {
              amount: { money: { amount: 61240, currency: "BRL" } },
              day: { date: "2026-11-08" },
            },
          },
          open: {
            screen: "/transactions",
            params: { from: "2026-11-01", to: "2026-11-30" },
          },
          next: [],
          rows: {
            head: ["assistantView.col.date", "assistantView.col.spent"],
            rows: [
              [
                { date: "2026-11-01" },
                { money: { amount: 11020, currency: "BRL" } },
              ],
              [
                { date: "2026-11-02" },
                { money: { amount: 25720, currency: "BRL" } },
              ],
              [
                { date: "2026-11-03" },
                { money: { amount: 7350, currency: "BRL" } },
              ],
              [
                { date: "2026-11-04" },
                { money: { amount: 18370, currency: "BRL" } },
              ],
              [
                { date: "2026-11-05" },
                { money: { amount: 4899, currency: "BRL" } },
              ],
              [
                { date: "2026-11-06" },
                { money: { amount: 15920, currency: "BRL" } },
              ],
              [
                { date: "2026-11-07" },
                { money: { amount: 42870, currency: "BRL" } },
              ],
              [
                { date: "2026-11-08" },
                { money: { amount: 61240, currency: "BRL" } },
              ],
              [
                { date: "2026-11-09" },
                { money: { amount: 20820, currency: "BRL" } },
              ],
              [
                { date: "2026-11-10" },
                { money: { amount: 8570, currency: "BRL" } },
              ],
              [
                { date: "2026-11-11" },
                { money: { amount: 12250, currency: "BRL" } },
              ],
              [
                { date: "2026-11-12" },
                { money: { amount: 23270, currency: "BRL" } },
              ],
              [
                { date: "2026-11-13" },
                { money: { amount: 6120, currency: "BRL" } },
              ],
              [
                { date: "2026-11-14" },
                { money: { amount: 39194, currency: "BRL" } },
              ],
              [
                { date: "2026-11-15" },
                { money: { amount: 50217, currency: "BRL" } },
              ],
              [
                { date: "2026-11-16" },
                { money: { amount: 13470, currency: "BRL" } },
              ],
              [
                { date: "2026-11-17" },
                { money: { amount: 9798, currency: "BRL" } },
              ],
              [
                { date: "2026-11-18" },
                { money: { amount: 17140, currency: "BRL" } },
              ],
              [
                { date: "2026-11-19" },
                { money: { amount: 7350, currency: "BRL" } },
              ],
            ],
          },
          data: {
            month: "2026-11",
            days: [
              { amount: 11020, currency: "BRL" },
              { amount: 25720, currency: "BRL" },
              { amount: 7350, currency: "BRL" },
              { amount: 18370, currency: "BRL" },
              { amount: 4899, currency: "BRL" },
              { amount: 15920, currency: "BRL" },
              { amount: 42870, currency: "BRL" },
              { amount: 61240, currency: "BRL" },
              { amount: 20820, currency: "BRL" },
              { amount: 8570, currency: "BRL" },
              { amount: 12250, currency: "BRL" },
              { amount: 23270, currency: "BRL" },
              { amount: 6120, currency: "BRL" },
              { amount: 39194, currency: "BRL" },
              { amount: 50217, currency: "BRL" },
              { amount: 13470, currency: "BRL" },
              { amount: 9798, currency: "BRL" },
              { amount: 17140, currency: "BRL" },
              { amount: 7350, currency: "BRL" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
              { amount: 0, currency: "" },
            ],
            until: 19,
            peak: 8,
          },
        },
      },
    ],
  },
  {
    id: "built-transaction",
    form: "transaction",
    note: "get_transaction → show transaction",
    handled: true,
    question: "Me mostra a compra do Pão de Açúcar",
    answer: "A compra foi corrigida hoje.",
    views: [
      {
        id: "v-transaction",
        form: "transaction",
        payload: {
          title: { key: "assistantView.transaction.title" },
          window: { at: "2026-11-18" },
          verdict: {
            key: "assistantView.transaction.verdict_changed_once",
            params: { account: { text: "Nubank" } },
          },
          open: { screen: "/transactions/t9" },
          next: [],
          rows: {
            head: ["assistantView.col.account", "assistantView.col.amount"],
            rows: [
              [
                { text: "Nubank" },
                { money: { amount: -21240, currency: "BRL" } },
              ],
              [
                { text: "Mercado" },
                { money: { amount: 21240, currency: "BRL" } },
              ],
            ],
          },
          data: {
            item: {
              id: "t9",
              date: "2026-11-18",
              name: "Pão de Açúcar",
              account: "Nubank",
              category: "Mercado",
              amount: { amount: -21240, currency: "BRL" },
            },
            tags: ["casa"],
            postings: [
              {
                account: "Nubank",
                class: "asset",
                amount: { amount: -21240, currency: "BRL" },
              },
              {
                account: "Mercado",
                class: "expense",
                amount: { amount: 21240, currency: "BRL" },
              },
            ],
            history: [
              { version: 1, reason: "amount", at: "2026-11-19T12:58:00Z" },
            ],
            attachments: [
              { file_name: "nota-fiscal-pao-de-acucar.pdf", size: 86016 },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-agenda",
    form: "agenda",
    note: "list_schedules → show agenda",
    handled: true,
    question: "O que vence nos próximos 30 dias?",
    answer: "A primeira semana de dezembro é a mais pesada.",
    views: [
      {
        id: "v-agenda",
        form: "agenda",
        payload: {
          title: { key: "assistantView.agenda.title" },
          window: { from: "2026-11-25", to: "2026-12-12" },
          verdict: {
            key: "assistantView.agenda.verdict",
            params: {
              count: { count: 7 },
              total: { money: { amount: 903790, currency: "BRL" } },
              week: { date: "2026-11-30" },
              week_total: { money: { amount: 533332, currency: "BRL" } },
            },
          },
          open: { screen: "/planning", params: { tab: "agenda" } },
          next: [],
          rows: {
            head: [
              "assistantView.col.date",
              "assistantView.col.name",
              "assistantView.col.amount",
            ],
            rows: [
              [
                { date: "2026-11-25" },
                { text: "Fatura Cartão Itaú" },
                { money: { amount: -291838, currency: "BRL" } },
              ],
              [
                { date: "2026-11-28" },
                { text: "Conta de luz" },
                { money: { amount: -18730, currency: "BRL" } },
              ],
              [
                { date: "2026-12-01" },
                { text: "Escola" },
                { money: { amount: -200342, currency: "BRL" } },
              ],
              [
                { date: "2026-12-05" },
                { text: "Aluguel" },
                { money: { amount: -320000, currency: "BRL" } },
              ],
              [
                { date: "2026-12-06" },
                { text: "Internet" },
                { money: { amount: -12990, currency: "BRL" } },
              ],
              [
                { date: "2026-12-10" },
                { text: "Notebook Dell · parcela 7 de 10" },
                { money: { amount: -47900, currency: "BRL" } },
              ],
              [
                { date: "2026-12-12" },
                { text: "Academia" },
                { money: { amount: -11990, currency: "BRL" } },
              ],
            ],
          },
          data: {
            total: { amount: -903790, currency: "BRL" },
            weeks: [
              {
                start: "2026-11-23",
                total: { amount: -310568, currency: "BRL" },
                events: [
                  {
                    date: "2026-11-25",
                    description: "Fatura Cartão Itaú",
                    account: "Itaú",
                    amount: { amount: -291838, currency: "BRL" },
                    state: "expected",
                  },
                  {
                    date: "2026-11-28",
                    description: "Conta de luz",
                    amount: { amount: -18730, currency: "BRL" },
                    state: "expected",
                  },
                ],
              },
              {
                start: "2026-11-30",
                total: { amount: -533332, currency: "BRL" },
                events: [
                  {
                    date: "2026-12-01",
                    description: "Escola",
                    amount: { amount: -200342, currency: "BRL" },
                    state: "expected",
                  },
                  {
                    date: "2026-12-05",
                    description: "Aluguel",
                    amount: { amount: -320000, currency: "BRL" },
                    state: "expected",
                  },
                  {
                    date: "2026-12-06",
                    description: "Internet",
                    amount: { amount: -12990, currency: "BRL" },
                    state: "expected",
                  },
                ],
              },
              {
                start: "2026-12-07",
                total: { amount: -59890, currency: "BRL" },
                events: [
                  {
                    date: "2026-12-10",
                    description: "Notebook Dell · parcela 7 de 10",
                    amount: { amount: -47900, currency: "BRL" },
                    state: "expected",
                  },
                  {
                    date: "2026-12-12",
                    description: "Academia",
                    amount: { amount: -11990, currency: "BRL" },
                    state: "expected",
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-balance",
    form: "balance",
    note: "project_balance → show balance",
    handled: true,
    question: "Meu saldo aguenta até o fim do ano?",
    answer: "Aguenta, com folga pequena depois do aluguel.",
    views: [
      {
        id: "v-balance",
        form: "balance",
        payload: {
          title: {
            key: "assistantView.balance.title",
            params: { account: { text: "Itaú" } },
          },
          window: { from: "2026-11-19", to: "2026-12-31" },
          verdict: {
            key: "assistantView.balance.verdict_positive",
            params: {
              amount: { money: { amount: 41230, currency: "BRL" } },
              day: { date: "2026-12-05" },
            },
          },
          open: { screen: "/planning", params: { tab: "agenda" } },
          next: [],
          rows: {
            head: [
              "assistantView.col.date",
              "assistantView.col.name",
              "assistantView.col.balance",
            ],
            rows: [
              [
                { date: "2026-11-19" },
                { text: "assistantView.balance.today" },
                { money: { amount: 203410, currency: "BRL" } },
              ],
              [
                { date: "2026-11-22" },
                { text: "Salário" },
                { money: { amount: 853410, currency: "BRL" } },
              ],
              [
                { date: "2026-11-25" },
                { text: "Fatura" },
                { money: { amount: 561572, currency: "BRL" } },
              ],
              [
                { date: "2026-12-01" },
                { text: "Escola" },
                { money: { amount: 361230, currency: "BRL" } },
              ],
              [
                { date: "2026-12-05" },
                { text: "Aluguel" },
                { money: { amount: 41230, currency: "BRL" } },
              ],
              [
                { date: "2026-12-20" },
                { text: "13º salário" },
                { money: { amount: 691230, currency: "BRL" } },
              ],
            ],
          },
          data: {
            account: "Itaú",
            from: "2026-11-19",
            to: "2026-12-31",
            opening: { amount: 203410, currency: "BRL" },
            points: [
              {
                date: "2026-11-22",
                description: "Salário",
                amount: { amount: 650000, currency: "BRL" },
                balance: { amount: 853410, currency: "BRL" },
              },
              {
                date: "2026-11-25",
                description: "Fatura",
                amount: { amount: -291838, currency: "BRL" },
                balance: { amount: 561572, currency: "BRL" },
              },
              {
                date: "2026-12-01",
                description: "Escola",
                amount: { amount: -200342, currency: "BRL" },
                balance: { amount: 361230, currency: "BRL" },
              },
              {
                date: "2026-12-05",
                description: "Aluguel",
                amount: { amount: -320000, currency: "BRL" },
                balance: { amount: 41230, currency: "BRL" },
              },
              {
                date: "2026-12-20",
                description: "13º salário",
                amount: { amount: 650000, currency: "BRL" },
                balance: { amount: 691230, currency: "BRL" },
              },
            ],
            low: {
              date: "2026-12-05",
              description: "Aluguel",
              amount: { amount: -320000, currency: "BRL" },
              balance: { amount: 41230, currency: "BRL" },
            },
          },
        },
      },
    ],
  },
  {
    id: "built-goals",
    form: "goals",
    note: "get_budgets_and_goals → show goals",
    handled: true,
    question: "Vou bater a meta da viagem?",
    answer: "Só se guardar mais por mês.",
    views: [
      {
        id: "v-goals",
        form: "goals",
        payload: {
          title: { key: "assistantView.goals.title" },
          window: { at: "2026-11-19" },
          verdict: {
            key: "assistantView.goals.verdict",
            params: {
              due: { date: "2027-07-31" },
              monthly: { money: { amount: 110000, currency: "BRL" } },
              months: { count: 8 },
              name: { text: "Viagem Japão" },
            },
          },
          open: { screen: "/goals" },
          next: [],
          rows: {
            head: [
              "assistantView.col.goal",
              "assistantView.col.saved",
              "assistantView.col.target",
            ],
            rows: [
              [
                { text: "Viagem Japão" },
                { money: { amount: 620000, currency: "BRL" } },
                { money: { amount: 1500000, currency: "BRL" } },
              ],
              [
                { text: "Reserva de emergência" },
                { money: { amount: 3150000, currency: "BRL" } },
                { money: { amount: 4500000, currency: "BRL" } },
              ],
            ],
          },
          data: {
            goals: [
              {
                goal_id: "g1",
                name: "Viagem Japão",
                target: { amount: 1500000, currency: "BRL" },
                current: { amount: 620000, currency: "BRL" },
                progress_bp: 4133,
                due_on: "2027-07-31",
                months: 8,
                monthly: { amount: 110000, currency: "BRL" },
              },
              {
                goal_id: "g2",
                name: "Reserva de emergência",
                target: { amount: 4500000, currency: "BRL" },
                current: { amount: 3150000, currency: "BRL" },
                progress_bp: 7000,
                due_on: "2027-12-31",
                months: 13,
                monthly: { amount: 103847, currency: "BRL" },
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-recurring",
    form: "recurring",
    note: "find_recurring → show recurring",
    handled: true,
    question: "Que assinaturas eu pago?",
    answer: "Seis cobranças se repetem.",
    views: [
      {
        id: "v-recurring",
        form: "recurring",
        payload: {
          title: { key: "assistantView.recurring.title" },
          window: {},
          verdict: {
            key: "assistantView.recurring.verdict",
            params: {
              count: { count: 6 },
              total: { money: { amount: 390600, currency: "BRL" } },
            },
          },
          open: { screen: "/planning", params: { tab: "subscriptions" } },
          next: [],
          rows: {
            head: [
              "assistantView.col.name",
              "assistantView.col.amount",
              "assistantView.col.yearly",
            ],
            rows: [
              [
                { text: "Academia Smart" },
                { money: { amount: -11990, currency: "BRL" } },
                { money: { amount: -143880, currency: "BRL" } },
              ],
              [
                { text: "Adobe" },
                { money: { amount: -9900, currency: "BRL" } },
                { money: { amount: -118800, currency: "BRL" } },
              ],
              [
                { text: "Netflix" },
                { money: { amount: -5590, currency: "BRL" } },
                { money: { amount: -67080, currency: "BRL" } },
              ],
              [
                { text: "Spotify" },
                { money: { amount: -2190, currency: "BRL" } },
                { money: { amount: -26280, currency: "BRL" } },
              ],
              [
                { text: "iCloud" },
                { money: { amount: -1490, currency: "BRL" } },
                { money: { amount: -17880, currency: "BRL" } },
              ],
              [
                { text: "Amazon Prime" },
                { money: { amount: -16680, currency: "BRL" } },
                { money: { amount: -16680, currency: "BRL" } },
              ],
            ],
          },
          data: {
            total: { amount: -390600, currency: "BRL" },
            items: [
              {
                key: "Academia Smart",
                name: "Academia Smart",
                account: "Nubank",
                frequency: "monthly",
                last: { amount: -11990, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -143880, currency: "BRL" },
                scheduled: false,
              },
              {
                key: "Adobe",
                name: "Adobe",
                account: "Nubank",
                frequency: "monthly",
                last: { amount: -9900, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -118800, currency: "BRL" },
                scheduled: false,
              },
              {
                key: "Netflix",
                name: "Netflix",
                account: "Nubank",
                frequency: "monthly",
                last: { amount: -5590, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -67080, currency: "BRL" },
                scheduled: false,
              },
              {
                key: "Spotify",
                name: "Spotify",
                account: "Nubank",
                frequency: "monthly",
                last: { amount: -2190, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -26280, currency: "BRL" },
                scheduled: false,
              },
              {
                key: "iCloud",
                name: "iCloud",
                account: "Nubank",
                frequency: "monthly",
                last: { amount: -1490, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -17880, currency: "BRL" },
                scheduled: false,
              },
              {
                key: "Amazon Prime",
                name: "Amazon Prime",
                account: "Nubank",
                frequency: "yearly",
                last: { amount: -16680, currency: "BRL" },
                last_date: "2026-11-05",
                next_date: "2026-12-05",
                yearly: { amount: -16680, currency: "BRL" },
                scheduled: false,
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-figure",
    form: "figure",
    note: "get_portfolio net_worth + net_worth_days → show figure",
    handled: true,
    question: "Qual é o meu patrimônio hoje?",
    answer: "Subiu no mês, puxado pelos investimentos.",
    views: [
      {
        id: "v-figure",
        form: "figure",
        payload: {
          title: { key: "assistantView.figure.title" },
          window: { at: "2026-11-19" },
          verdict: {
            key: "assistantView.figure.verdict_up",
            params: {
              change: { money: { amount: 291800, currency: "BRL" } },
              days: { count: 29 },
              share: { bp: 158 },
            },
          },
          open: { screen: "/" },
          next: [],
          rows: {
            head: ["assistantView.col.part", "assistantView.col.value"],
            rows: [
              [
                { text: "assistantView.figure.assets" },
                { money: { amount: 19119218, currency: "BRL" } },
              ],
              [
                { text: "assistantView.figure.liabilities" },
                { money: { amount: 376000, currency: "BRL" } },
              ],
              [
                { text: "assistantView.figure.net" },
                { money: { amount: 18743218, currency: "BRL" } },
              ],
            ],
          },
          data: {
            net: { amount: 18743218, currency: "BRL" },
            assets: { amount: 19119218, currency: "BRL" },
            liabilities: { amount: 376000, currency: "BRL" },
            series: [
              {
                date: "2026-10-21",
                net: { amount: 18451418, currency: "BRL" },
              },
              {
                date: "2026-10-22",
                net: { amount: 18412000, currency: "BRL" },
              },
              {
                date: "2026-10-23",
                net: { amount: 18490000, currency: "BRL" },
              },
              {
                date: "2026-10-24",
                net: { amount: 18521000, currency: "BRL" },
              },
              {
                date: "2026-10-25",
                net: { amount: 18480000, currency: "BRL" },
              },
              {
                date: "2026-10-26",
                net: { amount: 18560000, currency: "BRL" },
              },
              {
                date: "2026-10-27",
                net: { amount: 18510000, currency: "BRL" },
              },
              {
                date: "2026-10-28",
                net: { amount: 18590000, currency: "BRL" },
              },
              {
                date: "2026-10-29",
                net: { amount: 18620000, currency: "BRL" },
              },
              {
                date: "2026-10-30",
                net: { amount: 18570000, currency: "BRL" },
              },
              {
                date: "2026-10-31",
                net: { amount: 18540000, currency: "BRL" },
              },
              {
                date: "2026-11-01",
                net: { amount: 18610000, currency: "BRL" },
              },
              {
                date: "2026-11-02",
                net: { amount: 18660000, currency: "BRL" },
              },
              {
                date: "2026-11-03",
                net: { amount: 18600000, currency: "BRL" },
              },
              {
                date: "2026-11-04",
                net: { amount: 18630000, currency: "BRL" },
              },
              {
                date: "2026-11-05",
                net: { amount: 18690000, currency: "BRL" },
              },
              {
                date: "2026-11-06",
                net: { amount: 18640000, currency: "BRL" },
              },
              {
                date: "2026-11-07",
                net: { amount: 18680000, currency: "BRL" },
              },
              {
                date: "2026-11-08",
                net: { amount: 18710000, currency: "BRL" },
              },
              {
                date: "2026-11-09",
                net: { amount: 18670000, currency: "BRL" },
              },
              {
                date: "2026-11-10",
                net: { amount: 18690000, currency: "BRL" },
              },
              {
                date: "2026-11-11",
                net: { amount: 18730000, currency: "BRL" },
              },
              {
                date: "2026-11-12",
                net: { amount: 18690000, currency: "BRL" },
              },
              {
                date: "2026-11-13",
                net: { amount: 18700000, currency: "BRL" },
              },
              {
                date: "2026-11-14",
                net: { amount: 18760000, currency: "BRL" },
              },
              {
                date: "2026-11-15",
                net: { amount: 18720000, currency: "BRL" },
              },
              {
                date: "2026-11-16",
                net: { amount: 18700000, currency: "BRL" },
              },
              {
                date: "2026-11-17",
                net: { amount: 18750000, currency: "BRL" },
              },
              {
                date: "2026-11-18",
                net: { amount: 18720000, currency: "BRL" },
              },
              {
                date: "2026-11-19",
                net: { amount: 18743218, currency: "BRL" },
              },
            ],
            change: { amount: 291800, currency: "BRL" },
          },
        },
      },
    ],
  },
  {
    id: "built-allocation",
    form: "allocation",
    note: "get_portfolio allocation → show allocation",
    handled: true,
    question: "Como está dividida minha carteira?",
    answer: "Renda fixa é metade.",
    views: [
      {
        id: "v-allocation",
        form: "allocation",
        payload: {
          title: { key: "assistantView.allocation.title" },
          window: { at: "2026-11-19" },
          verdict: {
            key: "assistantView.allocation.verdict",
            params: {
              name: { text: "assistantView.group.fixed_income" },
              share: { bp: 5200 },
              total: { money: { amount: 17698178, currency: "BRL" } },
            },
          },
          open: { screen: "/portfolio" },
          next: [],
          rows: {
            head: [
              "assistantView.col.group",
              "assistantView.col.value",
              "assistantView.col.share",
            ],
            rows: [
              [
                { text: "assistantView.group.fixed_income" },
                { money: { amount: 9203053, currency: "BRL" } },
                { bp: 5200 },
              ],
              [
                { text: "assistantView.group.stock" },
                { money: { amount: 5486435, currency: "BRL" } },
                { bp: 3100 },
              ],
              [
                { text: "assistantView.group.reit" },
                { money: { amount: 2123781, currency: "BRL" } },
                { bp: 1200 },
              ],
              [
                { text: "assistantView.group.etf" },
                { money: { amount: 884909, currency: "BRL" } },
                { bp: 500 },
              ],
            ],
          },
          data: {
            total: { amount: 17698178, currency: "BRL" },
            groups: [
              {
                key: "fixed_income",
                value: { amount: 9203053, currency: "BRL" },
                share_bp: 5200,
              },
              {
                key: "stock",
                value: { amount: 5486435, currency: "BRL" },
                share_bp: 3100,
              },
              {
                key: "reit",
                value: { amount: 2123781, currency: "BRL" },
                share_bp: 1200,
              },
              {
                key: "etf",
                value: { amount: 884909, currency: "BRL" },
                share_bp: 500,
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-contribution",
    form: "contribution",
    note: "get_portfolio contribution → show contribution",
    handled: true,
    question: "Onde aplico 5 mil este mês?",
    answer: "Tudo em renda fixa.",
    views: [
      {
        id: "v-contribution",
        form: "contribution",
        payload: {
          title: { key: "assistantView.contribution.title" },
          window: { at: "2026-11-19" },
          verdict: {
            key: "assistantView.contribution.verdict",
            params: {
              after: { bp: 5330 },
              amount: { money: { amount: 500000, currency: "BRL" } },
              name: { text: "Renda fixa" },
            },
          },
          open: { screen: "/portfolio/contribution-plan" },
          next: [],
          rows: {
            head: [
              "assistantView.col.class",
              "assistantView.col.share",
              "assistantView.col.target",
            ],
            rows: [
              [{ text: "Renda fixa" }, { bp: 5200 }, { bp: 6000 }],
              [{ text: "Ações" }, { bp: 3100 }, { bp: 2500 }],
              [{ text: "FIIs" }, { bp: 1200 }, { bp: 1000 }],
              [{ text: "Exterior" }, { bp: 500 }, { bp: 500 }],
            ],
          },
          data: {
            amount: { amount: 500000, currency: "BRL" },
            total: { amount: 17698178, currency: "BRL" },
            classes: [
              {
                name: "Renda fixa",
                target_bp: 6000,
                share_bp: 5200,
                after_bp: 5330,
                amount: { amount: 500000, currency: "BRL" },
              },
              {
                name: "Ações",
                target_bp: 2500,
                share_bp: 3100,
                after_bp: 3010,
                amount: { amount: 0, currency: "BRL" },
              },
              {
                name: "FIIs",
                target_bp: 1000,
                share_bp: 1200,
                after_bp: 1170,
                amount: { amount: 0, currency: "BRL" },
              },
              {
                name: "Exterior",
                target_bp: 500,
                share_bp: 500,
                after_bp: 490,
                amount: { amount: 0, currency: "BRL" },
              },
            ],
          },
        },
      },
    ],
  },
  {
    id: "built-holdings",
    form: "holdings",
    note: "get_portfolio positions → show holdings",
    handled: true,
    question: "Como estão minhas ações?",
    answer: "Só uma está no negativo.",
    views: [
      {
        id: "v-holdings",
        form: "holdings",
        payload: {
          title: { key: "assistantView.holdings.title" },
          window: { at: "2026-11-19" },
          verdict: {
            key: "assistantView.holdings.verdict_one_down",
            params: {
              count: { count: 1 },
              name: { text: "BBAS3" },
              result: { rate: 934 },
            },
          },
          open: { screen: "/portfolio" },
          next: [],
          rows: {
            head: [
              "assistantView.col.instrument",
              "assistantView.col.value",
              "assistantView.col.result",
              "assistantView.col.weight",
            ],
            rows: [
              [
                { text: "PETR4" },
                { money: { amount: 389200, currency: "BRL" } },
                { rate: 1380 },
                { bp: 4639 },
              ],
              [
                { text: "ITSA4" },
                { money: { amount: 210400, currency: "BRL" } },
                { rate: 691 },
                { bp: 2508 },
              ],
              [
                { text: "BBAS3" },
                { money: { amount: 141850, currency: "BRL" } },
                { rate: -420 },
                { bp: 1691 },
              ],
              [
                { text: "WEGE3" },
                { money: { amount: 97600, currency: "BRL" } },
                { rate: 2127 },
                { bp: 1163 },
              ],
            ],
          },
          data: {
            rows: [
              {
                account: "XP",
                instrument: "PETR4",
                quantity: "100",
                cost: { amount: 342000, currency: "BRL" },
                value: { amount: 389200, currency: "BRL" },
                result_bp: 1380,
                weight_bp: 4639,
              },
              {
                account: "XP",
                instrument: "ITSA4",
                quantity: "100",
                cost: { amount: 196800, currency: "BRL" },
                value: { amount: 210400, currency: "BRL" },
                result_bp: 691,
                weight_bp: 2508,
              },
              {
                account: "XP",
                instrument: "BBAS3",
                quantity: "100",
                cost: { amount: 148069, currency: "BRL" },
                value: { amount: 141850, currency: "BRL" },
                result_bp: -420,
                weight_bp: 1691,
              },
              {
                account: "XP",
                instrument: "WEGE3",
                quantity: "100",
                cost: { amount: 80480, currency: "BRL" },
                value: { amount: 97600, currency: "BRL" },
                result_bp: 2127,
                weight_bp: 1163,
              },
            ],
            cost: { amount: 767349, currency: "BRL" },
            value: { amount: 839050, currency: "BRL" },
            result_bp: 934,
          },
        },
      },
    ],
  },
  {
    id: "built-benchmark",
    form: "benchmark",
    note: "get_portfolio return → show benchmark",
    handled: true,
    question: "Minha carteira bateu o CDI?",
    answer: "Por pouco.",
    views: [
      {
        id: "v-benchmark",
        form: "benchmark",
        payload: {
          title: {
            key: "assistantView.benchmark.title",
            params: { index: { text: "assistantView.index.cdi" } },
          },
          window: { from: "2025-12-01", to: "2026-11-18" },
          verdict: {
            key: "assistantView.benchmark.verdict_above",
            params: {
              excess: { points: 19 },
              index: { text: "assistantView.index.cdi" },
              index_return: { rate: 1410 },
              return: { rate: 1429 },
            },
          },
          open: { screen: "/portfolio" },
          next: [],
          rows: {
            head: ["assistantView.col.series", "assistantView.col.return"],
            rows: [
              [{ text: "assistantView.benchmark.portfolio" }, { rate: 1429 }],
              [{ text: "assistantView.index.cdi" }, { rate: 1410 }],
            ],
          },
          data: {
            index: "cdi",
            from: "2025-12-01",
            until: "2026-11-18",
            return_bp: 1429,
            index_bp: 1410,
            excess_bp: 19,
          },
        },
      },
    ],
  },
  {
    id: "built-tax_year",
    form: "tax_year",
    note: "get_tax_year gain_tax → show tax_year",
    handled: true,
    question: "Devo imposto sobre as ações este ano?",
    answer: "Dois meses deveram, já pagos.",
    views: [
      {
        id: "v-tax_year",
        form: "tax_year",
        payload: {
          title: { key: "assistantView.tax_year.title" },
          window: { from: "2026-01-01", to: "2026-12-31" },
          verdict: {
            key: "assistantView.tax_year.verdict",
            params: {
              count: { count: 2 },
              total: { money: { amount: 83880, currency: "BRL" } },
            },
          },
          open: { screen: "/portfolio" },
          next: [],
          rows: {
            head: [
              "assistantView.col.month",
              "assistantView.col.result",
              "assistantView.col.tax",
            ],
            rows: [
              [
                { month: "2026-01" },
                { money: { amount: 62000, currency: "BRL" } },
                { money: { amount: 0, currency: "BRL" } },
              ],
              [
                { month: "2026-03" },
                { money: { amount: 90000, currency: "BRL" } },
                { money: { amount: 0, currency: "BRL" } },
              ],
              [
                { month: "2026-04" },
                { money: { amount: 284000, currency: "BRL" } },
                { money: { amount: 42600, currency: "BRL" } },
              ],
              [
                { month: "2026-07" },
                { money: { amount: 111000, currency: "BRL" } },
                { money: { amount: 0, currency: "BRL" } },
              ],
              [
                { month: "2026-09" },
                { money: { amount: 275200, currency: "BRL" } },
                { money: { amount: 41280, currency: "BRL" } },
              ],
              [
                { month: "2026-11" },
                { money: { amount: 145000, currency: "BRL" } },
                { money: { amount: 0, currency: "BRL" } },
              ],
            ],
          },
          data: {
            from: "2026-01-01",
            to: "2026-12-31",
            months: [
              {
                month: "2026-01",
                result: { amount: 62000, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 0, currency: "BRL" },
                due: { amount: 0, currency: "BRL" },
              },
              {
                month: "2026-03",
                result: { amount: 90000, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 0, currency: "BRL" },
                due: { amount: 0, currency: "BRL" },
              },
              {
                month: "2026-04",
                result: { amount: 284000, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 42600, currency: "BRL" },
                due: { amount: 42600, currency: "BRL" },
              },
              {
                month: "2026-07",
                result: { amount: 111000, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 0, currency: "BRL" },
                due: { amount: 0, currency: "BRL" },
              },
              {
                month: "2026-09",
                result: { amount: 275200, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 41280, currency: "BRL" },
                due: { amount: 41280, currency: "BRL" },
              },
              {
                month: "2026-11",
                result: { amount: 145000, currency: "BRL" },
                exempt: { amount: 0, currency: "BRL" },
                tax: { amount: 0, currency: "BRL" },
                due: { amount: 0, currency: "BRL" },
              },
            ],
            total: { amount: 83880, currency: "BRL" },
          },
        },
      },
    ],
  },
];
