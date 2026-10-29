import { CustomTypefaceField } from "@/features/setup/custom-typeface-field";
import { oneOf } from "@/features/setup/one-of";
import { StudioSection } from "@/features/setup/studio-section";
import { StudioField } from "@/features/setup/studio-field";
import { TextSizeSlider } from "@/features/setup/text-size-slider";
import { TypefacePreview } from "@/features/setup/typeface-preview";
import { useT } from "@/i18n/i18n-provider";
import { typefaces, useTypeface } from "@/theme/typeface";
import { ChoiceCards } from "@/ui/choice-cards";

export function AppearanceText() {
  const t = useT();
  const [typeface, setTypeface] = useTypeface();

  return (
    <StudioSection title={t("settings.appearance.text")}>
      <StudioField
        label={t("settings.textSize")}
        description={t("settings.textSize.description")}
      >
        <TextSizeSlider />
      </StudioField>
      <StudioField
        label={t("settings.typeface")}
        description={t("settings.typeface.description")}
      >
        <ChoiceCards
          name="typeface"
          label={t("settings.typeface")}
          value={typeface}
          choices={typefaces.map((f) => ({
            value: f,
            label: t(`typeface.${f}`),
            preview: <TypefacePreview typeface={f} />,
          }))}
          onChange={(next) => {
            if (oneOf(typefaces, next)) setTypeface(next);
          }}
        />
        <CustomTypefaceField />
      </StudioField>
    </StudioSection>
  );
}
