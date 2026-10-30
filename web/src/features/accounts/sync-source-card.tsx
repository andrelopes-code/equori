import { Card, CardBody, CardHeader } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useId } from "react";

import type { Linked } from "@/features/accounts/account-tab-panel";
import { subtypeWords } from "@/features/accounts/external-subtype";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface SyncSourceCardProps {
  linked: Linked;
}

// Where the account's entries come from: the connection, its external account and the first day
// imported (A35).
export function SyncSourceCard({ linked }: SyncSourceCardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const titleId = useId();

  const { connection, external } = linked;
  const subtype = subtypeWords[external.subtype];
  const detail = [
    subtype === undefined ? external.subtype : t(subtype),
    external.number_last4 === undefined
      ? undefined
      : t("account.lastFour", { digits: external.number_last4 }),
  ]
    .filter((p) => p !== undefined)
    .join(" · ");

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <Heading id={titleId} level={3} size="md">
          {t("sync.source")}
        </Heading>
      </CardHeader>

      <CardBody>
        <DescriptionList>
          <DescriptionListItem>
            <DescriptionListTerm>{t("sync.connection")}</DescriptionListTerm>
            <DescriptionListDescription>
              {connection.name}
            </DescriptionListDescription>
          </DescriptionListItem>
          <DescriptionListItem>
            <DescriptionListTerm>{t("sync.external")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Stack gap={0}>
                <Text size="md">{external.name}</Text>
                <Text size="xs" tone="muted">
                  {detail}
                </Text>
              </Stack>
            </DescriptionListDescription>
          </DescriptionListItem>
          {external.sync_from !== undefined && (
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.from")}</DescriptionListTerm>
              <DescriptionListDescription>
                {formatDate(external.sync_from, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
          )}
        </DescriptionList>
      </CardBody>
    </Card>
  );
}
