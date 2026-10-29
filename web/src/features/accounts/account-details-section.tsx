import { Checkbox } from "@slotted/react/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { AccountCurrencyField } from "@/features/accounts/account-currency-field";
import type { AccountDraft } from "@/features/accounts/account-draft";
import { liquidCapable, yieldCapable } from "@/features/accounts/account-kinds";
import type { Kind } from "@/features/accounts/account-kinds";
import { ParentField } from "@/features/accounts/parent-field";
import { useT } from "@/i18n/i18n-provider";
import { ColorSwatches } from "@/ui/color-swatches";
import { DateInput } from "@/ui/date-input";
import { FormSection } from "@/ui/form-section";

type Account = components["schemas"]["Account"];

interface AccountDetailsSectionProps {
  mode: "create" | "edit";
  kind: Kind;
  draft: AccountDraft;
  onPatch: (patch: Partial<AccountDraft>) => void;
  parents: readonly Account[];
  accounts: readonly Account[];
  currencies: readonly string[];
  errors: Record<string, string>;
}

// How the account is counted: its currency, its start, its parent, its yield and its colour.
export function AccountDetailsSection({
  mode,
  kind,
  draft,
  onPatch,
  parents,
  accounts,
  currencies,
  errors,
}: AccountDetailsSectionProps) {
  const t = useT();

  const parentName = parents.find((a) => a.id === draft.parentId)?.name;

  return (
    <FormSection legend={t("accountForm.details")}>
      <AccountCurrencyField
        mode={mode}
        value={draft.currency}
        currencies={currencies}
        onChange={(currency) => {
          onPatch({ currency });
        }}
        error={errors.currency}
      />

      {mode === "create" && (
        <Field invalid={errors.opened_on !== undefined}>
          <FieldLabel>{t("accountForm.openedOn")}</FieldLabel>
          <DateInput
            name="opened_on"
            value={draft.openedOn}
            onChange={(openedOn) => {
              onPatch({ openedOn });
            }}
          />
          {errors.opened_on !== undefined && (
            <FieldError>{errors.opened_on}</FieldError>
          )}
          <FieldDescription>{t("accountForm.openedOnHint")}</FieldDescription>
        </Field>
      )}

      <Field invalid={errors.parent_id !== undefined}>
        <FieldLabel>{t("accountForm.parent")}</FieldLabel>
        <ParentField
          candidates={parents}
          accounts={accounts}
          value={draft.parentId}
          invalid={errors.parent_id !== undefined}
          onChange={(parentId) => {
            onPatch({ parentId });
          }}
        />
        {errors.parent_id !== undefined && (
          <FieldError>{errors.parent_id}</FieldError>
        )}
        <FieldDescription live="polite">
          {parentName === undefined
            ? t("accountForm.parentNone")
            : t("accountForm.parentInside", { name: parentName })}
        </FieldDescription>
      </Field>

      {yieldCapable(kind) && (
        <Checkbox
          checked={draft.yieldAuto}
          onCheckedChange={(yieldAuto) => {
            onPatch({ yieldAuto });
          }}
          description={t("accountForm.yieldHint")}
        >
          {t("accountForm.yield")}
        </Checkbox>
      )}

      {mode === "edit" && liquidCapable(kind) && (
        <Checkbox
          checked={draft.excludedFromLiquidity}
          onCheckedChange={(excludedFromLiquidity) => {
            onPatch({ excludedFromLiquidity });
          }}
          description={t("accountForm.excludeFromLiquidityHint")}
        >
          {t("accountForm.excludeFromLiquidity")}
        </Checkbox>
      )}

      <Field invalid={errors.color !== undefined}>
        <FieldLabel>{t("accountForm.color")}</FieldLabel>
        <ColorSwatches
          name="color"
          label={t("accountForm.color")}
          value={draft.color}
          onChange={(color) => {
            onPatch({ color });
          }}
        />
        <FieldDescription>{t("accountForm.colorHint")}</FieldDescription>
      </Field>
    </FormSection>
  );
}
