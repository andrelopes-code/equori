import type { AccountChoice } from "@/features/transactions/use-account-choices";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";
import { withValue } from "@/ui/with-value";

// "Checking · balance R$ 4,312.10", "Credit card · free limit R$ 3,157.23": the kind, then the
// figure the kind is chosen by, when the application holds it.
export function AccountDetail({
  choice,
  scale,
}: {
  choice: AccountChoice;
  scale: number;
}) {
  const t = useT();
  const { account } = choice;
  const money = (amount: number) => (
    <MoneyFigure amount={amount} currency={account.currency} scale={scale} />
  );
  const kind =
    account.kind === undefined
      ? undefined
      : t(`kind.${account.kind}` as MessageKey);
  const figure =
    choice.group === "cards"
      ? choice.freeLimit === undefined
        ? null
        : withValue(
            t("accountChoice.detail.freeLimit"),
            "{amount}",
            money(choice.freeLimit),
          )
      : choice.balance === undefined || account.class !== "asset"
        ? null
        : withValue(
            t("accountChoice.detail.balance"),
            "{amount}",
            money(choice.balance),
          );
  if (kind === undefined && figure === null) return null;
  return (
    <>
      {kind}
      {kind !== undefined && figure !== null && " · "}
      {figure}
    </>
  );
}
