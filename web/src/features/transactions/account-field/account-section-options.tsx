import { AccountCardOption } from "@/features/transactions/account-field/account-card-option";
import { AccountRow } from "@/features/transactions/account-field/account-row";
import { cardSectionIds } from "@/features/transactions/account-field/account-sections";
import type { Section } from "@/features/transactions/account-field/account-sections";

import styles from "@/features/transactions/account-field/account-section-list.module.css";

interface AccountSectionOptionsProps {
  section: Section;
  value: string | null;
  // The one option of the list that Tab reaches (roving tab stop).
  tabStop: string | null | undefined;
  scale: (currency: string) => number;
  onPick: (id: string) => void;
}

// The options of one section: wallet cards, two across, in a card section; rows elsewhere.
export function AccountSectionOptions({
  section,
  value,
  tabStop,
  scale,
  onPick,
}: AccountSectionOptionsProps) {
  const cards = cardSectionIds.has(section.id);
  const Option = cards ? AccountCardOption : AccountRow;

  return (
    <div className={cards ? styles.wall : styles.rows}>
      {section.choices.map((choice) => (
        <Option
          key={choice.account.id}
          choice={choice}
          chosen={choice.account.id === value}
          tabStop={choice.account.id === tabStop}
          scale={scale(choice.account.currency)}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
