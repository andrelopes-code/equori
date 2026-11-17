import type { MessageKey } from "@/i18n/catalog.en";
import { presetOf } from "@/ui/card-face/studio/face-draft";
import type { FaceDraft } from "@/ui/card-face/studio/face-draft";
import {
  artOptions,
  chipOptions,
  colorLabels,
} from "@/ui/card-face/studio/studio-labels";

export interface AppearanceSummary {
  // The preset's name, or the custom colour's key when the colour is none of the presets.
  color: MessageKey;
  hex: string;
  art: MessageKey;
  chip: MessageKey;
}

const plain: MessageKey = "cardFace.art.plain";
const gold: MessageKey = "cardFace.studio.chip.gold";

// What the closed section writes of a card's appearance: the colour in use (the stored one, or
// the suggested one), the art and the chip, each with the face's default when unset.
export function appearanceSummary(
  face: FaceDraft,
  suggested: string,
): AppearanceSummary {
  const hex = face.color ?? suggested;
  const preset = presetOf(hex);

  return {
    color:
      preset === undefined ? "cardFace.studio.custom" : colorLabels[preset],
    hex: hex.toUpperCase(),
    art: artOptions.find((option) => option.key === face.art)?.label ?? plain,
    chip: chipOptions.find((option) => option.key === face.chip)?.label ?? gold,
  };
}
