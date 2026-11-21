import type { components } from "@/api/schema.gen";
import { usePropertyFigures } from "@/features/accounts/kind-figures/use-property-figures";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

type Account = components["schemas"]["Account"];

interface PropertyFiguresProps {
  account: Account;
  scale: number;
}

// The figures of a property: what it is worth, what it gained or lost since its purchase, and
// the part of it that is the owner's once the loans that financed it are paid (K1 to K4).
export function PropertyFigures({ account, scale }: PropertyFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { value, bought, change, financing, valuedOn, loading } =
    usePropertyFigures(account);

  const currency = account.currency;
  const amount = (n: number) => ({ money: { amount: n, currency }, scale });
  const money = (n: number) => fmt.money({ amount: n, currency }, scale);
  const own =
    financing === undefined || value === undefined
      ? undefined
      : value - financing.debt;

  return (
    <FigureGrid label={t("property.figures")}>
      <FigureCard
        label={t("property.value")}
        value={value === undefined ? undefined : amount(value)}
        note={
          valuedOn === undefined
            ? t("property.neverValued")
            : t("property.valuedOn", { date: formatDate(valuedOn, locale) })
        }
        loading={loading}
      />
      <FigureCard
        label={t("property.change")}
        value={change === undefined ? undefined : amount(change.amount)}
        delta={change?.fraction}
        note={
          bought === undefined
            ? t("property.noPurchase")
            : t("property.bought", {
                amount: money(bought.value),
                date: formatDate(bought.date, locale),
              })
        }
        loading={loading}
      />
      {own !== undefined && financing !== undefined && (
        <FigureCard
          label={t("property.own")}
          value={amount(own)}
          note={t("property.ownNote", { debt: money(financing.debt) })}
        />
      )}
    </FigureGrid>
  );
}
