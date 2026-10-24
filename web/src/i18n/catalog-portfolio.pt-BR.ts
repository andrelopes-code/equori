import type { portfolioEn } from "@/i18n/catalog-portfolio.en";

export const portfolioPtBR: Record<keyof typeof portfolioEn, string> = {
  "nav.portfolio": "Carteira",
  "portfolio.subtitle":
    "Posições, alocação e retorno das contas de investimento em uma data.",
  "portfolio.date": "Data de avaliação",
  "portfolio.positions.title": "Posições",
  "portfolio.positions.baseOnly":
    "As posições são avaliadas na moeda base, {currency}.",
  "portfolio.group": "Agrupar por",
  "portfolio.group.account": "Conta",
  "portfolio.group.instrument": "Ativo",
  "portfolio.account": "Conta",
  "portfolio.share": "Participação",
  "portfolio.total": "Total das posições avaliadas",
  "portfolio.unvalued":
    "Posições sem preço, fora do total e da participação: {count}",
  "portfolio.resultMixed":
    "Custo e valor de mercado estão em moedas diferentes",
  "portfolio.empty": "Nenhuma posição nesta data",
  "portfolio.emptyHint":
    "Registre uma negociação em uma conta de corretora para vê-la aqui.",
};
