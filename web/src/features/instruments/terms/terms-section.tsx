import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accruedBp } from "@/features/instruments/terms/accrual";
import { latestPriceQuery } from "@/features/instruments/api";
import { formatPercentBp } from "@/features/instruments/terms/basis-points";
import { dayCountLabel } from "@/features/instruments/model/instrument-labels";
import { TermProgress } from "@/features/instruments/terms/term-progress";
import { usePriceFormat } from "@/features/instruments/model/use-price-format";
import { indexName } from "@/features/calculators";
import { calendarLabel } from "@/features/planning";
import { useScale } from "@/features/setup";
import { formatDate, formatSignedBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

type Terms = components["schemas"]["FixedIncomeTerms"];

interface TermsSectionProps {
  code: string;
  terms: Terms | null;
  quote: string;
}

// The terms the accrual of prices reads, how far the term has run, and the note that none are set.
export function TermsSection({ code, terms, quote }: TermsSectionProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const price = usePriceFormat(quote);
  const latest = useQuery({
    ...latestPriceQuery(api, code, quote, today),
    enabled: terms !== null,
  }).data;
  const rows: [string, string][] =
    terms === null || scale === null
      ? []
      : [
          [t("terms.issuedOn"), formatDate(terms.issued_on, locale)],
          [t("terms.maturesOn"), formatDate(terms.matures_on, locale)],
          [t("terms.index"), indexName(terms.index_id ?? "")],
          [
            t("terms.percentOfIndex"),
            formatPercentBp(terms.percent_of_index_bp, locale),
          ],
          [t("terms.spread"), formatPercentBp(terms.spread_bp, locale)],
          [t("terms.dayCount"), dayCountLabel(t, terms.day_count)],
          [
            t("terms.calendar"),
            terms.calendar_id === undefined
              ? ""
              : calendarLabel(t, terms.calendar_id),
          ],
          [
            t("terms.liquidity"),
            t(
              terms.daily_liquidity
                ? "terms.liquidity.daily"
                : "terms.liquidity.atMaturity",
            ),
          ],
          [
            t("terms.redeemableFrom"),
            terms.redeemable_from === undefined
              ? ""
              : formatDate(terms.redeemable_from, locale),
          ],
          [
            t("terms.faceValue"),
            fmt.money(
              { amount: terms.face_value, currency: quote },
              scale(quote),
            ),
          ],
        ];
  const accrued =
    terms === null || scale === null || latest == null
      ? null
      : accruedBp(terms.face_value, scale(quote), latest.value);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("terms.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={3}>
          {terms === null ? (
            <Text tone="muted">{t("terms.none")}</Text>
          ) : (
            <>
              <TermProgress terms={terms} />
              {accrued !== null && latest != null && (
                <Text size="sm" tone="muted">
                  {t("terms.accrued", {
                    price: price.text(latest.value),
                    percent: fmt.hidden
                      ? MASK
                      : formatSignedBasisPoints(accrued, locale),
                  })}
                </Text>
              )}
              <DescriptionList variant="ruled" aria-label={t("terms.facts")}>
                {rows
                  .filter(([, value]) => value !== "")
                  .map(([term, value]) => (
                    <DescriptionListItem key={term}>
                      <DescriptionListTerm>{term}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {value}
                      </DescriptionListDescription>
                    </DescriptionListItem>
                  ))}
              </DescriptionList>
            </>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
