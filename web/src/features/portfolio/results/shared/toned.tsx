import type { ReactNode } from "react";

import styles from "@/features/portfolio/results/shared/shared.module.css";
import { directionOf, useAmountTone } from "@/ui/money/amount-tone";

interface TonedProps {
  // The signed result the text states: its sign picks the tone.
  value: number;
  children: ReactNode;
}

const toneClass = {
  success: styles.gain,
  danger: styles.loss,
  inherit: undefined,
} as const;

// PR10: a result reads in the success or danger tone, with its sign written in the text; the
// user's setting that turns tones off applies.
export function Toned({ value, children }: TonedProps) {
  const tone = useAmountTone();

  return (
    <span className={toneClass[tone("result", directionOf(value))]}>
      {children}
    </span>
  );
}
