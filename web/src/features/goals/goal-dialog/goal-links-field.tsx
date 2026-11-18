import { Field, FieldLabel } from "@slotted/react/field";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { canShare, setLink } from "@/features/goals/model/goal-links";
import type { GoalLink } from "@/features/goals/model/goal-links";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormRow } from "@/ui/form-layout/form-row";
import { MoneyInput } from "@/ui/money/money-input";

type Account = components["schemas"]["Account"];

interface GoalLinksFieldProps {
  links: readonly GoalLink[];
  accounts: readonly Account[];
  scale: (code: string) => number;
  onChange: (links: GoalLink[]) => void;
}

// How the goal holds each account that several goals can share: the whole account, or a part
// of it with the amount to set aside when the goal is saved (planning coherence A255). An
// account that cannot be shared has no row: the goal holds it whole.
export function GoalLinksField({
  links,
  accounts,
  scale,
  onChange,
}: GoalLinksFieldProps) {
  const t = useT();
  const rows = links.flatMap((link) => {
    const account = accounts.find((a) => a.id === link.id);
    return account !== undefined && canShare(account, accounts)
      ? [{ link, account }]
      : [];
  });

  if (rows.length === 0) return null;

  return (
    <Stack gap={4}>
      {rows.map(({ link, account }) => (
        <FormRow key={link.id}>
          <ChoiceSelect
            label={t("goals.link.label", { account: account.name })}
            multiple={false}
            value={link.part ? "part" : "whole"}
            choices={[
              { value: "whole", label: t("goals.link.whole") },
              { value: "part", label: t("goals.link.part") },
            ]}
            onChange={(next) => {
              onChange(setLink(links, link.id, { part: next === "part" }));
            }}
          />

          {link.part && (
            <Field>
              <FieldLabel>{t("goals.link.amount")}</FieldLabel>
              <MoneyInput
                size="field"
                value={link.amount}
                currency={account.currency}
                scale={scale(account.currency)}
                sign="neutral"
                onChange={(amount) => {
                  onChange(setLink(links, link.id, { amount }));
                }}
              />
            </Field>
          )}
        </FormRow>
      ))}
    </Stack>
  );
}
