import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { HelpTip } from "@/ui/display/help-tip";
import { useAmountTone } from "@/ui/money/amount-tone";

import { returnMoney } from "@/features/portfolio/return-money/return-money";
import styles from "@/features/portfolio/return/return-view.module.css";

type ReturnReport = components["schemas"]["ReturnReport"];

interface ReturnLeadProps {
  report: ReturnReport;
  // The verdict of the period, or the sentence of the personal rate; absent when neither draws.
  sentence: string | undefined;
  // The definition behind the sentence's help mark; a sentence without one draws no mark.
  help: string | undefined;
}

// RK1: the gain in money leads, beside the sentence that states the return. A report whose
// amounts differ in currency has no gain (RC4) and leads with the sentence alone.
export function ReturnLead({ report, sentence, help }: ReturnLeadProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const amountTone = useAmountTone();

  const money = returnMoney(report);
  if (money === undefined && sentence === undefined) return null;

  return (
    <div className={styles.lead} data-return="lead">
      {money !== undefined && (
        <div className={styles.gain}>
          <Text size="sm" tone="muted">
            {t("return.lead.gain")}
          </Text>
          <Text
            className={styles.gainAmount}
            weight="semibold"
            numeric="tabular"
            tone={amountTone("result", money.gain < 0 ? "out" : "none")}
          >
            {fmt.money(
              { amount: money.gain, currency: money.currency },
              scale?.(money.currency) ?? 0,
            )}
          </Text>
        </div>
      )}

      {sentence !== undefined && (
        <div className={styles.verdict}>
          <Text size="lg" weight="semibold">
            {sentence}
            {help !== undefined && (
              <HelpTip
                label={t("return.help.about", {
                  term: t("holdings.method.period"),
                })}
                text={help}
              />
            )}
          </Text>
        </div>
      )}
    </div>
  );
}
