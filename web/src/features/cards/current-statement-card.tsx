import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import { Heading } from "@slotted/react/typography";

import type { Statement } from "@/features/cards/statement-groups";
import { StatementStatusTag } from "@/features/cards/statement-status-tag";
import { useScale } from "@/features/setup";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";

export function CurrentStatementCard({ statement }: { statement: Statement }) {
  const t = useT();
  const [locale] = useAppLocale();
  const scale = useScale();
  if (scale === null) {
    return (
      <SkeletonRegion>
        <Skeleton shape="text" inlineSize="60%" />
        <Skeleton shape="text" inlineSize="40%" />
      </SkeletonRegion>
    );
  }
  return (
    <Card role="group" aria-label={t("cards.current.title")}>
      <CardHeader>
        <Heading level={2}>
          {formatReferenceMonth(statement.reference, locale)}
        </Heading>
        <CardActions>
          <StatementStatusTag status={statement.status} />
        </CardActions>
      </CardHeader>
      <CardBody>
        <DescriptionList>
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("cards.current.closing")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              {formatDate(statement.closing_date, locale)}
            </DescriptionListDescription>
          </DescriptionListItem>
          <DescriptionListItem>
            <DescriptionListTerm>{t("cards.current.due")}</DescriptionListTerm>
            <DescriptionListDescription>
              {formatDate(statement.due_date, locale)}
            </DescriptionListDescription>
          </DescriptionListItem>
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("cards.current.amountDue")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              <MoneyText
                money={statement.amount_due}
                scale={scale(statement.amount_due.currency)}
              />
            </DescriptionListDescription>
          </DescriptionListItem>
          <DescriptionListItem>
            <DescriptionListTerm>
              {t("cards.current.unpaid")}
            </DescriptionListTerm>
            <DescriptionListDescription>
              <MoneyText
                money={statement.unpaid}
                scale={scale(statement.unpaid.currency)}
              />
            </DescriptionListDescription>
          </DescriptionListItem>
        </DescriptionList>
      </CardBody>
    </Card>
  );
}
