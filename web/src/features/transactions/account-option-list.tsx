import { RadioGroup } from "@slotted/react/radio-group";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { groupOrder } from "@/features/transactions/account-groups";
import { AccountOption } from "@/features/transactions/account-option";
import styles from "@/features/transactions/account-option-list.module.css";
import type {
  AccountChoice,
  SuggestionView,
} from "@/features/transactions/use-account-choices";
import { useT } from "@/i18n/i18n-provider";

// The accounts as one radio group, in the fixed order of their groups; a suggestion marks
// its account where it stands and never moves it.
export function AccountOptionList({
  choices,
  value,
  onChange,
  name,
  suggestion,
  scale,
  label,
}: {
  // Already sorted inside each group.
  choices: readonly AccountChoice[];
  value: string | null;
  onChange: (id: string) => void;
  name: string;
  suggestion: SuggestionView | null;
  scale: (currency: string) => number;
  label: string;
}) {
  const t = useT();
  const option = (choice: AccountChoice) => (
    <AccountOption
      key={choice.account.id}
      choice={choice}
      suggestion={suggestion}
      scale={scale(choice.account.currency)}
    />
  );
  return (
    <RadioGroup
      name={name}
      variant="tile"
      labelPlacement="start"
      {...(value === null ? {} : { value })}
      aria-label={label}
      onValueChange={(next) => {
        onChange(next);
      }}
    >
      <Stack gap={6}>
        {groupOrder.map((group) => {
          const items = choices.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className={styles.section}>
              <Text
                size="xs"
                weight="semibold"
                tone="muted"
                className={styles.heading}
              >
                {t(`accountChoice.group.${group}`)}
              </Text>
              <Stack gap={2}>{items.map(option)}</Stack>
            </div>
          );
        })}
      </Stack>
    </RadioGroup>
  );
}
