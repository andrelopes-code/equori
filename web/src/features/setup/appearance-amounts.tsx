import { StudioChoice } from "@/features/setup/studio-choice";
import { StudioSection } from "@/features/setup/studio-section";
import { useT } from "@/i18n/i18n-provider";
import { amountToneModes, useAmountToneMode } from "@/theme/amounts";

export function AppearanceAmounts() {
  const t = useT();
  const [mode, setMode] = useAmountToneMode();

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
    </StudioSection>
  );
}
