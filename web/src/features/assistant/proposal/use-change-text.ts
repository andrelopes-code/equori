import type { components } from "@/api/schema.gen";
import { changeCodeKey } from "@/features/assistant/proposal/change-code";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Value = components["schemas"]["AssistantValue"];

// The text of one value of a change: a code the tools write ("needs_review", "expense") reads from
// the catalogue, any other value as useValueText writes it (spec 2026-11-15, section 7).
export function useChangeText() {
  const t = useT();
  const valueText = useValueText();

  return (field: string, value: Value | undefined): string | undefined => {
    const text = value?.text;
    const key = text === undefined ? undefined : changeCodeKey(field, text);

    return key === undefined ? valueText(value) : t(key);
  };
}
