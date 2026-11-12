import { Field, FieldDescription, FieldError } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { AccountField } from "@/features/transactions/account-field/account-field";
import { InstrumentField } from "@/features/transactions/brokerage-account/instrument-field";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FieldTitle } from "@/ui/form-fields/field-title";

type Account = components["schemas"]["Account"];
type Position = components["schemas"]["Position"];

interface BrokerageFieldsProps {
  brokerages: readonly Account[];
  brokerage: Account | undefined;
  instrument: string | null;
  // The position of the chosen investment in the brokerage, drawn under the field of a purchase.
  held?: Position | undefined;
  // The codes the brokerage holds, for a sale; null for a purchase and an income.
  heldCodes: readonly string[] | null;
  cash: readonly Account[];
  cashAccount: Account | undefined;
  // Minor units of the base currency; undefined until the balance loads.
  balance: number | undefined;
  base: string | undefined;
  date: string;
  // Whether money leaves the cash account (a purchase) or enters it.
  money: "out" | "in";
  errors: Record<string, string>;
  scale: (code: string) => number;
  onBrokerage: (id: string) => void;
  onInstrument: (code: string | null) => void;
  onCash: (id: string) => void;
}

// The brokerage, the investment and the cash account of a trade or an income. No holding account
// is shown: the server creates it with the first purchase (BC5, BC6).
export function BrokerageFields({
  brokerages,
  brokerage,
  instrument,
  held,
  heldCodes,
  cash,
  cashAccount,
  balance,
  base,
  date,
  money,
  errors,
  scale,
  onBrokerage,
  onInstrument,
  onCash,
}: BrokerageFieldsProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const currency = base ?? "";
  const line = money === "out" ? "trade.paidFrom" : "trade.receivedIn";

  return (
    <>
      <Field required invalid={errors.brokerage_id !== undefined}>
        <FieldTitle label={t("trade.brokerage")} />
        <AccountField
          compact
          name="brokerage"
          title={t("trade.brokerage")}
          context={t("trade.brokerage")}
          accounts={brokerages}
          value={brokerage?.id ?? null}
          exclude={null}
          amount={0}
          direction={money === "out" ? "in" : "out"}
          date={date}
          categoryId={null}
          payeeId={null}
          kind="transfer"
          currency={brokerage?.currency ?? currency}
          scale={scale}
          onChange={onBrokerage}
        />
        {errors.brokerage_id !== undefined && (
          <FieldError>{errors.brokerage_id}</FieldError>
        )}
      </Field>

      <Field required invalid={errors.instrument !== undefined}>
        <FieldTitle label={t("trade.investment")} />
        <InstrumentField
          value={instrument}
          heldCodes={heldCodes}
          invalid={errors.instrument !== undefined}
          onChange={onInstrument}
        />
        {held !== undefined && instrument !== null && (
          <FieldDescription>
            {t("trade.held", {
              quantity: fmt.number(held.quantity, scale(instrument)),
              code: instrument,
            })}
          </FieldDescription>
        )}
        {errors.instrument !== undefined && (
          <FieldError>{errors.instrument}</FieldError>
        )}
      </Field>

      {cash.length === 1 && cashAccount !== undefined && (
        <Field>
          <FieldDescription>
            {t(line, {
              name: cashAccount.name,
              balance:
                balance === undefined
                  ? ""
                  : fmt.money({ amount: balance, currency }, scale(currency)),
            })}
          </FieldDescription>
        </Field>
      )}

      {cash.length > 1 && (
        <Field required invalid={errors.cash_account_id !== undefined}>
          <FieldTitle
            label={t("trade.cashAccount")}
            help={t("trade.cashAccountHelp")}
          />
          <AccountField
            compact
            name="cash"
            title={t("trade.cashAccount")}
            context={t("trade.cashAccountContext", { currency })}
            accounts={cash}
            value={cashAccount?.id ?? null}
            exclude={null}
            amount={0}
            direction={money}
            date={date}
            categoryId={null}
            payeeId={null}
            kind="transfer"
            currency={currency}
            scale={scale}
            onChange={onCash}
          />
          {errors.cash_account_id !== undefined && (
            <FieldError>{errors.cash_account_id}</FieldError>
          )}
        </Field>
      )}
    </>
  );
}
