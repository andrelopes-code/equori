import { Kbd } from "@slotted/react/kbd";
import { Link as TextLink } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type { HelpLibraryPage } from "@/features/help/model/help-library";
import { HelpAnchor } from "@/features/help/row/help-anchor";
import type { HelpHit } from "@/features/help/search/search-help";
import { useHitPlace } from "@/features/help/search/use-hit-place";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

// The name of the key, the same in every language.
const ENTER = "Enter";

interface HelpBestProps {
  hit: HelpHit;
  // The page of the result, for its sections, its steps and its video.
  page: HelpLibraryPage | undefined;
  active: boolean;
}

// The first result, the one Enter opens: a card of the app, with the sections of its page so the
// reader lands on the right one (help spec, HP9). The card stands out on its own: its words are
// not marked (owner, 2026-11-19).
export function HelpBest({ hit, page, active }: HelpBestProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const place = useHitPlace();

  const whole = hit.group === "pages" ? page : undefined;
  const steps = whole?.document.sections
    .flatMap((s) => s.blocks)
    .find((b) => b.type === "steps");
  const about = [
    place(hit),
    steps &&
      t("help.search.steps", {
        count: numberFormatter(locale).format(steps.steps.length),
      }),
    steps?.video && t("help.media.video"),
  ].filter((part) => typeof part === "string");

  return (
    <div
      className={styles.best}
      data-part="best"
      data-active={active ? "" : undefined}
    >
      <HelpAnchor className={styles.bestLink} page={hit.page} hash={hit.hash}>
        <span className={styles.resultTitle}>
          <span className={styles.bestTitle}>{hit.title}</span>
          <span className={styles.bestEnd}>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {about.join(" · ")}
            </Text>
            <span className={styles.keyHint} aria-hidden="true">
              <Kbd size="sm">{ENTER}</Kbd>
            </span>
          </span>
        </span>
        <Text
          tone="muted"
          className={styles.resultExcerpt}
          render={(props) => <span {...props} />}
        >
          {hit.excerpt}
        </Text>
      </HelpAnchor>

      {whole !== undefined && whole.document.sections.length > 0 && (
        <div className={styles.bestParts}>
          <Text size="sm" tone="muted" render={(props) => <span {...props} />}>
            {t("help.toc")}
          </Text>
          {whole.document.sections.map((section) => (
            <Text
              key={section.id}
              size="sm"
              render={(props) => <span {...props} />}
            >
              <TextLink
                underline="hover"
                render={routeTo({
                  to: "/help/$page",
                  params: { page: whole.id },
                  hash: section.id,
                })}
              >
                {section.title}
              </TextLink>
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}
