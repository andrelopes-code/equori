import { Slider } from "@slotted/react/slider";
import { useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { textScale, useTextSize } from "@/theme/text-size";
import type { TextSize } from "@/theme/text-size";

// The scale moves with the thumb and applies when the thumb settles: the root size changes every
// rem on the page, the slider included, and a slider that grows under the pointer loses it.
export function TextSizeSlider() {
  const t = useT();
  const [textSize, setTextSize] = useTextSize();
  const [moving, setMoving] = useState<number | null>(null);
  return (
    <Slider
      aria-label={t("settings.textSize")}
      value={moving ?? Number(textSize)}
      min={textScale.min}
      max={textScale.max}
      step={textScale.step}
      marks={[
        { value: textScale.min },
        { value: textScale.standard, label: t("textSize.standard") },
        { value: textScale.max },
      ]}
      format={{ style: "percent" }}
      valueLabel="always"
      onValueChange={(next) => {
        if (typeof next === "number") setMoving(next);
      }}
      onValueCommit={(next) => {
        if (typeof next === "number") setTextSize(String(next) as TextSize);
        setMoving(null);
      }}
    />
  );
}
