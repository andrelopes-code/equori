import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments";
import { useScale } from "@/features/setup";
import { formatUnits } from "@/features/transactions/action-entry/format-units";
import { actionKindKeys } from "@/features/transactions/action-entry/action-kind";
import { FactItem } from "@/features/transactions/transaction-facts/fact-item";
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
        {t("transaction.facts.actionValue", {
          kind: t(actionKindKeys[action.kind]),
          from: action.ratio_from,
          to: action.ratio_to,
        })}
      </FactItem>
      <FactItem label={t("transaction.facts.received")}>
        {formatUnits(received.amount, scale(received.currency), tag)}
      </FactItem>
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
