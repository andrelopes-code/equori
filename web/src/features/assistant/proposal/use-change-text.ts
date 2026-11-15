import type { components } from "@/api/schema.gen";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useValueText } from "@/features/assistant/proposal/use-value-text";
import { useT } from "@/i18n/i18n-provider";

type Value = components["schemas"]["AssistantValue"];

// The text of one value of a change: a status the tools write as a code word ("needs_review",
// "open difference") reads from the catalogue, any other value as useValueText writes it
// (spec 2026-11-15, section 7).
export function useChangeText() {
  const t = useT();
  const valueText = useValueText();

  return (field: string, value: Value | undefined): string | undefined => {
    const text = value?.text;

    if (field === "status" && text !== undefined) {
      const key = catalogKey(
        `assistant.value.${text.trim().toLowerCase().replace(/\s+/g, "_")}`,
      );

      if (key !== undefined) return t(key);
    }

    return valueText(value);
  };
}
