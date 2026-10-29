import { StudioChoice } from "@/features/setup/studio-choice";
import { StudioSection } from "@/features/setup/studio-section";
import { useT } from "@/i18n/i18n-provider";
import { surfaceSets, useSurface } from "@/theme/surface";

// The grounds, lines and relief a theme holds, and the contrast of secondary text
// (docs/specs/2026-10-29-appearance-studio-design.md, A11 and A12).
export function AppearanceSurfaces() {
  const t = useT();
  const [depth, setDepth] = useSurface("depth");
  const [step, setStep] = useSurface("step");
  const [borders, setBorders] = useSurface("borders");
  const [shadows, setShadows] = useSurface("shadows");
  const [chart, setChart] = useSurface("chart");
  const [contrast, setContrast] = useSurface("contrast");

  return (
    <>
      <StudioSection title={t("studio.section.grounds")}>
        <StudioChoice
          label={t("studio.depth")}
          hint={t("studio.depth.hint")}
          values={surfaceSets.depth}
          value={depth}
          text={(v) => t(`studio.depth.${v}`)}
          onChange={setDepth}
        />
        <StudioChoice
          label={t("studio.step")}
          values={surfaceSets.step}
          value={step}
          text={(v) => t(`studio.step.${v}`)}
          onChange={setStep}
        />
      </StudioSection>

      <StudioSection title={t("studio.section.lines")}>
        <StudioChoice
          label={t("studio.borders")}
          values={surfaceSets.borders}
          value={borders}
          text={(v) => t(`studio.borders.${v}`)}
          onChange={setBorders}
        />
        <StudioChoice
          label={t("studio.shadows")}
          values={surfaceSets.shadows}
          value={shadows}
          text={(v) => t(`studio.shadows.${v}`)}
          onChange={setShadows}
        />
        <StudioChoice
          label={t("studio.chart")}
          values={surfaceSets.chart}
          value={chart}
          text={(v) => t(`studio.chart.${v}`)}
          onChange={setChart}
        />
      </StudioSection>

      <StudioSection title={t("studio.section.reading")}>
        <StudioChoice
          label={t("studio.contrast")}
          hint={t("studio.contrast.hint")}
          values={surfaceSets.contrast}
          value={contrast}
          text={(v) => t(`studio.contrast.${v}`)}
          onChange={setContrast}
        />
      </StudioSection>
    </>
  );
}
