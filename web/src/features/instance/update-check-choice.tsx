import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupDescription,
  FieldGroupError,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { Radio, RadioGroup } from "@slotted/react/radio-group";

import { useT } from "@/i18n/i18n-provider";

interface UpdateCheckChoiceProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  error?: string;
}

// The consent to the daily version check: a question with two answers and no default (A159.1).
export function UpdateCheckChoice({
  value,
  onChange,
  error,
}: UpdateCheckChoiceProps) {
  const t = useT();

  return (
    <FieldGroup required {...(error === undefined ? {} : { invalid: true })}>
      <FieldGroupLegend>{t("about.updateCheck.question")}</FieldGroupLegend>
      <FieldGroupDescription>
        {t("about.updateCheck.help")}
      </FieldGroupDescription>
      {error !== undefined && <FieldGroupError>{error}</FieldGroupError>}
      <FieldGroupContent>
        <RadioGroup
          name="update_check"
          value={answerOf(value)}
          onValueChange={(next) => {
            onChange(next === "yes");
          }}
        >
          <Radio value="yes">{t("about.updateCheck.yes")}</Radio>
          <Radio value="no">{t("about.updateCheck.no")}</Radio>
        </RadioGroup>
      </FieldGroupContent>
    </FieldGroup>
  );
}

function answerOf(value: boolean | null): string {
  if (value === null) return "";
  return value ? "yes" : "no";
}
