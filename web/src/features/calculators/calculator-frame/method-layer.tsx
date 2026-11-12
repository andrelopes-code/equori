import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import { MethodList } from "@/features/calculators/calculator-frame/method-list";
import type { Source } from "@/features/calculators/calculator-frame/method-section";
import { useT } from "@/i18n/i18n-provider";
import { DetailSection } from "@/ui/dialogs/detail-section";
import layer from "@/ui/dialogs/detail-dialog.module.css";

interface MethodLayerProps {
  steps: readonly string[];
  formula: readonly string[];
  assumptions: readonly string[];
  limits: readonly string[];
  sources: readonly Source[];
  notes: readonly string[];
}

// The body of the method layer (L4): the steps and the formula in the main area, the
// assumptions, the limits and the sources in the aside.
export function MethodLayer({
  steps,
  formula,
  assumptions,
  limits,
  sources,
  notes,
}: MethodLayerProps) {
  const t = useT();

  return (
    <div className={layer.split}>
      <div className={layer.main}>
        <Stack gap={6}>
          <DetailSection title={t("calc.method.steps")}>
            <Stack gap={3}>
              <MethodList lines={steps} ordered />

              {notes.map((line) => (
                <Text key={line} size="sm" tone="muted" wrap="pretty">
                  {line}
                </Text>
              ))}
            </Stack>
          </DetailSection>

          <DetailSection title={t("calc.method.formula")}>
            <div className={styles.formula}>
              {formula.map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </div>
          </DetailSection>
        </Stack>
      </div>

      <div className={layer.aside}>
        <Stack gap={6}>
          <DetailSection title={t("calc.method.assumptions")}>
            <MethodList lines={assumptions} />
          </DetailSection>

          <DetailSection title={t("calc.method.limits")}>
            <MethodList lines={limits} />
          </DetailSection>

          <DetailSection title={t("calc.method.sources")}>
            <Stack gap={2}>
              {sources.map((s) => (
                <Text key={s.url} size="sm">
                  <Link href={s.url} external>
                    {s.title}
                  </Link>
                </Text>
              ))}
            </Stack>
          </DetailSection>
        </Stack>
      </div>
    </div>
  );
}
