import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { usePropertyFigures } from "@/features/accounts/kind-figures/use-property-figures";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface PropertyChangeNoteProps {
  account: Account;
}

// K10: the line under a property's value in the list, its change since the purchase (K2).
export function PropertyChangeNote({ account }: PropertyChangeNoteProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const { change } = usePropertyFigures(account, false);

  if (change?.fraction === undefined) return null;

  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });

  return (
    <Text size="xs" tone="muted" wrap="nowrap">
      {t("property.caption", { change: percent.format(change.fraction) })}
    </Text>
  );
}
