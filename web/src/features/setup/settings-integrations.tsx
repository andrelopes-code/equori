import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  aggregatorsQuery,
  integrationConnectionsQuery,
  integrationsQuery,
} from "@/features/setup/api";
import type { Integration } from "@/features/setup/api";
import { IntegrationDeleteDialog } from "@/features/setup/integration-delete-dialog";
import { IntegrationDialog } from "@/features/setup/integration-dialog";
import { SettingsSection } from "@/features/setup/settings-section";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Open =
  | { kind: "create" }
  | { kind: "rotate"; integration: Integration }
  | { kind: "delete"; integration: Integration };

// The credentials of the aggregators the connections draw on (ADR 008); a stored credential is
// never read back, so a row says only when it was last replaced.
export function SettingsIntegrations() {
  const t = useT();
  const api = useApi();
  const [locale] = useAppLocale();
  const aggregators = useQuery(aggregatorsQuery(api));
  const integrations = useQuery(integrationsQuery(api));
  const connections = useQuery(integrationConnectionsQuery(api));
  const [open, setOpen] = useState<Open | null>(null);
  const close = () => {
    setOpen(null);
  };
  const failure = aggregators.error ?? integrations.error ?? connections.error;
  const names = new Map((aggregators.data ?? []).map((a) => [a.id, a.name]));
  const connectionItems = connections.data?.items ?? [];
  const count = (id: string) =>
    connectionItems.filter((c) => c.integration_id === id).length;

  return (
    <SettingsSection
      topic="integrations"
      title={t("settings.integrations.title")}
      description={t("settings.integrations.description")}
    >
      <Stack gap={5}>
        {failure !== null && (
          <InlineMessage tone="danger">{errorText(failure, t)}</InlineMessage>
        )}
        {integrations.isPending ? (
          <SkeletonText lines={3} />
        ) : (
          <List variant="ruled" aria-label={t("settings.integrations.title")}>
            {(integrations.data ?? []).length === 0 && (
              <ListEmpty>{t("settings.integrations.empty")}</ListEmpty>
            )}
            {(integrations.data ?? []).map((integration) => (
              <ListItem key={integration.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{integration.name}</ListItemLabel>
                    <ListItemDescription>
                      {[
                        names.get(integration.aggregator) ??
                          integration.aggregator,
                        t("settings.integrations.updated", {
                          date: formatDate(
                            integration.updated_at.slice(0, 10),
                            locale,
                          ),
                        }),
                        t("settings.integrations.connections", {
                          count: new Intl.NumberFormat(locale).format(
                            count(integration.id),
                          ),
                        }),
                      ].join(" · ")}
                    </ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
                <ListItemActions>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="secondary"
                    onClick={() => {
                      setOpen({ kind: "rotate", integration });
                    }}
                  >
                    {t("settings.integrations.rotate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="danger"
                    onClick={() => {
                      setOpen({ kind: "delete", integration });
                    }}
                  >
                    {t("settings.integrations.delete")}
                  </Button>
                </ListItemActions>
              </ListItem>
            ))}
          </List>
        )}
        <div>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            disabled={(aggregators.data ?? []).length === 0}
            onClick={() => {
              setOpen({ kind: "create" });
            }}
          >
            {t("settings.integrations.add")}
          </Button>
        </div>
      </Stack>
      {open?.kind === "create" && (
        <IntegrationDialog
          aggregators={aggregators.data ?? []}
          integration={null}
          onClose={close}
        />
      )}
      {open?.kind === "rotate" && (
        <IntegrationDialog
          aggregators={aggregators.data ?? []}
          integration={open.integration}
          onClose={close}
        />
      )}
      {open?.kind === "delete" && (
        <IntegrationDeleteDialog
          integration={open.integration}
          connections={connectionItems}
          onClose={close}
        />
      )}
    </SettingsSection>
  );
}
