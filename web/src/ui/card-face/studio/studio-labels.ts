import type { MessageKey } from "@/i18n/catalog.en";
import type { PresetKey } from "@/ui/card-face/studio/face-draft";

export const colorLabels: Record<PresetKey, MessageKey> = {
  purple: "cardFace.color.purple",
  orange: "cardFace.color.orange",
  bright_orange: "cardFace.color.bright_orange",
  red: "cardFace.color.red",
  yellow: "cardFace.color.yellow",
  blue: "cardFace.color.blue",
  green: "cardFace.color.green",
  pink: "cardFace.color.pink",
  carbon: "cardFace.color.carbon",
  graphite: "cardFace.color.graphite",
  silver: "cardFace.color.silver",
  gold: "cardFace.color.gold",
};

export const artOptions: readonly { key: string; label: MessageKey }[] = [
  { key: "plain", label: "cardFace.art.plain" },
  { key: "aurora", label: "cardFace.art.aurora" },
  { key: "waves", label: "cardFace.art.waves" },
  { key: "orbits", label: "cardFace.art.orbits" },
  { key: "band", label: "cardFace.art.band" },
  { key: "contour", label: "cardFace.art.contour" },
  { key: "dots", label: "cardFace.art.dots" },
  { key: "carbon", label: "cardFace.art.carbon" },
  { key: "brushed", label: "cardFace.art.brushed" },
  { key: "holo", label: "cardFace.art.holo" },
];

export const chipOptions: readonly {
  key: "gold" | "silver";
  label: MessageKey;
}[] = [
  { key: "gold", label: "cardFace.studio.chip.gold" },
  { key: "silver", label: "cardFace.studio.chip.silver" },
];

export const orientationOptions: readonly {
  key: "horizontal" | "vertical";
  label: MessageKey;
}[] = [
  { key: "horizontal", label: "cardFace.studio.orientation.horizontal" },
  { key: "vertical", label: "cardFace.studio.orientation.vertical" },
];

export const brandOptions: readonly {
  key: "auto" | "plate" | "name" | "none";
  label: MessageKey;
}[] = [
  { key: "auto", label: "cardFace.studio.brand.auto" },
  { key: "plate", label: "cardFace.studio.brand.plate" },
  { key: "name", label: "cardFace.studio.brand.name" },
  { key: "none", label: "cardFace.studio.brand.none" },
];
