import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";
import type { CardFaceProps } from "@/ui/card-face/card-face";
import { ArtPicker } from "@/ui/card-face/studio/art-picker";
import styles from "@/ui/card-face/studio/card-face-studio.module.css";
import { ColorStep } from "@/ui/card-face/studio/color-step";
import { faceProps } from "@/ui/card-face/studio/face-draft";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import { FinishOptions } from "@/ui/card-face/studio/finish-options";
import {
  artOptions,
  chipOptions,
  orientationOptions,
} from "@/ui/card-face/studio/studio-labels";
import { StudioPlate } from "@/ui/card-face/studio/studio-plate";
import { StudioStage } from "@/ui/card-face/studio/studio-stage";
import { StudioStep } from "@/ui/card-face/studio/studio-step";

export interface CardFaceStudioProps {
  value: FaceDraft;
  onChange: (next: FaceDraft) => void;
  suggested: string;
  preview: CardFaceProps;
}

const separator = " · ";

// A controlled editor: the host owns the draft and the actions. Two columns from 720 px of the
// studio's own width (stage and plate, then the steps), one column below it.
export function CardFaceStudio({
  value,
  onChange,
  suggested,
  preview,
}: CardFaceStudioProps) {
  const t = useT();
  const color = (value.color ?? suggested).toLowerCase();
  const face = { ...preview, ...faceProps(value, suggested) };
  const artLabel = artOptions.find(({ key }) => key === (value.art ?? "plain"));
  const chipLabel = chipOptions.find(
    ({ key }) => key === (value.chip ?? "gold"),
  );
  const orientationLabel = orientationOptions.find(
    ({ key }) => key === (value.orientation ?? "horizontal"),
  );

  function handlePatch(patch: Partial<FaceDraft>) {
    onChange({ ...value, ...patch });
  }

  function handleArt(art: string) {
    handlePatch({ art });
  }

  return (
    <div className={styles.studio}>
      <div className={styles.layout}>
        <div className={styles.side}>
          <StudioStage face={face} />

          <StudioPlate color={color} art={value.art} />
        </div>

        <div className={styles.steps}>
          <ColorStep
            value={value}
            suggested={suggested}
            onPatch={handlePatch}
          />

          <StudioStep
            number={2}
            title={t("cardFace.studio.art")}
            value={
              <Text weight="semibold">
                {t(artLabel?.label ?? "cardFace.art.plain")}
              </Text>
            }
          >
            <ArtPicker
              art={value.art}
              color={color}
              chip={value.chip ?? "gold"}
              onPick={handleArt}
            />
          </StudioStep>

          <StudioStep
            number={3}
            title={t("cardFace.studio.finish")}
            value={
              <Text weight="semibold">
                {t(chipLabel?.label ?? "cardFace.studio.chip.gold")}
                {separator}
                {t(
                  orientationLabel?.label ??
                    "cardFace.studio.orientation.horizontal",
                )}
              </Text>
            }
          >
            <FinishOptions value={value} onPatch={handlePatch} />
          </StudioStep>
        </div>
      </div>
    </div>
  );
}
