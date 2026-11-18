import { IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Icon } from "@slotted/react/icon";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Text } from "@slotted/react/typography";

import { HelpEnlarge } from "@/features/help/figure/help-enlarge";
import { HelpShot } from "@/features/help/figure/help-shot";
import { useHelpMedia } from "@/features/help/media/use-help-media";
import type {
  HelpFigure,
  HelpStep,
} from "@/features/help/model/parse-help-page";
import { plainText } from "@/features/help/model/parse-help-page";
import { HelpVideo } from "@/features/help/steps/help-video";
import styles from "@/features/help/styles/help.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";
import { StepGlyph } from "@/ui/navigation/step-glyph";

export type HelpStageMode = "figures" | "video";

interface HelpStageProps {
  steps: readonly HelpStep[];
  current: number;
  onCurrentChange: (index: number) => void;
  video?: HelpFigure | undefined;
  mode: HelpStageMode;
  onModeChange: (mode: HelpStageMode) => void;
}

// The figure of the step chosen, beside the steps: it stays in view while they scroll, and holds
// the way to the video and to the steps before and after (help spec, HP5).
export function HelpStage({
  steps,
  current,
  onCurrentChange,
  video,
  mode,
  onModeChange,
}: HelpStageProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const step = steps[current];
  const figure = step?.figure;
  const media = useHelpMedia();
  const clip = media.video(video?.id);
  const shown = mode === "figures" ? media.figure(figure?.id) : undefined;
  const number = numberFormatter(locale, {});
  // What the step asks for, without the choices that follow a colon.
  const what = plainText(step?.markdown ?? "").replace(/:.*/, ".");

  return (
    <div className={styles.stage} data-part="stage">
      <div className={styles.stageBar}>
        {clip !== undefined && (
          <SegmentedControl
            aria-label={t("help.steps.media")}
            size="sm"
            value={mode}
            onValueChange={(value) => {
              onModeChange(value === "video" ? "video" : "figures");
            }}
          >
            <Segment value="figures">{t("help.steps.figures")}</Segment>
            <Segment value="video">
              {t("help.steps.video", { seconds: number.format(clip.seconds) })}
            </Segment>
          </SegmentedControl>
        )}

        {shown !== undefined && (
          <HelpEnlarge
            dark={shown.dark}
            light={shown.light}
            name={figure?.alt ?? ""}
            type="image/png"
          />
        )}
      </div>

      <figure className={styles.figure}>
        {mode === "video" && video !== undefined && (
          <HelpVideo video={video} steps={steps} poster={steps[0]?.figure} />
        )}
        {mode === "figures" && figure !== undefined && (
          <HelpShot figure={figure} number={current + 1} />
        )}

        <figcaption className={styles.caption}>
          <span className={styles.captionText}>
            <Text
              size="sm"
              weight="medium"
              numeric="tabular"
              className={styles.captionCount}
              render={(props) => <span {...props} />}
            >
              {t("help.steps.count", {
                step: number.format(current + 1),
                total: number.format(steps.length),
              })}
            </Text>
            <Text
              size="sm"
              tone="muted"
              className={styles.captionWhat}
              render={(props) => <span {...props} />}
            >
              {what}
            </Text>
          </span>

          <ButtonGroup
            aria-label={t("help.steps.pair")}
            variant="outline"
            tone="secondary"
            size="sm"
          >
            <IconButton
              aria-label={t("help.steps.previous")}
              disabled={current === 0}
              onClick={() => {
                onCurrentChange(current - 1);
              }}
            >
              <Icon>
                <StepGlyph direction="previous" />
              </Icon>
            </IconButton>
            <IconButton
              aria-label={t("help.steps.next")}
              disabled={current === steps.length - 1}
              onClick={() => {
                onCurrentChange(current + 1);
              }}
            >
              <Icon>
                <StepGlyph direction="next" />
              </Icon>
            </IconButton>
          </ButtonGroup>
        </figcaption>
      </figure>
    </div>
  );
}
