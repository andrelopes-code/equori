import { Kbd } from "@slotted/react/kbd";
import { Text } from "@slotted/react/typography";

import { AssistantAsk } from "@/features/assistant";
import type { HelpLibrary } from "@/features/help/model/help-library";
import { HelpBest } from "@/features/help/search/help-best";
import { HelpNone } from "@/features/help/search/help-none";
import { HelpResultGroup } from "@/features/help/search/help-result-group";
import type {
  HelpHit,
  HelpSearchResult,
} from "@/features/help/search/search-help";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { compactQuery, useMediaQuery } from "@/ui/runtime/use-media-query";

// The legends of the keys, the same in every language.
const KEYS = { up: "↑", down: "↓", enter: "Enter", escape: "Esc" };

interface HelpFoundProps {
  library: HelpLibrary;
  result: HelpSearchResult;
  // The result the arrow keys stand on.
  active: HelpHit | undefined;
}

// The results of a search: the first apart, the others by kind, and the assistant for a reader
// who did not find the page (help spec, HP9 to HP11).
export function HelpFound({ library, result, active }: HelpFoundProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const phone = useMediaQuery(compactQuery);

  const { best, query } = result;
  const title = (id: string) =>
    library.find((p) => p.id === id)?.document.title;
  if (best === null) {
    return (
      <HelpNone
        query={query}
        near={result.near}
        troubleshooting={title("troubleshooting")}
        glossary={title("glossary")}
      />
    );
  }

  const count = numberFormatter(locale).format(result.count);

  return (
    <div className={styles.found} data-part="found">
      <div className={styles.foundHead}>
        <Text
          size="sm"
          tone="muted"
          role="status"
          render={(props) => <span {...props} />}
        >
          {result.count === 1
            ? t("help.search.countOne", { query })
            : t("help.search.count", { count, query })}
        </Text>

        {!phone && (
          <span className={styles.foundKeys} aria-hidden="true">
            <Kbd size="sm">{KEYS.up}</Kbd>
            <Kbd size="sm">{KEYS.down}</Kbd>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {t("help.search.keys.move")}
            </Text>
            <Kbd size="sm">{KEYS.enter}</Kbd>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {t("help.search.keys.open")}
            </Text>
            <Kbd size="sm">{KEYS.escape}</Kbd>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {t("help.search.keys.clear")}
            </Text>
          </span>
        )}
      </div>

      <HelpBest
        hit={best}
        page={library.find((p) => p.id === best.page)}
        query={query}
        active={best === active}
      />

      {result.groups.map(({ group, hits }) => (
        <HelpResultGroup
          key={group}
          group={group}
          hits={hits}
          query={query}
          active={active}
        />
      ))}

      <div className={styles.foundFoot}>
        <Text size="sm" tone="muted" render={(props) => <span {...props} />}>
          {t("help.search.notThis")}
        </Text>
        <AssistantAsk question={query} size="sm" />
      </div>
    </div>
  );
}
