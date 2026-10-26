import { Button } from "@slotted/react/button";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { readQueue, removeQueued } from "@/features/transactions/capture-queue";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// P5 of ADR 022: the signed-in user's texts written offline; Review opens one in the text capture.
export function CaptureQueuePage() {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const me = useQuery({ ...meQuery(api), staleTime: Infinity });
  // A discard bumps the version, so the list is read again from storage.
  const [, setVersion] = useState(0);
  const entries = me.data === undefined ? [] : readQueue(me.data.id);

  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("queue.title")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
          <PageHeaderDescription>{t("queue.subheading")}</PageHeaderDescription>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <List variant="separated" aria-label={t("queue.title")}>
          <ListSection label={t("queue.title")}>
            {entries.length === 0 ? (
              <ListEmpty>{t("queue.empty")}</ListEmpty>
            ) : (
              entries.map((entry) => (
                <ListItem key={entry.id}>
                  <ListItemContent>
                    <ListItemBody>
                      <ListItemLabel>{entry.text}</ListItemLabel>
                      <ListItemDescription>
                        {t("queue.writtenOn", {
                          date: formatDate(entry.capturedOn, locale),
                        })}
                      </ListItemDescription>
                    </ListItemBody>
                  </ListItemContent>
                  <ListItemActions>
                    <Button
                      size="sm"
                      onClick={() => {
                        void navigate({
                          to: "/transactions/capture",
                          search: { queued: entry.id },
                        });
                      }}
                    >
                      {t("queue.process")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      tone="secondary"
                      onClick={() => {
                        removeQueued(entry.id);
                        setVersion((v) => v + 1);
                      }}
                    >
                      {t("queue.discard")}
                    </Button>
                  </ListItemActions>
                </ListItem>
              ))
            )}
          </ListSection>
        </List>
      </PageBody>
    </Page>
  );
}
