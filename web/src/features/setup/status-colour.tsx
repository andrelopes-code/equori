import { Button } from "@slotted/react/button";
import { ColorField } from "@slotted/react/color-picker";
import { Field, FieldLabel } from "@slotted/react/field";

import { rgbToHex } from "@/features/setup/rgb-to-hex";
import styles from "@/features/setup/status-colours.module.css";
import { useT } from "@/i18n/i18n-provider";
import { useStatusSeed } from "@/theme/status";
import type { StatusName } from "@/theme/status";

const hexColor = /^#[0-9a-f]{6}$/;
const FALLBACK = "#808080";

export interface StatusColourProps {
  name: StatusName;
}

// One status seed; it returns to the theme's own seed on its own.
export function StatusColour({ name }: StatusColourProps) {
  const t = useT();
  const [seed, setSeed] = useStatusSeed(name);

  const shown = seed === "theme" ? themeSeed(name) : seed;

  return (
    <Field necessity="none" className={styles.colour}>
      <FieldLabel>{t(`status.${name}`)}</FieldLabel>
      <ColorField
        value={shown}
        format="hex"
        alpha={false}
        onValueChange={(value) => {
          const hex = value.toLowerCase();
          if (hexColor.test(hex)) setSeed(hex as `#${string}`);
        }}
      />
      {seed !== "theme" && (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          onClick={() => {
            setSeed("theme");
          }}
        >
          {t("settings.status.theme")}
        </Button>
      )}
    </Field>
  );
}

// The compiled theme's seed. A seed is a registered <color> property, so the browser computes it in
// the form it was declared (rgb() or oklch()); a pixel of canvas turns any form into the hex the
// field reads.
function themeSeed(name: StatusName): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--slotted-seed-${name}`)
    .trim();
  const direct = rgbToHex(value);
  if (direct !== null || value === "") return direct ?? FALLBACK;

  const context = document.createElement("canvas").getContext("2d");
  if (context === null) return FALLBACK;

  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;

  return rgbToHex(`rgb(${String(r)}, ${String(g)}, ${String(b)})`) ?? FALLBACK;
}
