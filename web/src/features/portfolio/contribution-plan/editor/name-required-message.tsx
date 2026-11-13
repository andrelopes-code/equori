import { Field, FieldError } from "@slotted/react/field";

import { useT } from "@/i18n/i18n-provider";

interface NameRequiredMessageProps {
  shown: boolean;
}

const fieldId = "contribution-plan-name";

// The identifier the Field derives for its FieldError.
export const nameRequiredId = `${fieldId}-error`;

// One line above the editor rows: the name inputs left blank point at it with aria-describedby.
export function NameRequiredMessage({ shown }: NameRequiredMessageProps) {
  const t = useT();

  if (!shown) return null;

  return (
    <Field id={fieldId} invalid>
      <FieldError>{t("contributionPlan.nameRequired")}</FieldError>
    </Field>
  );
}
