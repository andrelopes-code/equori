import type { CalculatorId } from "@/features/calculators/calculators";
import { MethodSection } from "@/features/calculators/method-section";
import type { Source } from "@/features/calculators/method-section";
import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

// calc.<id>.<part>1, 2, … up to the first number the catalog does not hold; every language
// holds the keys of catalogEn.
function keys(id: CalculatorId, part: string): MessageKey[] {
  const out: MessageKey[] = [];
  for (let n = 1; ; n++) {
    const key = `calc.${id}.${part}${String(n)}`;
    if (!(key in catalogEn)) return out;
    out.push(key as MessageKey);
  }
}

// The method of a calculator from its numbered catalog keys (step, formula, assumption,
// limit); the question is what it answers.
export function CalculatorMethod({
  id,
  sources,
  noIndexes = false,
}: {
  id: CalculatorId;
  sources: readonly Source[];
  // The calculator reads indexes and the instance stores none (design §4, "Index data").
  noIndexes?: boolean;
}) {
  const t = useT();
  const words = (part: string) => keys(id, part).map((k) => t(k));
  return (
    <MethodSection
      answers={t(`calc.${id}.question`)}
      steps={words("step")}
      formula={words("formula")}
      assumptions={words("assumption")}
      limits={[...words("limit"), ...(noIndexes ? [t("calc.noIndexes")] : [])]}
      sources={sources}
    />
  );
}
