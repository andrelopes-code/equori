import { useId } from "react";

import { AccountOtherBlock } from "@/features/transactions/account-field/account-other-block";
import { AccountSectionOptions } from "@/features/transactions/account-field/account-section-options";
import { cardSectionIds } from "@/features/transactions/account-field/account-sections";
import type { Section } from "@/features/transactions/account-field/account-sections";
import type { SuggestionView } from "@/features/transactions/account-field/use-account-choices";
import { useOtherOpen } from "@/features/transactions/account-field/use-other-open";
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
  // A search is active: the block "Other accounts" is open.
  expandOther?: boolean;
}

// Families read: listbox (groups, options with renderOption, columns), radio-group, card. The
// listbox keeps the roles, the arrow keys across groups and the chosen state, but it cannot
// draw a bordered row with a gap and a chosen edge through props or tokens, and its `columns`
// is one value for every group, so rows and a two-column grid of cards cannot share one list.
// Workaround for Slotted issue #95: the option edge, the gap between options and the chosen
// edge have no token. Workaround for Slotted issue #94: a group has no column count of its own.
// The sections of cards draw AccountCardOption, two across, and the others AccountRow.
// The section "other" is a Collapsible, closed unless a search is active or it holds the
// chosen account; its options join the arrow navigation only while it is open.
// The list is the application's own: role listbox over groups of role option rows, one tab
// stop moved by the arrow keys (section-navigation.ts), Enter and Space to choose.
export function AccountSectionList({
  sections,
  value,
  onPick,
  scale,
  suggestion,
  label,
  expandOther = false,
}: AccountSectionListProps) {
  const t = useT();
  const headingId = useId();
  const other = sections.find((section) => section.id === "other");
  const holdsChosen = other?.choices.some((c) => c.account.id === value);
  const [otherOpen, setOtherOpen] = useOtherOpen(
    expandOther || holdsChosen === true,
  );
  const reachable = sections.filter(
    (section) => section.id !== "other" || otherOpen,
  );
  const { listRef, tabStop, handleFocus, handleKeyDown } = useSectionNavigation(
    reachable.map((section) => ({
      ids: section.choices.map((choice) => choice.account.id),
      columns: cardSectionIds.has(section.id) ? 2 : 1,
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
      {sections.map((section) => {
        if (section.id === "other") {
          return (
            <AccountOtherBlock
              key={section.id}
              label={t(section.heading)}
              count={section.choices.length}
              open={otherOpen}
              onOpenChange={setOtherOpen}
            >
              <AccountSectionOptions
                section={section}
                value={value}
                tabStop={tabStop}
                scale={scale}
                onPick={onPick}
              />
            </AccountOtherBlock>
          );
        }

        return (
          <div
            key={section.id}
            className={styles.section}
            role="group"
            aria-labelledby={`${headingId}-${section.id}`}
          >
            <div className={styles.heading}>
              <span id={`${headingId}-${section.id}`}>
                {t(section.heading)}
              </span>
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

            <AccountSectionOptions
              section={section}
              value={value}
              tabStop={tabStop}
              scale={scale}
              onPick={onPick}
            />
          </div>
        );
      })}
    </div>
  );
}
