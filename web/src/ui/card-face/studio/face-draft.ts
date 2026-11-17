import type { Brand } from "@/ui/card-face/brand";
import type { CardFaceProps } from "@/ui/card-face/card-face";

export interface FaceAPI {
  color?: string | null;
  art?: string | null;
  chip?: "gold" | "silver" | null;
  orientation?: "horizontal" | "vertical" | null;
  brand?: "auto" | "plate" | "name" | "none" | null;
}

export interface FaceDraft {
  color: string | null;
  art: string | null;
  chip: "gold" | "silver" | null;
  orientation: "horizontal" | "vertical" | null;
  brand: Brand | null;
}

export type PresetKey =
  | "purple"
  | "orange"
  | "bright_orange"
  | "red"
  | "yellow"
  | "blue"
  | "green"
  | "pink"
  | "carbon"
  | "graphite"
  | "silver"
  | "gold";

export const emptyFace: FaceDraft = {
  color: null,
  art: null,
  chip: null,
  orientation: null,
  brand: null,
};

export const presetColors: readonly { key: PresetKey; hex: string }[] = [
  { key: "purple", hex: "#820ad1" },
  { key: "orange", hex: "#ec7000" },
  { key: "bright_orange", hex: "#ff7a00" },
  { key: "red", hex: "#cc092f" },
  { key: "yellow", hex: "#fce300" },
  { key: "blue", hex: "#0b4ea2" },
  { key: "green", hex: "#00875f" },
  { key: "pink", hex: "#e5398d" },
  { key: "carbon", hex: "#17171a" },
  { key: "graphite", hex: "#3a3d44" },
  { key: "silver", hex: "#c4c8cf" },
  { key: "gold", hex: "#b8923a" },
];

export function faceOf(account: { face?: FaceAPI | null }): FaceDraft {
  const face = account.face;

  return {
    color: face?.color ?? null,
    art: face?.art ?? null,
    chip: face?.chip ?? null,
    orientation: face?.orientation ?? null,
    brand: face?.brand ?? null,
  };
}

export function faceBody(draft: FaceDraft): FaceAPI {
  return { ...draft, color: draft.color?.toLowerCase() ?? null };
}

// `preview` of the studio carries none of the five appearance props: a value unset in the draft
// is left out, so the face applies its default.
export function faceProps(
  draft: FaceDraft,
  suggested: string,
): Pick<CardFaceProps, "color" | "art" | "chip" | "orientation" | "brand"> {
  return {
    color: draft.color ?? suggested,
    ...whenSet("art", draft.art),
    ...whenSet("chip", draft.chip),
    ...whenSet("orientation", draft.orientation),
    ...whenSet("brand", draft.brand),
  };
}

export function presetOf(color: string): PresetKey | undefined {
  const lower = color.toLowerCase();

  return presetColors.find(({ hex }) => hex === lower)?.key;
}

function whenSet<K extends string, V>(
  key: K,
  value: V | null,
): Partial<Record<K, V>> {
  return value === null ? {} : ({ [key]: value } as Record<K, V>);
}
