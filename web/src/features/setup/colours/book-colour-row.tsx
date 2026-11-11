import { ColorField } from "@slotted/react/color-picker";
import { Field, FieldLabel } from "@slotted/react/field";

import { SeedSwatches } from "@/features/setup/colours/seed-swatches";
import styles from "@/features/setup/pages/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";
import { accentSeed, accentSeeds, accents, readAccent } from "@/theme/accent";
import type { Accent, AccentPreset } from "@/theme/accent";

const hexColor = /^#[0-9a-f]{6}$/;
const THEME = "theme";

export interface BookColourRowProps {
  name: string;
  accent: Accent | undefined;
  onChange: (accent: Accent | undefined) => void;
}

// Families read: color-picker, field. The swatch group of one book: the theme's accent, then the
// presets, and a free colour beside it.
export function BookColourRow({ name, accent, onChange }: BookColourRowProps) {
  const t = useT();
  const theme = accentSeed(readAccent());

  const pick = (value: string) => {
    const hex = value.toLowerCase();
    if (!hexColor.test(hex)) return;
    onChange(accents.find((a) => accentSeeds[a] === hex) ?? (hex as Accent));
  };

  return (
    <Field necessity="none" className={styles.customAccent}>
      <FieldLabel>{name}</FieldLabel>
      <SeedSwatches<AccentPreset | typeof THEME>
        name={`book-accent-${name}`}
        label={name}
        value={accent ?? THEME}
        choices={[
          {
            value: THEME,
            label: t("studio.bookColour.theme"),
            color: theme,
          },
          ...accents.map((a) => ({
            value: a,
            label: t(`accent.${a}`),
            color: accentSeeds[a],
          })),
        ]}
        onChange={(value) => {
          onChange(value === THEME ? undefined : value);
        }}
      />
      <ColorField
        value={accentSeed(accent ?? readAccent())}
        format="hex"
        alpha={false}
        presets={accents.map((a) => accentSeeds[a])}
        onValueChange={pick}
      />
    </Field>
  );
}
