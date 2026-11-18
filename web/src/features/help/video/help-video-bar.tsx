import { IconButton } from "@slotted/react/button";
import { FullscreenTrigger } from "@slotted/react/fullscreen";
import { Glyph, Icon } from "@slotted/react/icon";
import { Slider } from "@slotted/react/slider";
import { Text } from "@slotted/react/typography";

import styles from "@/features/help/styles/help.module.css";
import { videoTime } from "@/features/help/video/video-time";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface HelpVideoBarProps {
  playing: boolean;
  time: number;
  duration: number;
  onToggle: () => void;
  onSeek: (time: number) => void;
}

// Families read: button, slider, fullscreen. The controls under the picture of the help video:
// play and pause, the position, the time and full screen.
export function HelpVideoBar({
  playing,
  time,
  duration,
  onToggle,
  onSeek,
}: HelpVideoBarProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <div className={styles.videoBar}>
      <IconButton
        variant="ghost"
        tone="secondary"
        aria-label={t(playing ? "help.video.pause" : "help.video.play")}
        onClick={onToggle}
      >
        <Icon>
          <Glyph name={playing ? "pause" : "play"} />
        </Icon>
      </IconButton>

      <Slider
        className={styles.videoPosition}
        aria-label={t("help.video.position")}
        value={time}
        max={duration}
        step={0.1}
        largeStep={1}
        size="sm"
        valueLabel="none"
        format={{ style: "unit", unit: "second", maximumFractionDigits: 0 }}
        onValueChange={(value) => {
          onSeek(Array.isArray(value) ? (value[0] ?? 0) : value);
        }}
      />

      <Text size="sm" tone="muted" numeric="tabular">
        {t("help.video.time", {
          time: videoTime(time, locale),
          total: videoTime(duration, locale),
        })}
      </Text>

      <FullscreenTrigger iconOnly size="sm" />
    </div>
  );
}
