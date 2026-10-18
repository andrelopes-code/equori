import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import type { Statement } from "@/features/cards/statement-groups";
import { StatementStatusTag } from "@/features/cards/statement-status-tag";
import { useScale } from "@/features/setup";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";
import { useSpaLink } from "@/ui/use-spa-link";

export function StatementList({
  accountId,
  upcoming,
  past,
}: {
  accountId: string;
  upcoming: Statement[];
  past: Statement[];
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const scale = useScale();
  const spaLink = useSpaLink();
  if (scale === null) {
    return (
      <SkeletonRegion>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} shape="text" inlineSize="60%" />
        ))}
      </SkeletonRegion>
    );
  }
  const groups = [
    { key: "upcoming", label: t("cards.group.upcoming"), statements: upcoming },
    { key: "past", label: t("cards.group.past"), statements: past },
  ].filter((group) => group.statements.length > 0);
  return groups.map(({ key, label, statements }) => (
    <Section key={key}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{label}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <List variant="ruled" aria-label={label}>
          {statements.map((statement) => (
            <ListItem key={statement.id}>
              <ListItemLink
                {...spaLink(`/cards/${accountId}/statements/${statement.id}`)}
              >
                <ListItemBody>
                  <ListItemLabel>
                    {formatReferenceMonth(statement.reference, locale)}
                  </ListItemLabel>
                  <ListItemDescription>
                    {t("cards.statement.due", {
                      date: formatDate(statement.due_date, locale),
                    })}
                  </ListItemDescription>
                </ListItemBody>
                <ListItemEnd>
                  <StatementStatusTag status={statement.status} />
                  <MoneyText
                    money={statement.amount_due}
                    scale={scale(statement.amount_due.currency)}
                  />
                </ListItemEnd>
              </ListItemLink>
            </ListItem>
          ))}
        </List>
      </SectionBody>
    </Section>
  ));
}
