import { useEffect } from "react";

import styles from "@/features/setup/appearance-previews.module.css";
import { useT } from "@/i18n/i18n-provider";
import { loadTypeface, typefaceStacks } from "@/theme/typeface";
import type { TypefacePreset } from "@/theme/typeface";

// Families read: typography. Text takes the face in force; a preview of another face writes its
// stack on the sample, so every card shows its choice and not the one in force.
export function TypefacePreview({ typeface }: { typeface: TypefacePreset }) {
  const t = useT();
  // Each card shows its own face, so the face is declared before the reader picks it.
  useEffect(() => {
    loadTypeface(typeface);
  }, [typeface]);
  return (
    <span
      className={styles.typeface}
      style={{ fontFamily: typefaceStacks[typeface] }}
    >
      {t("settings.typeface.sample")}
    </span>
  );
}
