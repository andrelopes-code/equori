import { Glyph, Icon } from "@slotted/react/icon";
import { Kbd } from "@slotted/react/kbd";
import { Link as TextLink } from "@slotted/react/link";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { useSlashKey } from "@/features/help/search/use-slash-key";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

const COMMON = [
  "help.search.common.1",
  "help.search.common.2",
  "help.search.common.3",
  "help.search.common.4",
] as const;

// The legend of the key, the same in every language.
const SLASH = "/";

interface HelpSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  // The address asked for the field: the reader came by the search action of a page.
  focus: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

// The search opens the index: the field at the reading measure, and under an empty field the
// searches most readers make (help spec, HP9 to HP11).
export function HelpSearch({
  query,
  onQueryChange,
  focus,
  onKeyDown,
}: HelpSearchProps) {
  const t = useT();
  const field = useRef<HTMLInputElement>(null);

  const focusField = useCallback(() => {
    field.current?.focus();
  }, []);

  useSlashKey(focusField);

  useEffect(() => {
    if (focus) field.current?.focus();
    // Read once: the address asks for the field when the page opens, not on every key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.ask} data-part="ask" role="search">
      <TextField
        ref={field}
        type="search"
        size="lg"
        value={query}
        onValueChange={onQueryChange}
        onKeyDown={onKeyDown}
        aria-label={t("help.search.label")}
        placeholder={t("help.search.placeholder")}
        clearable
        messages={{ clear: t("help.search.clear") }}
        start={
          <Icon>
            <Glyph name="search" />
          </Icon>
        }
        end={
          <Kbd size="sm" aria-hidden="true">
            {SLASH}
          </Kbd>
        }
      />

      {query === "" && (
        <div className={styles.askHints}>
          <Text size="sm" tone="muted" render={(props) => <span {...props} />}>
            {t("help.search.common")}
          </Text>
          {COMMON.map((key) => (
            <Text key={key} size="sm" render={(props) => <span {...props} />}>
              <TextLink
                underline="hover"
                render={routeTo({ to: "/help", search: { q: t(key) } })}
              >
                {t(key)}
              </TextLink>
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}
