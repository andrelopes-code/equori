import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { AccountField } from "@/features/transactions/account-field";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

// The security account and the cash account of one brokerage. Each field offers only the accounts
// the contract accepts, so a choice never reaches the server to be refused (A68, A70). Both are
// AccountField in its compact form: no amount is known yet, so no option states a consequence.
export function BrokerageAccountFields({
  securities,
  security,
  cashChoices,
  cashAccountId,
  base,
  ready,
  date,
  money,
  errors,
  scale,
  onSecurity,
  onCash,
}: {
  securities: readonly Account[];
  security: Account | undefined;
  cashChoices: readonly Account[];
  cashAccountId: string | null;
  base: string | undefined;
  ready: boolean;
  date: string;
  // Whether money leaves the cash account (a purchase) or enters it.
  money: "out" | "in";
  errors: Record<string, string>;
  scale: (code: string) => number;
  onSecurity: (id: string) => void;
  onCash: (id: string) => void;
}) {
  const t = useT();
  const entering = money === "out" ? "in" : "out";
  return (
    <>
      {ready && securities.length === 0 && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>{t("trade.noSecurityAccount")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <Field invalid={errors.account_id !== undefined}>
        <FieldLabel>{t("trade.securityAccount")}</FieldLabel>
        <AccountField
          compact
          name="security"
          title={t("trade.securityAccount")}
          context={t("trade.securityAccountContext")}
          accounts={securities}
          value={security?.id ?? null}
          exclude={null}
          amount={0}
          direction={entering}
          date={date}
          categoryId={null}
          payeeId={null}
          kind="transfer"
          currency={security?.currency ?? base ?? ""}
          scale={scale}
          onChange={onSecurity}
        />
        {errors.account_id !== undefined && (
          <FieldError>{errors.account_id}</FieldError>
        )}
      </Field>

      <Field invalid={errors.cash_account_id !== undefined}>
        <FieldLabel>{t("trade.cashAccount")}</FieldLabel>
        <AccountField
          compact
          name="cash"
          title={t("trade.cashAccount")}
          context={t("trade.cashAccountContext", { currency: base ?? "" })}
          accounts={cashChoices}
          value={cashAccountId}
          exclude={null}
          amount={0}
          direction={money}
          date={date}
          categoryId={null}
          payeeId={null}
          kind="transfer"
          currency={base ?? ""}
          scale={scale}
          onChange={onCash}
        />
        {security !== undefined && cashChoices.length === 0 && (
          <FieldDescription>
            {t("trade.noCashAccount", { currency: base ?? "" })}
          </FieldDescription>
        )}
        {errors.cash_account_id !== undefined && (
          <FieldError>{errors.cash_account_id}</FieldError>
        )}
      </Field>
    </>
  );
}
