import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { AccountDraft } from "@/features/accounts/model/account-draft";
import {
  defaultCashMode,
  type CashMode,
} from "@/features/accounts/model/cash-mode";
import { institutionsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface CashModeFieldProps {
  draft: AccountDraft;
  accounts: readonly Account[];
  base: string;
  onChange: (mode: CashMode) => void;
}

// BC16: where the money of a brokerage is, asked once the institution is chosen. Without an
// account of the institution to pay from, only the brokerage itself holds it, so the field
// states that and offers no choice.
export function CashModeField({
  draft,
  accounts,
  base,
  onChange,
}: CashModeFieldProps) {
  const t = useT();
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));

  const chosen = draft.institutionId ?? draft.pendingInstitution;
  if (draft.kind !== "brokerage" || chosen === null) return null;

  const institution =
    draft.pendingInstitution?.name ??
    institutions.data?.find((i) => i.id === draft.institutionId)?.name ??
    "";
  const ownOnly =
    defaultCashMode(accounts, draft.institutionId, base) === "own";

  return (
    <FieldGroup necessity="none">
      <FieldGroupLegend>{t("accountForm.cashMode.label")}</FieldGroupLegend>
      <FieldGroupContent>
        {ownOnly ? (
          <Text>{t("accountForm.cashMode.ownOnly", { institution })}</Text>
        ) : (
          <RadioGroup
            name="cash_mode"
            value={draft.cashMode}
            onValueChange={(next) => {
              if (next === "institution" || next === "own") onChange(next);
            }}
          >
            <Radio value="institution">
              {t("accountForm.cashMode.institution", { institution })}
            </Radio>
            <Radio value="own">{t("accountForm.cashMode.own")}</Radio>
          </RadioGroup>
        )}
      </FieldGroupContent>
    </FieldGroup>
  );
}
