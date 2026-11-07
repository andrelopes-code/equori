import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button, ButtonLink } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { pricesQuery } from "@/features/instruments";
import { settingsQuery } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface PriceMissingProps {
  currency: string | undefined;
  // What the reading covers: a period, or one date.
  period?: { from: string; to: string };
  date?: string;
  onFrom?: (from: string) => void;
  onBase?: (base: string) => void;
}

// PC22: a reader who chose a currency learns which rate is missing and leaves in one action. The
// rate goes through the base currency, the way a conversion does, so naming the investment the
// server stopped at would send the reader to record the wrong price.
// shortcut: reads the rate quoted as currency in base; a rate stored the other way round reads as
// none, and the reader still gets the way back to the base currency.
export function PriceMissingNotice({
  currency,
  period,
  date,
  onFrom,
  onBase,
}: PriceMissingProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const pair =
    currency !== undefined && base !== undefined && currency !== base;
  const prices = useQuery({
    ...pricesQuery(
      api,
      currency ?? "",
      base ?? "",
      period?.from ?? "",
      period?.to ?? "",
    ),
    enabled: pair && period !== undefined,
  });

  if (!pair)
    return (
      <Alert tone="warning">
        <AlertContent>
          <AlertDescription>{t("holdings.missing.own")}</AlertDescription>
        </AlertContent>
        <AlertActions>
          <ButtonLink render={(props) => <Link {...props} to="/instruments" />}>
            {t("holdings.prices")}
          </ButtonLink>
        </AlertActions>
      </Alert>
    );

  const first = prices.data?.map((p) => p.date).sort()[0];
  // The opening value reads the day before the period, so it starts the day after the first rate.
  const start = first === undefined ? undefined : shiftDate(first, 1);
  const startable =
    start !== undefined && period !== undefined && start <= period.to;
  const words = { currency, base };
  const day = (iso: string) => formatDate(iso, tag);

  let description = t("holdings.missing.until", {
    ...words,
    date: day(date ?? ""),
  });

  if (period !== undefined) {
    description =
      first === undefined
        ? t("holdings.missing.none", {
            ...words,
            from: day(period.from),
            to: day(period.to),
          })
        : t("holdings.missing.starts", {
            ...words,
            first: day(first),
            from: day(period.from),
          });
  }

  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertTitle>{t("holdings.missing.title", { currency })}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </AlertContent>
      <AlertActions>
        {startable && onFrom !== undefined && (
          <Button
            onClick={() => {
              onFrom(start);
            }}
          >
            {t("holdings.missing.fromFirst", { date: day(start) })}
          </Button>
        )}
        {onBase !== undefined && (
          <Button
            variant={startable && onFrom !== undefined ? "ghost" : undefined}
            onClick={() => {
              onBase(base);
            }}
          >
            {t("holdings.missing.inBase", { base })}
          </Button>
        )}
        <ButtonLink
          variant="ghost"
          render={(props) => (
            <Link
              {...props}
              to="/instruments/$code"
              params={{ code: currency }}
            />
          )}
        >
          {t("holdings.missing.record")}
        </ButtonLink>
      </AlertActions>
    </Alert>
  );
}
