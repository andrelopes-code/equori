import { Text } from "@slotted/react/typography";

import styles from "@/features/assistant/message/answer-blocks.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CompareDeltaProps {
  first: number;
  second: number;
}

// The difference of two periods as a whole percentage of the first, in words. A first value of
// zero has no percentage and draws nothing.
export function CompareDelta({ first, second }: CompareDeltaProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (first === 0) return null;

  const percent = Math.round((Math.abs(second - first) / first) * 100);
  const tone = {
    "assistant.block.more": styles.more,
    "assistant.block.less": styles.less,
    "assistant.block.same": styles.same,
  };
  const key = deltaKey(first, second);

  return (
    <Text
      size="xs"
      weight="semibold"
      className={[styles.delta, tone[key]].join(" ")}
    >
      {t(key, { percent: numberFormatter(locale).format(percent) })}
    </Text>
  );
}

function deltaKey(
  first: number,
  second: number,
): "assistant.block.more" | "assistant.block.less" | "assistant.block.same" {
  if (second === first) return "assistant.block.same";
  return second > first ? "assistant.block.more" : "assistant.block.less";
}
