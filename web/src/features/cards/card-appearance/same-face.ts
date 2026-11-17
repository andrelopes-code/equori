import type { FaceDraft } from "@/ui/card-face/studio/face-draft";

export function sameFace(a: FaceDraft, b: FaceDraft): boolean {
  return (
    a.color?.toLowerCase() === b.color?.toLowerCase() &&
    a.art === b.art &&
    a.chip === b.chip &&
    a.orientation === b.orientation &&
    a.brand === b.brand
  );
}
