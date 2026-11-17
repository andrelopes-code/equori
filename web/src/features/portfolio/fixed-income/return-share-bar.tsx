import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import kinds from "@/features/portfolio/fixed-income/kind-fill.module.css";
import styles from "@/features/portfolio/fixed-income/return-share-bar.module.css";
import type { ReturnShare } from "@/features/portfolio/fixed-income/return-shares";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";
import { useMoneyFormat } from "@/privacy/use-money-format";

const separator = " · ";

interface ReturnShareBarProps {
  shares: readonly ReturnShare[];
  currency: string;
  scale: number;
}

// Own element: no family draws the parts of a whole in one bar (families read: progress-indicator,
// chart). One data slot and one texture per kind, so the kinds differ without color alone.
export function ReturnShareBar({
  shares,
  currency,
  scale,
}: ReturnShareBarProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();
  const percent = numberFormatter(locale, { style: "percent" });

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.kinds")}</SectionHeading>
          <SectionDescription>
            {t("fixedIncome.kinds.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <div className={styles.bar} aria-hidden="true">
          {shares.map((s) => (
            <span
              key={s.kind}
              className={kinds[s.kind]}
              style={{ flex: s.value }}
            />
          ))}
        </div>

        <DescriptionList variant="ruled">
          {shares.map((s) => (
            <DescriptionListItem key={s.kind}>
              <DescriptionListTerm>
                <i className={[styles.key, kinds[s.kind]].join(" ")} />
                {t(`fixedIncome.kind.${s.kind}`)}
              </DescriptionListTerm>
              <DescriptionListDescription className={styles.value}>
                {[
                  fmt.money({ amount: s.value, currency }, scale),
                  percent.format(s.share / 100),
                ].join(separator)}
              </DescriptionListDescription>
            </DescriptionListItem>
          ))}
        </DescriptionList>
      </SectionBody>
    </Section>
  );
}
