import { Text } from "@slotted/react/typography";
import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/ui/use-media-query";

// The tween of the unassigned amount (spec 5.2): long enough to see the figure move with a
// keystroke, short enough to never trail the typing.
const tweenMs = 180;

// The plan's largest figure. It moves from the amount it showed to the new one over 180 ms,
// and jumps at once under a reduced-motion preference. Built here because no family animates
// a figure; it is Text of the typography family and paints nothing of its own.
export function PlanFigure({
  amount,
  format,
  tone,
  size,
}: {
  amount: number;
  format: (amount: number) => string;
  tone: "default" | "danger";
  size: "xl" | "3xl";
}) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [shown, setShown] = useState(amount);
  const from = useRef(amount);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame === "undefined") {
      from.current = amount;
      setShown(amount);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - start) / tweenMs, 1);
      // Whole minor units: the figure never shows a fraction of a cent.
      const value = Math.round(origin + (amount - origin) * progress);
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [amount, reduced]);
  return (
    <Text size={size} weight="semibold" numeric="tabular" tone={tone}>
      {format(shown)}
    </Text>
  );
}
