import { Card, CardBody, CardHeader } from "@slotted/react/card";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Heading } from "@slotted/react/typography";
import { useId } from "react";

import type { Linked } from "@/features/accounts/account-tab-panel";
import { formatInstant } from "@/features/accounts/instant";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

const providerWords: Record<string, MessageKey> = {
  UPDATED: "sync.provider.UPDATED",
  UPDATING: "sync.provider.UPDATING",
  LOGIN_ERROR: "sync.provider.LOGIN_ERROR",
  OUTDATED: "sync.provider.OUTDATED",
  WAITING_USER_INPUT: "sync.provider.WAITING_USER_INPUT",
};

interface SyncFreshnessCardProps {
  linked: Linked;
  portal: string;
}

// How fresh the link is: the bank connection's state, the last sync and the bank's own
// fetches (A43).
export function SyncFreshnessCard({ linked, portal }: SyncFreshnessCardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const titleId = useId();

  const { connection, external } = linked;
  const provider = providerWords[connection.provider_status];

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <Heading id={titleId} level={3} size="md">
          {t("sync.freshness")}
        </Heading>
      </CardHeader>

      <CardBody>
        <DescriptionList>
          <DescriptionListItem>
            <DescriptionListTerm>{t("sync.status")}</DescriptionListTerm>
            <DescriptionListDescription>
              {provider === undefined
                ? connection.provider_status
                : t(provider, { portal })}
            </DescriptionListDescription>
          </DescriptionListItem>
          <DescriptionListItem>
            <DescriptionListTerm>{t("sync.lastSynced")}</DescriptionListTerm>
            <DescriptionListDescription>
              {external.last_synced_on === undefined
                ? t("sync.never")
                : formatDate(external.last_synced_on, locale)}
            </DescriptionListDescription>
          </DescriptionListItem>
          {connection.last_item_update_at !== undefined && (
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.bankData")}</DescriptionListTerm>
              <DescriptionListDescription>
                {formatInstant(connection.last_item_update_at, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
          )}
          {connection.next_item_update_at !== undefined && (
            <DescriptionListItem>
              <DescriptionListTerm>{t("sync.nextFetch")}</DescriptionListTerm>
              <DescriptionListDescription>
                {formatInstant(connection.next_item_update_at, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
          )}
        </DescriptionList>
      </CardBody>
    </Card>
  );
}
