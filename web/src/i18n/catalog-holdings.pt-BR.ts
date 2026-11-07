import type { holdingsEn } from "@/i18n/catalog-holdings.en";

export const holdingsPtBR: Record<keyof typeof holdingsEn, string> = {
  "holdings.bar": "Proporção",
  "report.assets.title": "Onde está o seu patrimônio",
  "report.assets.note":
    "Todas as contas que você tem: bancos, poupança, corretoras e dinheiro.",
  "report.assets.by": "Agrupar o patrimônio por",
  "report.assets.share": "% do patrimônio",
  "taxYear.class.stock": "Ações",
  "taxYear.class.etf": "ETFs",
  "taxYear.class.reit": "Fundos imobiliários",
  "taxYear.class.fii": "Fundos imobiliários",
  "taxYear.class.bdr": "BDRs",
  "taxYear.class.depositary_receipt": "Recibos de depósito",
  "taxYear.class.fixed_income": "Renda fixa",
  "taxYear.class.fixed_income_exempt": "Renda fixa isenta",
  "taxYear.class.fund": "Fundos",
  "taxYear.class.fund_equity": "Fundos de ações",
  "taxYear.class.crypto": "Criptoativos",
  "taxYear.class.currency": "Moedas",
};
