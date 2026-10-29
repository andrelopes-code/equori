import { ColorField } from "@slotted/react/color-picker";
import { Field, FieldLabel } from "@slotted/react/field";

import { SeedSwatches } from "@/features/setup/seed-swatches";
import { SettingsGroup } from "@/features/setup/settings-group";
import styles from "@/features/setup/settings-page.module.css";
import { SettingsRow } from "@/features/setup/settings-row";
import { StatusColours } from "@/features/setup/status-colours";
import { useT } from "@/i18n/i18n-provider";
import { accentSeed, accentSeeds, accents, useAccent } from "@/theme/accent";
import type { AccentPreset } from "@/theme/accent";
import { toneSeed, toneSeeds, tones, useTone } from "@/theme/tone";

const hexColor = /^#[0-9a-f]{6}$/;

// The accent, the neutral tone of the surfaces and the four status colours.
export function AppearanceColour() {
  const t = useT();
  const [accent, setAccent] = useAccent();
  const [tone, setTone] = useTone();

  // A colour typed or picked that equals a preset is that preset, so its swatch reads as chosen.
  const pickAccent = (value: string) => {
    const hex = value.toLowerCase();
    if (!hexColor.test(hex)) return;
    const preset = accents.find((a) => accentSeeds[a] === hex);
    setAccent(preset ?? (hex as `#${string}`));
  };

  const pickTone = (value: string) => {
    const hex = value.toLowerCase();
    if (!hexColor.test(hex)) return;
    const preset = tones.find((s) => toneSeeds[s] === hex);
    setTone(preset ?? (hex as `#${string}`));
  };

  return (
    <SettingsGroup title={t("settings.appearance.colour")}>
      <SettingsRow
        label={t("settings.accent")}
        description={t("settings.accent.description")}
        stacked
      >
        <SeedSwatches<AccentPreset>
          name="accent"
          label={t("settings.accent")}
          value={accent}
          choices={accents.map((a) => ({
            value: a,
            label: t(`accent.${a}`),
            color: accentSeeds[a],
          }))}
          onChange={setAccent}
        />
        <Field necessity="none" className={styles.customAccent}>
          <FieldLabel>{t("settings.accent.custom")}</FieldLabel>
          <ColorField
            value={accentSeed(accent)}
            format="hex"
            alpha={false}
            presets={accents.map((a) => accentSeeds[a])}
            onValueChange={pickAccent}
          />
        </Field>
      </SettingsRow>
      <SettingsRow
        label={t("settings.tone")}
        description={t("settings.tone.description")}
        stacked
      >
        <SeedSwatches
          name="tone"
          label={t("settings.tone")}
          value={tone}
          choices={tones.map((s) => ({
            value: s,
            label: t(`tone.${s}`),
            color: toneSeeds[s],
          }))}
          onChange={setTone}
        />
        <Field necessity="none" className={styles.customAccent}>
          <FieldLabel>{t("settings.tone.custom")}</FieldLabel>
          <ColorField
            value={toneSeed(tone)}
            format="hex"
            alpha={false}
            presets={tones.map((s) => toneSeeds[s])}
            onValueChange={pickTone}
          />
        </Field>
      </SettingsRow>
      <SettingsRow
        label={t("settings.status")}
        description={t("settings.status.description")}
        stacked
      >
        <StatusColours />
      </SettingsRow>
    </SettingsGroup>
  );
}
