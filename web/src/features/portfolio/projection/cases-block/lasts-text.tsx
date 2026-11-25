import type { PlanCase } from "@/features/portfolio/projection/model/plan-case";
import { useT } from "@/i18n/i18n-provider";
import { Toned } from "@/ui/money/toned";

interface LastsTextProps {
  figures: PlanCase;
  lastAge: number;
}

// PX16, PX21: the age the income lasts to, in the tone of the result; nothing in rate mode.
export function LastsText({ figures, lastAge }: LastsTextProps) {
  const t = useT();

  if (figures.sustains === null) return null;

  return (
    <Toned value={figures.sustains ? 1 : -1}>
      {figures.endAge === null
        ? t("portfolio.projection.cases.lasts", { age: lastAge })
        : t("portfolio.projection.cases.ends", { age: figures.endAge })}
    </Toned>
  );
}
