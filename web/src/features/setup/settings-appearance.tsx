import { Button } from "@slotted/react/button";
import { ColorField } from "@slotted/react/color-picker";
import { Field, FieldLabel } from "@slotted/react/field";
import { Switch } from "@slotted/react/switch";

import { CustomTypefaceField } from "@/features/setup/custom-typeface-field";
import { CornersPreview } from "@/features/setup/corners-preview";
import { DensityPreview } from "@/features/setup/density-preview";
import { SchemePreview } from "@/features/setup/scheme-preview";
import { SeedSwatches } from "@/features/setup/seed-swatches";
import { SettingsGroup } from "@/features/setup/settings-group";
import styles from "@/features/setup/settings-page.module.css";
import { SettingsRow } from "@/features/setup/settings-row";
import { SettingsSection } from "@/features/setup/settings-section";
import { TextSizeSlider } from "@/features/setup/text-size-slider";
import { TypefacePreview } from "@/features/setup/typeface-preview";
import { useT } from "@/i18n/i18n-provider";
import { accentSeed, accentSeeds, accents, useAccent } from "@/theme/accent";
import type { AccentPreset } from "@/theme/accent";
import { resetAppearance } from "@/theme/appearance";
import { cornerStyles, useCorners } from "@/theme/corners";
import { densities, useDensity } from "@/theme/density";
import { useMotion } from "@/theme/motion";
import { schemes, useScheme } from "@/theme/scheme";
import { toneSeed, toneSeeds, tones, useTone } from "@/theme/tone";
import { typefaces, useTypeface } from "@/theme/typeface";
import { useVisual } from "@/theme/visual";
import { ChoiceCards } from "@/ui/choice-cards";
import { Inline } from "@slotted/react";

function oneOf<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}

const hexColor = /^#[0-9a-f]{6}$/;

export function SettingsAppearance() {
  const t = useT();
  const [scheme, setScheme] = useScheme();
  const [accent, setAccent] = useAccent();
  const [tone, setTone] = useTone();
  const [corners, setCorners] = useCorners();
  const [density, setDensity] = useDensity();
  const [typeface, setTypeface] = useTypeface();
  const [motion, setMotion] = useMotion();
  const [visual, setVisual] = useVisual();

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
    <SettingsSection
      topic="appearance"
      title={t("settings.appearance.title")}
      description={t("settings.summary.appearance")}
      local
    >
      <SettingsGroup title={t("settings.appearance.theme")}>
        <SettingsRow
          label={t("more.scheme")}
          description={t("settings.scheme.description")}
          stacked
        >
          <ChoiceCards
            name="scheme"
            label={t("more.scheme")}
            value={scheme}
            choices={schemes.map((s) => ({
              value: s,
              label: t(`scheme.${s}`),
              preview: <SchemePreview scheme={s} />,
            }))}
            onChange={(next) => {
              if (oneOf(schemes, next)) setScheme(next);
            }}
          />
        </SettingsRow>
      </SettingsGroup>

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
      </SettingsGroup>

      <SettingsGroup title={t("settings.appearance.shape")}>
        <SettingsRow
          label={t("settings.corners")}
          description={t("settings.corners.description")}
          stacked
        >
          <ChoiceCards
            name="corners"
            label={t("settings.corners")}
            value={corners}
            choices={cornerStyles.map((c) => ({
              value: c,
              label: t(`corners.${c}`),
              preview: <CornersPreview corners={c} />,
            }))}
            onChange={(next) => {
              if (oneOf(cornerStyles, next)) setCorners(next);
            }}
          />
        </SettingsRow>
        <SettingsRow
          label={t("more.density")}
          description={t("settings.density.description")}
          stacked
        >
          <ChoiceCards
            name="density"
            label={t("more.density")}
            value={density}
            choices={densities.map((d) => ({
              value: d,
              label: t(`density.${d}`),
              preview: <DensityPreview density={d} />,
            }))}
            onChange={(next) => {
              if (oneOf(densities, next)) setDensity(next);
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settings.appearance.text")}>
        <SettingsRow
          label={t("settings.textSize")}
          description={t("settings.textSize.description")}
          stacked
        >
          <TextSizeSlider />
        </SettingsRow>
        <SettingsRow
          label={t("settings.typeface")}
          description={t("settings.typeface.description")}
          stacked
        >
          <ChoiceCards
            name="typeface"
            label={t("settings.typeface")}
            value={typeface}
            choices={typefaces.map((f) => ({
              value: f,
              label: t(`typeface.${f}`),
              preview: <TypefacePreview typeface={f} />,
            }))}
            onChange={(next) => {
              if (oneOf(typefaces, next)) setTypeface(next);
            }}
          />
          <CustomTypefaceField />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settings.appearance.motion")}>
        <Switch
          labelPlacement="start"
          checked={motion === "reduced"}
          onCheckedChange={(on) => {
            setMotion(on ? "reduced" : "system");
          }}
          description={t("settings.motion.description")}
        >
          {t("settings.motion")}
        </Switch>
        <Switch
          labelPlacement="start"
          checked={visual === "glass"}
          onCheckedChange={(on) => {
            setVisual(on ? "glass" : "standard");
          }}
          description={t("settings.experimental.glassDescription")}
        >
          {t("settings.experimental.glass")}
        </Switch>
      </SettingsGroup>
      <Inline justify="end">
        <Button variant="ghost" tone="secondary" onClick={resetAppearance}>
          {t("settings.appearance.reset")}
        </Button>
      </Inline>
    </SettingsSection>
  );
}
