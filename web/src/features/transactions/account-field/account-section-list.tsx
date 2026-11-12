import { useId } from "react";

import { AccountRow } from "@/features/transactions/account-field/account-row";
import type { Section } from "@/features/transactions/account-field/account-sections";
import type { SuggestionView } from "@/features/transactions/account-field/use-account-choices";
import { useSectionNavigation } from "@/features/transactions/account-field/use-section-navigation";
import { useT } from "@/i18n/i18n-provider";

import styles from "@/features/transactions/account-field/account-section-list.module.css";

interface AccountSectionListProps {
  sections: Section[];
  value: string | null;
  onPick: (id: string) => void;
  scale: (currency: string) => number;
  suggestion: SuggestionView | null;
  label: string;
}

// Families read: listbox (groups, options with renderOption, columns), radio-group, card. The
// listbox keeps the roles, the arrow keys across groups and the chosen state, but it cannot
// draw a bordered row with a gap and a chosen edge through props or tokens, and its `columns`
// is one value for every group, so rows and a two-column grid of cards cannot share one list.
// Workaround for Slotted issue #95: the option edge, the gap between options and the chosen
// edge have no token. Workaround for Slotted issue #94: a group has no column count of its own.
// The list is the application's own: role listbox over groups of role option rows, one tab
// stop moved by the arrow keys (section-navigation.ts), Enter and Space to choose.
export function AccountSectionList({
  sections,
  value,
  onPick,
  scale,
  suggestion,
  label,
}: AccountSectionListProps) {
  const t = useT();
  const headingId = useId();
  const { listRef, tabStop, handleFocus, handleKeyDown } = useSectionNavigation(
    sections.map((section) => ({
      ids: section.choices.map((choice) => choice.account.id),
      columns: 1,
    })),
    value,
  );

  return (
    <div
      ref={listRef}
      className={styles.list}
      role="listbox"
      aria-label={label}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      {sections.map((section) => (
        <div
          key={section.id}
          className={styles.section}
          role="group"
          aria-labelledby={`${headingId}-${section.id}`}
        >
          <div className={styles.heading}>
            <span id={`${headingId}-${section.id}`}>{t(section.heading)}</span>
            {section.id === "suggested" && suggestion !== null && (
              <span className={styles.hint}>
                {t("accountChoice.suggestedHint", {
                  count: suggestion.count,
                  total: suggestion.total,
                  name: suggestion.name,
                })}
              </span>
            )}
          </div>

          <div className={styles.rows}>
            {section.choices.map((choice) => (
              <AccountRow
                key={choice.account.id}
                choice={choice}
                chosen={choice.account.id === value}
                tabStop={choice.account.id === tabStop}
                scale={scale(choice.account.currency)}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
