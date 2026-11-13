import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { slotClass } from "@/features/portfolio/contribution-plan/composer/slot-class";
import { useSegmentLabel } from "@/features/portfolio/contribution-plan/composer/use-segment-label";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale } from "@/i18n/i18n-provider";

interface IdealSegmentProps {
  group: CompositionGroup;
  barWidth: number;
}

// One group of the ideal bar. The name and the percent sit inside when they fit; the two
// hidden spans hold the texts the fit is measured on.
export function IdealSegment({ group, barWidth }: IdealSegmentProps) {
  const [tag] = useAppLocale();
  const percent = shareText(group.targetBp / 10000, tag);
  const fullText = `${group.name} ${percent}`;
  const { label, room, full, short } = useSegmentLabel(
    [barWidth, group.targetBp, fullText].join("|"),
  );

  const text = label === "full" ? fullText : percent;

  return (
    <div
      data-segment=""
      className={[styles.segment, slotClass(group.colour)].join(" ")}
      style={{ flexGrow: group.targetBp }}
    >
      <span data-measure="room" ref={room} className={styles.room}>
        {label === "none" ? "" : text}
      </span>

      <span data-measure="full" ref={full} className={styles.measure}>
        {fullText}
      </span>

      <span data-measure="short" ref={short} className={styles.measure}>
        {percent}
      </span>
    </div>
  );
}
