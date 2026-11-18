import { Skeleton } from "@slotted/react/skeleton";

import { useHelpMedia } from "@/features/help/media/use-help-media";
import type { HelpArea as Area } from "@/features/help/model/help-guides";
import { helpGuides } from "@/features/help/model/help-guides";
import type { HelpLibrary } from "@/features/help/model/help-library";
import { helpPages } from "@/features/help/model/help-pages";
import { HelpRow } from "@/features/help/row/help-row";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HelpAreaProps {
  area: Area;
  // Undefined while the pages load: the rows hold their place.
  library: HelpLibrary | undefined;
}

// The pages of one area of the app: its name in one column, its pages the rows beside it. The
// name is text alone (owner, 2026-11-17: no icon in the directory).
export function HelpArea({ area, library }: HelpAreaProps) {
  const t = useT();
  const media = useHelpMedia();

  const name = t(`help.area.${area}`);
  const pages = helpPages.filter((p) => helpGuides[p.id]?.area === area);

  return (
    <div className={styles.area}>
      <h3 className={styles.areaName}>{name}</h3>

      <ul className={styles.rows} role="list" aria-label={name}>
        {pages.map((page) => {
          const document = library?.find((p) => p.id === page.id)?.document;
          const video = document?.sections
            .flatMap((s) => s.blocks)
            .some(
              (b) =>
                b.type === "steps" && media.video(b.video?.id) !== undefined,
            );

          return (
            <HelpRow
              key={page.id}
              page={page.id}
              title={document?.title ?? <Skeleton inlineSize="22ch" />}
              media={video === true ? t("help.media.video") : undefined}
              end={t(`help.kind.${page.kind}.short`)}
            />
          );
        })}
      </ul>
    </div>
  );
}
