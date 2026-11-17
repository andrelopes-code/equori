import { useId } from "react";
import type { CSSProperties } from "react";

import { useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/studio/color-controls.module.css";
import { trackOf } from "@/ui/card-face/studio/mixer-axes";
import type { AxisSpec, Axis, Mix } from "@/ui/card-face/studio/mixer-axes";

interface MixerSliderProps {
  spec: AxisSpec;
  mix: Mix;
  onMove: (axis: Axis, value: number) => void;
}

// Families read: slider, color-picker. The slider family styles its track from the theme and has
// no token or documented part that takes a gradient, so the track of each axis, painted with the
// colours it produces, is a native range input with the app's own track and thumb.
export function MixerSlider({ spec, mix, onMove }: MixerSliderProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const labelId = useId();
  const value = mix[spec.axis];
  const readout = numberFormatter(locale, spec.format).format(
    value / spec.scale,
  );
  const style = { "--track": trackOf(spec.axis, mix) } as CSSProperties;

  return (
    <div className={styles.row}>
      <span id={labelId} className={styles.name}>
        {t(spec.label)}
      </span>

      <input
        className={styles.range}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        style={style}
        aria-labelledby={labelId}
        aria-valuetext={readout}
        onChange={(event) => {
          onMove(spec.axis, Number(event.target.value));
        }}
      />

      <output className={styles.output}>{readout}</output>
    </div>
  );
}
