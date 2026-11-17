import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";

import { ExposureTracks } from "@/features/portfolio/fixed-income/exposure-tracks-view";
import styles from "@/features/portfolio/fixed-income/fixed-income-panel.module.css";
import { MaturityLadder } from "@/features/portfolio/fixed-income/maturity-ladder-view";
import { maturityLadder } from "@/features/portfolio/fixed-income/maturity-ladder";
import { PaymentsTimeline } from "@/features/portfolio/fixed-income/payments-timeline";
import { returnKind } from "@/features/portfolio/fixed-income/return-kind";
import { ReturnShareBar } from "@/features/portfolio/fixed-income/return-share-bar";
import { returnShares } from "@/features/portfolio/fixed-income/return-shares";
import { useFixedIncomePanel } from "@/features/portfolio/fixed-income/use-fixed-income-panel";
import { fixedIncomeVerdict } from "@/features/portfolio/fixed-income/verdict";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { useScale } from "@/features/setup";
import { formatDate, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface FixedIncomePanelProps {
  holdings: readonly Holding[];
  date: string;
}

// FC36: what the fixed income holdings are, when they return and what is due, one verdict first.
export function FixedIncomePanel({ holdings, date }: FixedIncomePanelProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [locale] = useAppLocale();
  const data = useFixedIncomePanel(holdings, date);

  const currency = data.fixed[0]?.currency;
  if (currency === undefined || scale === null) return null;

  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale(m.currency));
  const total = data.fixed.reduce((sum, h) => sum + h.value, 0);
  const shares = returnShares(data.fixed, data.terms, data.indexes);
  const years = maturityLadder(data.fixed, data.terms, data.indexes);
  const kindOf = new Map(
    data.fixed.map((h) => [
      h.code,
      returnKind(data.terms.get(h.code), data.indexes),
    ]),
  );
  const verdict = fixedIncomeVerdict(data.report, data.events, t, {
    money,
    day: (iso) => formatDayMonthNumeric(iso, locale),
  });

  return (
    <Section size="lg" ground="surface">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.panel")}</SectionHeading>
          <SectionDescription>
            {t("fixedIncome.panel.description", {
              total: money({ amount: total, currency }),
              count: data.fixed.length,
              date: formatDate(date, locale),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        {data.pending && <Skeleton />}

        {!data.pending && (
          <div className={styles.body}>
            {verdict !== null && (
              <div>
                <Text
                  size="xl"
                  weight="semibold"
                  tone={verdict.tone === "danger" ? "danger" : "inherit"}
                >
                  {verdict.line}
                </Text>
                {verdict.detail !== "" && (
                  <Text size="sm" tone="muted">
                    {verdict.detail}
                  </Text>
                )}
              </div>
            )}

            <div className={styles.pair}>
              <ReturnShareBar
                shares={shares}
                currency={currency}
                scale={scale(currency)}
              />

              <MaturityLadder
                years={years}
                currency={currency}
                scale={scale(currency)}
              />
            </div>

            <PaymentsTimeline
              events={data.events}
              names={data.names}
              kindOf={kindOf}
              today={data.today}
              until={data.until}
              scale={scale}
            />

            {data.report.issuers.length > 0 && (
              <ExposureTracks report={data.report} scale={scale} />
            )}
          </div>
        )}
      </SectionBody>
    </Section>
  );
}
