import { MethodLayer } from "@/features/calculators/calculator-frame/method-layer";
import { useT } from "@/i18n/i18n-provider";
import { DetailDialog } from "@/ui/dialogs/detail-dialog";

export interface Source {
  title: string;
  url: string;
}

interface MethodSectionProps {
  steps: readonly string[];
  formula: readonly string[];
  assumptions: readonly string[];
  limits: readonly string[];
  sources: readonly Source[];
  // Words that follow the steps unnumbered, such as a regional name of the method.
  notes?: readonly string[];
}

// "How it is calculated" (design §4, "Explanation"; DL1, L4): the summary line and the button
// sit in the page, and the steps, the formula, the assumptions, the limits and the sources
// open in a layer. The reader comes for the result, and the method is its reference.
export function MethodSection({
  steps,
  formula,
  assumptions,
  limits,
  sources,
  notes = [],
}: MethodSectionProps) {
  const t = useT();

  return (
    <DetailDialog
      title={t("calc.method")}
      description={t("calc.method.layer.description")}
      summary={t("calc.method.description")}
      triggerLabel={t("calc.method.open")}
    >
      <MethodLayer
        steps={steps}
        formula={formula}
        assumptions={assumptions}
        limits={limits}
        sources={sources}
        notes={notes}
      />
    </DetailDialog>
  );
}
