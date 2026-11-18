import { Link as TextLink } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import { AssistantAsk } from "@/features/assistant";
import type { HelpHit } from "@/features/help/search/search-help";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface HelpNoneProps {
  query: string;
  near: readonly HelpHit[];
  // The titles of the two pages a reader without a result is sent to.
  troubleshooting: string | undefined;
  glossary: string | undefined;
}

// A search without result says what the search reads, offers the entries that match one word,
// and leads to the assistant (help spec, HP11).
export function HelpNone({
  query,
  near,
  troubleshooting,
  glossary,
}: HelpNoneProps) {
  const t = useT();

  const pages = [
    ["troubleshooting", troubleshooting],
    ["glossary", glossary],
  ] as const;

  return (
    <div className={styles.found} data-part="found">
      <div className={styles.none}>
        <h2 className={styles.noneTitle}>
          {t("help.search.none.title", { query })}
        </h2>
        <p className={styles.noneText}>{t("help.search.none.text")}</p>

        {near.length > 0 && (
          <div className={styles.askHints}>
            <Text
              size="sm"
              tone="muted"
              render={(props) => <span {...props} />}
            >
              {t("help.search.near")}
            </Text>
            {near.map((hit) => (
              <Text
                key={`${hit.page}#${hit.hash ?? ""}`}
                size="sm"
                render={(props) => <span {...props} />}
              >
                <TextLink
                  underline="hover"
                  render={routeTo({
                    to: "/help/$page",
                    params: { page: hit.page },
                    ...(hit.hash === undefined ? {} : { hash: hit.hash }),
                  })}
                >
                  {hit.title}
                </TextLink>
              </Text>
            ))}
          </div>
        )}
      </div>

      <AssistantAsk question={query} />

      <div className={styles.askHints}>
        <Text size="sm" tone="muted" render={(props) => <span {...props} />}>
          {t("help.search.orSee")}
        </Text>
        {pages.map(
          ([page, title]) =>
            title !== undefined && (
              <Text
                key={page}
                size="sm"
                render={(props) => <span {...props} />}
              >
                <TextLink
                  underline="hover"
                  render={routeTo({ to: "/help/$page", params: { page } })}
                >
                  {title}
                </TextLink>
              </Text>
            ),
        )}
      </div>
    </div>
  );
}
