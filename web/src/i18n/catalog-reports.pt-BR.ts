import type { reportsEn } from "@/i18n/catalog-reports.en";

export const reportsPtBR: Record<keyof typeof reportsEn, string> = {
  "nav.reports": "Relatórios",
  "report.subtitle":
    "Patrimônio líquido, receitas e despesas e fluxos das contas ao longo do tempo.",
  "report.tabs": "Relatórios",
  "report.tab.netWorth": "Patrimônio líquido",
  "report.tab.categories": "Categorias",
  "report.tab.flows": "Fluxos",
  "report.valueIn": "Avaliar em",
  "report.none": "—",
  "report.month": "Mês",
  "report.change": "Variação",
  "report.changePercent": "Variação %",
  "report.netWorth.title": "Patrimônio líquido por mês",
  "report.netWorth.span": "Meses exibidos",
  "report.netWorth.months": "{count} meses",
  "report.netWorth.assets": "Ativos",
  "report.netWorth.liabilities": "Passivos",
  "report.netWorth.net": "Líquido",
  "report.netWorth.unavailable":
    "Sem valor para {months}. Pode faltar um preço em {currency}.",
};
