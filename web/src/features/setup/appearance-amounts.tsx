import { StudioChoice } from "@/features/setup/studio-choice";
import { StudioSection } from "@/features/setup/studio-section";
import { useT } from "@/i18n/i18n-provider";
import {
  amountToneModes,
  summaryModes,
  useAmountToneMode,
  useSummaryAmounts,
} from "@/theme/amounts";

export function AppearanceAmounts() {
  const t = useT();
  const [mode, setMode] = useAmountToneMode();
  const [summary, setSummary] = useSummaryAmounts();

  return (
    <StudioSection title={t("studio.amounts")}>
      <StudioChoice
        label={t("studio.amountTone")}
        hint={t("studio.amountTone.hint")}
        values={amountToneModes}
        value={mode}
        text={(v) => t(`studio.amountTone.${v}`)}
        onChange={setMode}
      />

      <StudioChoice
        label={t("studio.summaryAmounts")}
        hint={t("studio.summaryAmounts.hint")}
        values={summaryModes}
        value={summary}
        text={(v) => t(`studio.summaryAmounts.${v}`)}
        onChange={setSummary}
      />
    </StudioSection>
  );
}
