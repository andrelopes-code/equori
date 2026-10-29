import type { marketDataEn } from "@/i18n/catalog-market-data.en";

export const marketDataPtBR: Record<keyof typeof marketDataEn, string> = {
  "settings.market_data.title": "Dados de mercado",
  "settings.summary.market_data":
    "Fontes públicas de preços e índices que esta instalação busca a cada 6 horas.",
  "marketData.prices": "Preços",
  "marketData.indexes": "Índices",
  "marketData.refresh": "Atualizar agora",
  "marketData.refreshing":
    "A atualização roda em segundo plano; as datas abaixo mudam quando ela termina.",
  "marketData.none":
    "Nenhuma fonte está ativa, então o equori não faz requisições de preços nem de índices.",
  "marketData.suggest": "Ativar as fontes de {region}",
  "marketData.never": "Nada armazenado ainda",
  "marketData.last": "Último dado {date}",
  "marketData.stale": "Atrasado: último dado {date}",
  "marketData.failed": "A última atualização falhou: {error}",
  "marketData.attention":
    "Uma fonte está atrasada ou falhou. Os dados dela param na data mostrada.",
  "problem.admin_required":
    "Só um administrador altera as fontes de dados de mercado.",
  "problem.refresh_running":
    "Uma atualização já está em andamento. As datas mudam quando ela termina.",
  "marketData.feed.b3_cotahist": "Cotações diárias da B3",
  "marketData.feed.b3_consolidated": "Negócios consolidados da B3",
  "marketData.feed.bcb_ptax": "Câmbio PTAX (Banco Central do Brasil)",
  "marketData.feed.ecb": "Taxas de referência do euro (BCE)",
  "marketData.feed.br_cdi": "CDI (Banco Central do Brasil)",
  "marketData.feed.br_ipca": "IPCA (Banco Central do Brasil)",
  "marketData.feed.eu_estr": "€STR (Banco Central Europeu)",
  "marketData.feed.ea_hicp": "HICP da zona do euro (Eurostat)",
  "marketData.feed.us_sofr": "SOFR (Federal Reserve Bank of New York)",
  "marketData.feed.br_focus":
    "Pesquisa Focus de mercado (Banco Central do Brasil)",
  "marketData.feed.us_cpi": "CPI-U (Bureau of Labor Statistics)",
};
