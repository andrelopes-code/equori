import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { quoteWarningsQuery } from "@/features/accounts";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface QuoteWarningsNoticeProps {
  date: string;
  valueIn: string | undefined;
}

// MQ41: the holdings with a late or missing quote, in one notice for the page.
export function QuoteWarningsNotice({
  date,
  valueIn,
}: QuoteWarningsNoticeProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const warnings = useQuery({
    ...quoteWarningsQuery(api, date, valueIn),
    enabled: valueIn !== undefined,
  }).data;
  const first = warnings?.[0];

  if (warnings === undefined || first === undefined) return null;

  const key =
    warnings.length === 1
      ? "portfolio.quoteWarnings.one"
      : "portfolio.quoteWarnings.other";

  return (
    <Alert tone="warning">
      <AlertContent>
        <AlertDescription>
          {t(key, { count: numberFormatter(tag).format(warnings.length) })}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <ButtonLink
          render={(props) => (
            <Link
              {...props}
              to="/instruments/$code"
              params={{ code: first.instrument }}
            />
          )}
        >
          {t("portfolio.quoteWarnings.open", { code: first.instrument })}
        </ButtonLink>
      </AlertActions>
    </Alert>
  );
}
