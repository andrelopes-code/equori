import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { cx } from "@/ui/cx";
import { HelpTip } from "@/ui/display/help-tip";
import { useAmountTone } from "@/ui/money/amount-tone";

import { originParts } from "@/features/portfolio/return-money/origin-parts";
import { returnMoney } from "@/features/portfolio/return-money/return-money";
import styles from "@/features/portfolio/return-money/return-money-panel.module.css";

type ReturnReport = components["schemas"]["ReturnReport"];

const rowKeys = ["opening", "deposits", "gain", "closing"] as const;

const partStyle = {
  opening: styles.opening,
  deposits: styles.deposits,
  gain: styles.gainPart,
} as const;

interface ReturnMoneyPanelProps {
  report: ReturnReport;
}

// RK3, RK4: where the closing balance came from. One bar splits it into the opening balance, the
// net deposits and the gain; the list states each amount once, with its definition (return
// honesty HR6), and its swatches are the legend of the bar. The bar is aria-hidden because the
// list states every amount as text.
//
// Build-own-element: no family draws a whole split in parts as lengths (OE-11 of the Slotted
// guidelines). Families read: progress-indicator, whose role and end mark state a task under way,
// and chart, which draws series against an axis.
export function ReturnMoneyPanel({ report }: ReturnMoneyPanelProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amountTone = useAmountTone();

  const result = returnMoney(report);
  if (result === undefined) return null;

  const { currency, gain } = result;
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale?.(currency) ?? 0);
  const rows = rowKeys.filter((key) => key !== "deposits" || result.hasFlows);
  const gainTone = amountTone("result", gain < 0 ? "out" : "none");
  const parts = originParts(result);
  const swatchOf = (key: (typeof rowKeys)[number]) =>
    key !== "closing" && parts?.some((part) => part.key === key)
      ? partStyle[key]
      : undefined;

  return (
    <div className={styles.origin} data-return="origin">
      <div className={styles.originHead}>
        <Text weight="semibold">{t("return.origin.title")}</Text>
      </div>

      {parts !== undefined && (
        <div className={styles.originBar} aria-hidden="true">
          {parts.map((part) => (
            <div
              key={part.key}
              data-segment={part.key}
              className={cx(styles.originSegment, partStyle[part.key])}
              style={{ flexGrow: part.amount }}
            />
          ))}
        </div>
      )}

      <DescriptionList variant="ruled">
        {rows.map((key) => (
          <DescriptionListItem key={key}>
            <DescriptionListTerm>
              {parts !== undefined && (
                <span
                  className={cx(styles.swatch, swatchOf(key))}
                  aria-hidden="true"
                />
              )}
              {t(`return.money.${key}`)}
              <HelpTip
                label={t("return.help.about", {
                  term: t(`return.money.${key}`),
                })}
                text={t(`return.help.${key}`)}
              />
            </DescriptionListTerm>
            <DescriptionListDescription>
              <Text
                size="sm"
                align="end"
                numeric="tabular"
                tone={key === "gain" ? gainTone : "inherit"}
              >
                {money(result[key])}
              </Text>
            </DescriptionListDescription>
          </DescriptionListItem>
        ))}
      </DescriptionList>
    </div>
  );
}
