import { Text } from "@slotted/react/typography";

import { HelpResult } from "@/features/help/search/help-result";
import type { HelpHit, HelpHitGroup } from "@/features/help/search/search-help";
import styles from "@/features/help/styles/help.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface HelpResultGroupProps {
  group: HelpHitGroup;
  hits: readonly HelpHit[];
  query: string;
  // The result the arrow keys stand on.
  active: HelpHit | undefined;
}

// The results of one kind under their rule, with their count.
export function HelpResultGroup({
  group,
  hits,
  query,
  active,
}: HelpResultGroupProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const name = t(`help.search.group.${group}`);

  return (
    <section className={styles.resultGroup}>
      <div className={styles.groupHead}>
        <Text
          size="sm"
          tone="muted"
          weight="medium"
          render={(props) => <h2 {...props} />}
        >
          {name}
        </Text>
        <Text
          size="sm"
          tone="muted"
          numeric="tabular"
          render={(props) => <span {...props} />}
        >
          {numberFormatter(locale).format(hits.length)}
        </Text>
      </div>

      <ul className={styles.rows} role="list" aria-label={name}>
        {hits.map((hit) => (
          <HelpResult
            key={`${hit.page}#${hit.hash ?? ""}`}
            hit={hit}
            query={query}
            active={hit === active}
          />
        ))}
      </ul>
    </section>
  );
}
