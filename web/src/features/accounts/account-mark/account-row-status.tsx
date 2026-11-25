import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { reconciliationQuery } from "@/features/accounts/api";
import { formatDate, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { TitleTag } from "@/ui/display/title-tag";

type Account = components["schemas"]["Account"];

// Whether the ledger agrees with the institution: the last date it did, or the difference that
// waits. A card agrees statement by statement and a parent through its sub-accounts, so neither
// carries the mark. A quiet status, the one of the list, frames only a difference: an account
// reconciled or never reconciled is a line of text, so a list of many rows stays calm (AL11).
export function AccountRowStatus({
  account,
  scale,
  quiet = false,
  compact = false,
}: {
  account: Account;
  scale: (code: string) => number;
  quiet?: boolean;
  // A phone row: a date of the year in course drops the year, so the line keeps one line.
  compact?: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const card = account.kind === "credit_card";
  const status = useQuery({
    ...reconciliationQuery(useApi(), account.id),
    enabled: !card,
  });
  // A disabled query still returns what the overview cached.
  if (card || status.data === undefined) return null;

  // K9, K10: a property is valued, not reconciled with an institution.
  const property = account.kind === "property";
  const neverKey = property
    ? "property.neverValuedTag"
    : "reconciliation.tag.never";
  const onKey = property ? "property.valuedTag" : "reconciliation.tag.on";
  const open = status.data.open_difference;
  if (open !== undefined) {
    const text = t("reconciliation.tag.open", {
      amount: fmt.money(open.difference, scale(open.difference.currency)),
    });

    // The header of the account draws it among tags of its own size (O22).
    return quiet ? (
      <TitleTag tone="warning">{text}</TitleTag>
    ) : (
      <Tag size="sm" tone="warning">
        {text}
      </Tag>
    );
  }
  const last = status.data.last_reconciled_on;
  if (quiet) {
    return last === undefined ? (
      <Text size="xs" tone="muted">
        {t(neverKey)}
      </Text>
    ) : (
      <Inline gap={2} wrap="nowrap" align="center">
        <Icon size="sm" tone="success">
          <Glyph name="check" />
        </Icon>
        <Text size="xs" tone="success">
          {t(onKey, {
            date:
              compact && last.slice(0, 4) === today.slice(0, 4)
                ? formatDayMonthNumeric(last, locale)
                : formatDate(last, locale),
          })}
        </Text>
      </Inline>
    );
  }
  return last === undefined ? (
    <Tag size="sm" tone="secondary">
      {t(neverKey)}
    </Tag>
  ) : (
    <Tag size="sm" tone="success">
      {t(onKey, { date: formatDate(last, locale) })}
    </Tag>
  );
}
