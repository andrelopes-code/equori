import { useT } from "@/i18n/i18n-provider";
import { ColorMixer } from "@/ui/card-face/studio/color-mixer";
import { ColorRack } from "@/ui/card-face/studio/color-rack";
import { ColorValue } from "@/ui/card-face/studio/color-value";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import { StudioStep } from "@/ui/card-face/studio/studio-step";

interface ColorStepProps {
  value: FaceDraft;
  suggested: string;
  onPatch: (patch: Partial<FaceDraft>) => void;
}

export function ColorStep({ value, suggested, onPatch }: ColorStepProps) {
  const t = useT();
  const color = (value.color ?? suggested).toLowerCase();

  function handleColor(hex: string) {
    onPatch({ color: hex });
  }

  function handleRestore() {
    onPatch({ color: null });
  }

  return (
    <StudioStep
      number={1}
      title={t("cardFace.studio.color")}
      value={<ColorValue color={color} suggested={suggested} />}
    >
      <ColorRack color={color} onPick={handleColor} />

      <ColorMixer
        color={color}
        canRestore={value.color !== null}
        onColor={handleColor}
        onRestore={handleRestore}
      />
    </StudioStep>
  );
}
