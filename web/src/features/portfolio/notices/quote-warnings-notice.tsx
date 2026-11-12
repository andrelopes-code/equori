import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
} from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";
import { Link } from "@tanstack/react-router";

import { useQuoteWarnings } from "@/features/portfolio/notices/use-quote-warnings";
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
  const warnings = useQuoteWarnings(date, valueIn);
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
