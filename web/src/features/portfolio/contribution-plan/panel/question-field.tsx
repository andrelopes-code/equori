import { FieldError, Field } from "@slotted/react/field";
import { Textarea } from "@slotted/react/textarea";

import { useSavedField } from "@/features/portfolio/contribution-plan/panel/use-saved-field";
import { useT } from "@/i18n/i18n-provider";

interface QuestionFieldProps {
  question: string;
  // The other criteria of the group.
  others: readonly string[];
  onQuestion: (question: string) => void;
}

const maxLength = 200;

// The text of an own criterion at its whole length. A blank text goes back to the stored one; a repeated
// one is marked and not sent (CQ1).
export function QuestionField({
  question,
  others,
  onQuestion,
}: QuestionFieldProps) {
  const t = useT();
  const field = useSavedField(question, (next) => {
    const text = next.trim();

    if (text !== "" && !repeats(text, others)) onQuestion(text);

    return text !== "";
  });

  const repeated = repeats(field.value, others);

  return (
    <Field necessity="none" invalid={repeated}>
      <Textarea
        autoSize
        rows={1}
        resize="none"
        maxLength={maxLength}
        aria-label={t("contributionPlan.panel.question")}
        value={field.value}
        onChange={(event) => {
          field.onChange(event.currentTarget.value);
        }}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />

      {repeated && (
        <FieldError>{t("contributionPlan.panel.repeated")}</FieldError>
      )}
    </Field>
  );
}

function repeats(text: string, others: readonly string[]): boolean {
  const key = text.trim().toLowerCase();

  return others.some((other) => other.trim().toLowerCase() === key);
}
