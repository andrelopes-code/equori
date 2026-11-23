import { Slider } from "@slotted/react/slider";
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

// One axis of the mixer; its track is painted with the colours the axis produces. The slider holds
// the value as it is written, so a screen reader hears the readout.
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

      <Slider
        className={styles.range}
        style={style}
        indicator={false}
        valueLabel="none"
        format={spec.format}
        min={spec.min / spec.scale}
        max={spec.max / spec.scale}
        step={spec.step / spec.scale}
        value={value / spec.scale}
        aria-labelledby={labelId}
        onValueChange={(moved) => {
          if (typeof moved === "number") onMove(spec.axis, moved * spec.scale);
        }}
      />

      <output className={styles.output}>{readout}</output>
    </div>
  );
}
