import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemContent,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import { useDeleteIntegration } from "@/features/setup/api";
import type { Connection, Integration } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { FormNotice } from "@/ui/form-notice";

// Only an integration without connections is deleted; on `integration_in_use` the dialog lists
// the connections that use it, which the owner removes first.
export function IntegrationDeleteDialog({
  integration,
  connections,
  onClose,
}: {
  integration: Integration;
  connections: readonly Connection[];
  onClose: () => void;
}) {
  const t = useT();
  const remove = useDeleteIntegration();
  const [failure, setFailure] = useState<unknown>(null);

  const inUse =
    failure instanceof ProblemError &&
    failure.problem.code === "integration_in_use";
  const blocking = connections.filter(
    (c) => c.integration_id === integration.id,
  );

  function handleConfirm() {
    setFailure(null);
    remove
      .mutateAsync(integration.id)
      .then(onClose)
      .catch((caught: unknown) => {
        setFailure(caught);
      });
  }

  return (
    <ConfirmDialog
      title={t("settings.integrations.deleteTitle", { name: integration.name })}
      description={t("settings.integrations.deleteHint")}
      confirmLabel={t("settings.integrations.delete")}
      pending={remove.isPending}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      {failure !== null && <FormNotice>{errorText(failure, t)}</FormNotice>}
      {inUse && (
        <Stack gap={1}>
          <Text size="sm" tone="muted">
            {t("settings.integrations.blockedBy")}
          </Text>
          <List
            size="sm"
            variant="ruled"
            aria-label={t("settings.integrations.blockedBy")}
          >
            {blocking.map((c) => (
              <ListItem key={c.id}>
                <ListItemContent>
                  <ListItemLabel>{c.name}</ListItemLabel>
                </ListItemContent>
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
    </ConfirmDialog>
  );
}
