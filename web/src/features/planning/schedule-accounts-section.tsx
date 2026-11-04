import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { CategoryPicker } from "@/features/categories";
import {
  takesCategory,
  type ScheduleDraft,
} from "@/features/planning/schedule-draft";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { AccountField, PayeeField } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";

interface ScheduleAccountsSectionProps {
  draft: ScheduleDraft;
  patch: (change: Partial<ScheduleDraft>) => void;
  errors: Record<string, string>;
}

// The payee, the account and the counterpart of a schedule.
export function ScheduleAccountsSection({
  draft,
  patch,
  errors,
}: ScheduleAccountsSectionProps) {
  const t = useT();
  const api = useApi();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const settings = useQuery(settingsQuery(api));
  const currency = settings.data?.base_currency;
  const income = draft.kind === "income";
  const category = takesCategory(draft.kind);

  return (
    <>
      {category && (
        <Field>
          <FieldLabel>{t("schedule.payee")}</FieldLabel>
          <PayeeField
            payees={payees.data ?? []}
            value={draft.payeeID}
            onChange={(payeeID) => {
              patch({ payeeID });
            }}
          />
        </Field>
      )}

      {currency !== undefined && scale !== null && (
        <Field invalid={errors.account_id !== undefined} required>
          <FieldLabel>{t("schedule.account")}</FieldLabel>
          <AccountField
            name="account"
            title={t("schedule.account")}
            accounts={accounts.data ?? []}
            value={draft.accountID}
            exclude={category ? null : draft.counterpartID}
            amount={draft.amount}
            direction={income ? "in" : "out"}
            date={draft.recurrence.start}
            categoryId={category ? draft.counterpartID : null}
            payeeId={category ? draft.payeeID : null}
            kind={income ? "income" : category ? "expense" : "transfer"}
            currency={currency}
            scale={scale}
            onChange={(accountID) => {
              patch({ accountID });
            }}
          />
          {errors.account_id !== undefined && (
            <FieldError>{errors.account_id}</FieldError>
          )}
        </Field>
      )}

      <Field invalid={errors.counterpart_id !== undefined} required>
        <FieldLabel>
          {t(category ? "schedule.category" : "schedule.to")}
        </FieldLabel>
        {category ? (
          <CategoryPicker
            aria-label={t("schedule.category")}
            value={draft.counterpartID}
            amount={income ? 1 : -1}
            invalid={errors.counterpart_id !== undefined}
            onChange={(counterpartID) => {
              patch({ counterpartID });
            }}
          />
        ) : (
          currency !== undefined &&
          scale !== null && (
            <AccountField
              name="to"
              title={t("schedule.to")}
              accounts={accounts.data ?? []}
              value={draft.counterpartID}
              exclude={draft.accountID}
              amount={draft.amount}
              direction="in"
              date={draft.recurrence.start}
              categoryId={null}
              payeeId={null}
              kind="transfer"
              currency={currency}
              scale={scale}
              onChange={(counterpartID) => {
                patch({ counterpartID });
              }}
            />
          )
        )}

        {errors.counterpart_id !== undefined && (
          <FieldError>{errors.counterpart_id}</FieldError>
        )}
      </Field>
    </>
  );
}
