import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { probeQuery } from "@/features/instruments/api";
import { sourceLabel } from "@/features/instruments/instrument-labels";
import { formatPrice } from "@/features/instruments/rate";
import { meQuery } from "@/features/session";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { formatDate } from "@/i18n/format";
import { routeTo } from "@/ui/route-to";
import { useDebounced } from "@/ui/use-debounced";

type ProbeInput = components["schemas"]["ProbeInput"];
type ProbeQuote = components["schemas"]["ProbeQuote"];

interface QuoteProbeProps {
  input: ProbeInput | null;
}

const settleMs = 600;

// What each source quotes for the instrument being defined. Saving never waits for it.
export function QuoteProbe({ input }: QuoteProbeProps) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const settled = useDebounced(JSON.stringify(input), settleMs);
  const probe = useQuery(
    probeQuery(api, JSON.parse(settled) as ProbeInput | null),
  );

  if (probe.data === undefined) return null;
  const { quotes, available } = probe.data;
  const notEnabled = admin ? available : [];

  return (
    <Stack gap={1}>
      {quotes.map((quote) => (
        <Text key={quote.source} size="sm" tone="muted">
          {quoteLine(t, tag, quote)}
        </Text>
      ))}
      {notEnabled.map((source) => (
        <Text key={source} size="sm" tone="muted">
          {t("instruments.probe.available", { source: sourceLabel(t, source) })}
        </Text>
      ))}
      {notEnabled.length > 0 && (
        <Link
          render={routeTo({
            to: "/settings",
            search: { section: "market_data" },
          })}
        >
          {t("instruments.probe.settings")}
        </Link>
      )}
    </Stack>
  );
}

function quoteLine(t: TFunction, tag: string, quote: ProbeQuote) {
  const source = sourceLabel(t, quote.source);
  if (quote.error !== null) return t("instruments.probe.failed", { source });
  if (quote.date === null || quote.value === null)
    return t("instruments.probe.none", { source });

  return t("instruments.probe.quote", {
    source,
    value: formatPrice(quote.value, tag),
    date: formatDate(quote.date, tag),
  });
}
