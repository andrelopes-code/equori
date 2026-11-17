import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { exposureTracks } from "@/features/portfolio/fixed-income/exposure-tracks";
import styles from "@/features/portfolio/fixed-income/exposure-tracks.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Report = Pick<
  components["schemas"]["IssuerExposureReport"],
  "issuers" | "guarantee"
>;

interface ExposureTracksProps {
  report: Report;
  scale: (code: string) => number;
}

// Own element: no family draws a value against a limit mark (families read: progress-indicator,
// chart). Three segments per issuer, the limit mark and the figure at the end of the row.
export function ExposureTracks({ report, scale }: ExposureTracksProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const { guarantee } = report;
  const tracks = exposureTracks(report);
  const money = (m: { amount: number; currency: string }) =>
    fmt.money(m, scale(m.currency));
  const used = report.issuers.reduce((s, i) => s + i.covered_value.amount, 0);

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.issuers")}</SectionHeading>
          {guarantee !== undefined && (
            <SectionDescription>
              {t("fixedIncome.issuers.limit", {
                guarantee: guarantee.name,
                amount: money(guarantee.limit_per_issuer),
              })}
            </SectionDescription>
          )}
          {guarantee !== undefined && (
            <SectionDescription>
              {t("fixedIncome.issuers.period", {
                used: money({
                  amount: used,
                  currency: guarantee.limit_per_period.currency,
                }),
                limit: money(guarantee.limit_per_period),
                years: guarantee.period_years,
              })}
            </SectionDescription>
          )}
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <ul className={styles.list}>
          {tracks.map((k, i) => (
            <li key={k.issuer ?? i} className={styles.row}>
              <span className={styles.name}>{k.issuer ?? "—"}</span>
              <div className={styles.track} aria-hidden="true">
                <span
                  className={styles.covered}
                  style={{ left: 0, width: `${String(k.covered)}%` }}
                />
                <span
                  className={styles.excess}
                  style={{
                    left: `${String(k.covered)}%`,
                    width: `${String(k.excess)}%`,
                  }}
                />
                <span
                  className={styles.uncovered}
                  style={{
                    left: `${String(k.covered + k.excess)}%`,
                    width: `${String(k.uncovered)}%`,
                  }}
                />
                {k.limit !== undefined && (
                  <span
                    className={styles.limit}
                    style={{ left: `${String(k.limit)}%` }}
                  />
                )}
              </div>
              <Text
                className={styles.figure}
                tone={
                  k.figure === "excess"
                    ? "danger"
                    : k.figure === "uncovered"
                      ? "muted"
                      : "inherit"
                }
              >
                {k.figure === "excess" &&
                  fmt.signed(k.amount, scale(k.amount.currency))}
                {k.figure === "covered" && t("fixedIncome.issuers.covered")}
                {k.figure === "uncovered" && t("fixedIncome.issuers.uncovered")}
                {k.figure === "value" && money(k.amount)}
              </Text>
            </li>
          ))}
        </ul>

        {guarantee !== undefined && (
          <ul className={styles.legend}>
            <li>
              <i className={[styles.key, styles.covered].join(" ")} />
              {t("fixedIncome.issuers.covered")}
            </li>
            <li>
              <i className={[styles.key, styles.excess].join(" ")} />
              {t("fixedIncome.issuers.excess")}
            </li>
            <li>
              <i className={[styles.key, styles.uncovered].join(" ")} />
              {t("fixedIncome.issuers.uncovered")}
            </li>
            <li>
              <i
                className={[styles.key, styles.keyLimit, styles.limit].join(
                  " ",
                )}
              />
              {t("fixedIncome.issuers.mark")}
            </li>
          </ul>
        )}
      </SectionBody>
    </Section>
  );
}
