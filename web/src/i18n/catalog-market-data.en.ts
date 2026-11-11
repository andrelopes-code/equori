// The words of the market data settings (ADR 025), spread into catalogEn.
export const marketDataEn = {
  "settings.market_data.title": "Market data",
  "settings.summary.market_data":
    "Public sources of prices and indexes this installation fetches every 6 hours.",
  "marketData.prices": "Prices",
  "marketData.indexes": "Indexes",
  "marketData.refresh": "Update now",
  "marketData.working": "Updating prices",
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
  "problem.admin_required": "Only an admin changes this instance setting.",
  "problem.no_source": "No enabled source quotes this instrument.",
  "problem.refresh_running":
    "An update is already running. The dates change when it ends.",
  "problem.unofficial_source":
    "This source is not official; confirm to enable it.",
  "marketData.feed.b3_cotahist": "B3 daily quotes",
  "marketData.feed.b3_consolidated": "B3 consolidated trades",
  "marketData.feed.bcb_ptax": "PTAX exchange rates (Banco Central do Brasil)",
  "marketData.feed.ecb": "ECB euro reference rates",
  "marketData.feed.tesouro_direto": "Tesouro Direto prices (Tesouro Nacional)",
  "marketData.feed.cvm_funds": "Fund share values (CVM)",
  "marketData.feed.coinbase": "Coinbase crypto prices",
  "marketData.feed.yahoo_chart": "Yahoo Finance quotes",
  "marketData.feed.br_cdi": "CDI (Banco Central do Brasil)",
  "marketData.feed.br_ipca": "IPCA (Banco Central do Brasil)",
  "marketData.feed.eu_estr": "€STR (European Central Bank)",
  "marketData.feed.ea_hicp": "Euro area HICP (Eurostat)",
  "marketData.feed.us_sofr": "SOFR (Federal Reserve Bank of New York)",
  "marketData.feed.br_focus": "Focus market survey (Banco Central do Brasil)",
  "marketData.feed.us_cpi": "CPI-U (Bureau of Labor Statistics)",
  "settings.feeds.covers.none": "Covers no instrument",
  "settings.feeds.covers.one": "Covers 1 instrument",
  "settings.feeds.covers.other": "Covers {count} instruments",
  "settings.feeds.historyPending.one": "Loading history: 1 pending",
  "settings.feeds.historyPending.other": "Loading history: {count} pending",
  "settings.feeds.unofficial.tag": "Not official",
  "settings.feeds.unofficial.title": "Enable an unofficial source",
  "settings.feeds.unofficial.description":
    "This source is not official: it publishes no terms for this use and can stop answering without notice. Its quotes fill only the dates that no official source covers.",
  "settings.feeds.unofficial.confirm": "Enable",
} as const;
