import { Slider } from "@slotted/react/slider";

import { useT } from "@/i18n/i18n-provider";

interface TargetSliderProps {
  name: string;
  // Basis points.
  value: number;
  disabled: boolean;
  onChange: (bp: number) => void;
}

// Families read: slider. It drags the target in steps of a tenth of a percent; the value stands
// in the percent field of the target column, so the slider draws no label of its own.
export function TargetSlider({
  name,
  value,
  disabled,
  onChange,
}: TargetSliderProps) {
  const t = useT();

  function handleChange(next: number | readonly number[]) {
    if (typeof next === "number") onChange(Math.round(next * 10) * 10);
  }

  return (
    <Slider
      size="sm"
      valueLabel="none"
      aria-label={`${t("contributionPlan.colTarget")}: ${name}`}
      disabled={disabled}
      value={value / 100}
      min={0}
      max={100}
      step={0.1}
      onValueChange={handleChange}
    />
  );
}
