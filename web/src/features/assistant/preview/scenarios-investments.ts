import {
  brl,
  day,
  proposal,
  text,
} from "@/features/assistant/preview/preview-proposal";
import type { Scenario } from "@/features/assistant/preview/scenario";

const order = (
  side: string,
  code: string,
  quantity: string,
  price: string,
  gross: string,
) => ({
  description: code,
  side,
  quantity: text(quantity),
  price: text(price),
  amount: brl(gross),
});

// The investment proposals, with the data of the approved mock (investment proposals design).
export const writeInvestments: Scenario[] = [
  {
    id: "note-single",
    form: "Nota com uma ordem",
    note: "record_brokerage_note",
    handled: true,
    question: "Comprei 2 MUND11 a 105,47 no Inter, liquida dia 27",
    steps: ["get_portfolio", "record_brokerage_note"],
    answer: "Confirme a compra:",
    proposals: [
      proposal("note1", "record_brokerage_note", {
        action: "record_brokerage_note",
        target: "Inter Investimentos",
        changes: [
          { field: "fees", after: brl("0.05") },
          { field: "net", after: brl("-210.99") },
          { field: "account", after: text("Banco Inter") },
          { field: "date", after: day("2026-11-25") },
          { field: "settlement", after: day("2026-11-27") },
        ],
        items: [order("buy", "MUND11", "2", "105.47", "210.94")],
      }),
    ],
  },
  {
    id: "sale",
    form: "Venda de ativo",
    note: "record_investment.sell",
    handled: true,
    question: "Vendi 100 PETR4 a 38,20 na XP",
    steps: ["get_portfolio", "record_investment"],
    answer: "Confirme a venda:",
    proposals: [
      proposal("sale", "record_investment", {
        action: "record_investment.sell",
        target: "XP Investimentos",
        changes: [
          { field: "instrument", after: text("PETR4") },
          { field: "quantity", after: text("100") },
          { field: "price", after: text("38.2") },
          { field: "fees", after: brl("1.15") },
          { field: "taxes", after: brl("0.19") },
          { field: "amount", after: brl("3820.00") },
          { field: "net", after: brl("3818.66") },
          { field: "account", after: text("Conta XP") },
          { field: "date", after: day("2026-11-24") },
          { field: "settlement", after: day("2026-11-26") },
        ],
      }),
    ],
  },
  {
    id: "note",
    form: "Nota com várias ordens",
    note: "record_brokerage_note",
    handled: true,
    question: "Registre a nota da XP",
    steps: ["get_portfolio", "record_brokerage_note"],
    answer: "Confirme a nota:",
    proposals: [
      proposal("note3", "record_brokerage_note", {
        action: "record_brokerage_note",
        target: "XP Investimentos",
        changes: [
          { field: "fees", after: brl("0.97") },
          { field: "taxes", after: brl("0.09") },
          { field: "net", after: brl("708.24") },
          { field: "account", after: text("Conta XP") },
          { field: "date", after: day("2026-11-25") },
          { field: "settlement", after: day("2026-11-27") },
        ],
        items: [
          order("buy", "ITSA4", "100", "11.02", "1102.00"),
          order("buy", "MXRF11", "10", "9.87", "98.70"),
          order("sell", "PETR4", "50", "38.2", "1910.00"),
        ],
      }),
    ],
  },
  {
    id: "income",
    form: "Provento",
    note: "record_investment.income",
    handled: true,
    question: "Recebi JCP de ITSA4",
    steps: ["get_portfolio", "record_investment"],
    answer: "Confirme o provento:",
    proposals: [
      proposal("income", "record_investment", {
        action: "record_investment.income",
        target: "XP Investimentos",
        changes: [
          { field: "instrument", after: text("ITSA4") },
          { field: "amount", after: brl("184.20") },
          { field: "withheld", after: brl("27.63") },
          { field: "net", after: brl("156.57") },
          { field: "income_type", after: text("jcp") },
          { field: "account", after: text("Conta XP") },
          { field: "date", after: day("2026-11-23") },
        ],
      }),
    ],
  },
  {
    id: "fixed-income",
    form: "Aplicação em renda fixa",
    note: "record_fixed_income",
    handled: true,
    question: "Apliquei 10 mil num CDB do Inter a 110% do CDI até 2028",
    steps: ["get_portfolio", "record_fixed_income"],
    answer: "Confirme a aplicação:",
    proposals: [
      proposal("fi", "record_fixed_income", {
        action: "record_fixed_income",
        target: "CDB Banco Inter",
        changes: [
          { field: "amount", after: brl("10000.00") },
          { field: "net", after: brl("-10000.00") },
          { field: "institution", after: text("Inter Investimentos") },
          { field: "account", after: text("Banco Inter") },
          { field: "date", after: day("2026-11-25") },
          { field: "rate", after: text("110") },
          { field: "index", after: text("cdi") },
          { field: "maturity", after: day("2028-11-20") },
        ],
      }),
    ],
  },
  {
    id: "write-off",
    form: "Baixa de posição",
    note: "record_investment.write_off",
    handled: true,
    question: "As 200 opções PETRA400 venceram",
    steps: ["get_portfolio", "record_investment"],
    answer: "Confirme a baixa:",
    proposals: [
      proposal("off", "record_investment", {
        action: "record_investment.write_off",
        target: "XP Investimentos",
        changes: [
          { field: "instrument", after: text("PETRA400") },
          { field: "quantity", after: text("200") },
          { field: "date", after: day("2026-11-20") },
        ],
      }),
    ],
  },
  {
    id: "split",
    form: "Desdobramento",
    note: "record_corporate_action.split",
    handled: true,
    question: "WEGE3 desdobrou 1 para 2",
    steps: ["get_holding_lots", "record_corporate_action"],
    answer: "Confirme o desdobramento:",
    proposals: [
      proposal("split", "record_corporate_action", {
        action: "record_corporate_action.split",
        target: "XP Investimentos",
        changes: [
          { field: "ratio", after: text("1 : 2") },
          { field: "instrument", after: text("WEGE3") },
          { field: "date", after: day("2026-11-25") },
        ],
      }),
    ],
  },
  {
    id: "transfer",
    form: "Transferência de custódia",
    note: "transfer_custody",
    handled: true,
    question: "Transferi minhas 200 ITSA4 da Clear para a XP",
    steps: ["get_holding_lots", "transfer_custody"],
    answer: "Confirme a transferência:",
    proposals: [
      proposal("tc", "transfer_custody", {
        action: "transfer_custody",
        target: "Clear ITSA4",
        changes: [
          {
            field: "account",
            before: text("Clear"),
            after: text("XP Investimentos"),
          },
          { field: "quantity", after: text("200") },
          { field: "instrument", after: text("ITSA4") },
          { field: "date", after: day("2026-11-25") },
        ],
      }),
    ],
  },
  {
    id: "correction",
    form: "Correção de compra",
    note: "record_investment.correct",
    handled: true,
    question: "Foram 3 cotas de MUND11, não 2",
    steps: ["search_transactions", "record_investment"],
    answer: "Confirme a correção:",
    proposals: [
      proposal("fix", "record_investment", {
        action: "record_investment.correct",
        target: "Inter Investimentos",
        changes: [
          { field: "instrument", after: text("MUND11") },
          { field: "reason", after: text("Foram 3 cotas, não 2") },
          { field: "kind", after: text("buy") },
          { field: "quantity", before: text("2"), after: text("3") },
          { field: "price", after: text("105.47") },
          { field: "fees", after: brl("0.05") },
          { field: "amount", before: brl("210.94"), after: brl("316.41") },
          { field: "net", before: brl("-210.99"), after: brl("-316.46") },
          { field: "account", after: text("Banco Inter") },
          { field: "date", after: day("2026-11-25") },
          { field: "settlement", after: day("2026-11-27") },
        ],
      }),
    ],
  },
];
