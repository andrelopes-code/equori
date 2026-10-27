// The words of the market data settings (ADR 025), spread into catalogEn.
export const marketDataEn = {
  "settings.market_data.title": "Market data",
  "settings.summary.market_data":
    "Public sources of prices and indexes the instance fetches every 6 hours.",
  "marketData.prices": "Prices",
  "marketData.indexes": "Indexes",
  "marketData.refresh": "Update now",
  "marketData.refreshing":
    "The update runs in the background; the dates below change when it ends.",
  "marketData.none":
    "No source is enabled, so equori sends no request for prices or indexes.",
  "marketData.suggest": "Enable the sources of {region}",
  "marketData.never": "Nothing stored yet",
  "marketData.last": "Latest data {date}",
  "marketData.stale": "Overdue: latest data {date}",
  "marketData.failed": "Last update failed: {error}",
  "marketData.attention":
    "A source is overdue or failed. Its data stop at the date shown.",
  "problem.admin_required": "Only an admin changes the market data sources.",
  "problem.refresh_running":
    "An update is already running. The dates change when it ends.",
  "marketData.feed.b3_cotahist": "B3 daily quotes",
  "marketData.feed.bcb_ptax": "PTAX exchange rates (Banco Central do Brasil)",
  "marketData.feed.ecb": "ECB euro reference rates",
  "marketData.feed.br_cdi": "CDI (Banco Central do Brasil)",
  "marketData.feed.br_ipca": "IPCA (Banco Central do Brasil)",
  "marketData.feed.eu_estr": "€STR (European Central Bank)",
  "marketData.feed.ea_hicp": "Euro area HICP (Eurostat)",
  "marketData.feed.us_sofr": "SOFR (Federal Reserve Bank of New York)",
  "marketData.feed.br_focus": "Focus market survey (Banco Central do Brasil)",
  "marketData.feed.us_cpi": "CPI-U (Bureau of Labor Statistics)",
} as const;
