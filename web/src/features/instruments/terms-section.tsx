import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { formatPercentBp } from "@/features/instruments/basis-points";
import { dayCountLabel } from "@/features/instruments/instrument-labels";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Terms = components["schemas"]["FixedIncomeTerms"];

// The terms the accrual of prices reads, or the note that none are set.
export function TermsSection({
  terms,
  quote,
}: {
  terms: Terms | null;
  quote: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const rows: [string, string][] =
    terms === null || scale === null
      ? []
      : [
          [t("terms.issuedOn"), formatDate(terms.issued_on, locale)],
          [t("terms.maturesOn"), formatDate(terms.matures_on, locale)],
          [t("terms.index"), terms.index_id ?? ""],
          [
            t("terms.percentOfIndex"),
            formatPercentBp(terms.percent_of_index_bp, locale),
          ],
          [t("terms.spread"), formatPercentBp(terms.spread_bp, locale)],
          [t("terms.dayCount"), dayCountLabel(t, terms.day_count)],
          [
            t("terms.faceValue"),
            fmt.money(
              { amount: terms.face_value, currency: quote },
              scale(quote),
            ),
          ],
        ];
  return (
    <Stack gap={3}>
      <Heading level={2} size="md">
        {t("terms.title")}
      </Heading>
      {terms === null ? (
        <Text tone="muted">{t("terms.none")}</Text>
      ) : (
        <DescriptionList layout="stack" aria-label={t("terms.facts")}>
          {rows
            .filter(([, value]) => value !== "")
            .map(([term, value]) => (
              <DescriptionListItem key={term}>
                <DescriptionListTerm>{term}</DescriptionListTerm>
                <DescriptionListDescription>{value}</DescriptionListDescription>
              </DescriptionListItem>
            ))}
        </DescriptionList>
      )}
    </Stack>
  );
}
