import { useQuery } from "@tanstack/react-query";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useApi } from "@/api/api-context";
import { companyFiguresQuery } from "@/features/instruments/api";
import { CompanyFigureGrid } from "@/features/instruments/company-report/company-figure-grid";
import { changeText } from "@/features/instruments/company-report/change-text";
import {
  changeNote,
  multipleNote,
  multipleValue,
} from "@/features/instruments/company-report/multiple-text";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/display/figure-card";

type Figures = components["schemas"]["CompanyFigures"];

interface CompanyMultiplesProps {
  code: string;
}

// The price over earnings and over book value of a company, and the change of its year (AC4 to
// AC8). Draws nothing for an instrument without figures.
export function CompanyMultiples({ code }: CompanyMultiplesProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const figures: Figures | undefined = useQuery(companyFiguresQuery(api, code))
    .data?.[0];

  if (figures === undefined) return null;

  return (
    <Stack gap={4}>
      <CompanyFigureGrid label={t("companyReport.multiples")}>
        <FigureCard
          label={t("companyReport.priceEarnings")}
          value={multipleValue(t, locale, figures.price_earnings)}
          note={multipleNote(
            t,
            locale,
            figures.price_earnings,
            figures.price_earnings_range,
          )}
          goodWhen="none"
        />

        <FigureCard
          label={t("companyReport.priceBook")}
          value={multipleValue(t, locale, figures.price_book)}
          note={multipleNote(
            t,
            locale,
            figures.price_book,
            figures.price_book_range,
          )}
          goodWhen="none"
        />

        <FigureCard
          label={t("companyReport.profit")}
          value={changeText(t, locale, figures.profit)}
          note={changeNote(t, locale, figures.profit)}
          goodWhen="none"
        />

        <FigureCard
          label={t("companyReport.revenue")}
          value={changeText(t, locale, figures.revenue, "revenue")}
          note={changeNote(t, locale, figures.revenue)}
          goodWhen="none"
        />
      </CompanyFigureGrid>

      <Text size="sm" tone="muted">
        {figures.price_date === undefined
          ? t("companyReport.multiples.caution")
          : t("companyReport.multiples.dates", {
              price: formatDate(figures.price_date, locale),
            })}
      </Text>
    </Stack>
  );
}
