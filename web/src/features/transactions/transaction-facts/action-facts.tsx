import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments";
import { useScale } from "@/features/setup";
import { actionKindKeys } from "@/features/transactions/action-entry/action-kind";
import { FactItem } from "@/features/transactions/transaction-facts/fact-item";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type CorporateAction = components["schemas"]["CorporateAction"];

interface ActionFactsProps {
  action: CorporateAction;
}

export function ActionFacts({ action }: ActionFactsProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  if (scale === null) return null;

  const { received, value } = action;

  return (
    <>
      <FactItem label={t("transaction.facts.action")}>
        {action.kind === "unit_tax"
          ? t(actionKindKeys.unit_tax)
          : t("transaction.facts.actionValue", {
              kind: t(actionKindKeys[action.kind]),
              from: action.ratio_from,
              to: action.ratio_to,
            })}
      </FactItem>
      <FactItem label={t("transaction.facts.received")}>
        {fmt.number(received, scale(received.currency))}
      </FactItem>
      {action.new_account_id !== undefined && (
        <FactItem label={t("transaction.facts.newInstrument")}>
          {received.currency}
        </FactItem>
      )}
      {action.cost_bp !== undefined && (
        <FactItem label={t("transaction.facts.costMoved")}>
          {t("transaction.facts.costMovedValue", {
            percent: numberFormatter(tag, { maximumFractionDigits: 2 }).format(
              action.cost_bp / 100,
            ),
          })}
        </FactItem>
      )}
      {action.fraction !== "0" && (
        <FactItem label={t("transaction.facts.fraction")}>
          {formatRate(action.fraction, tag)}
        </FactItem>
      )}
      {value.amount > 0 && (
        <FactItem label={t("transaction.facts.bonusValue")}>
          {fmt.money(value, scale(value.currency))}
        </FactItem>
      )}
    </>
  );
}
