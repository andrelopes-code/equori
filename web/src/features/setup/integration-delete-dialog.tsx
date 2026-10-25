import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
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
import { useStableCallback } from "@/ui/use-stable-callback";

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
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  const inUse =
    failure instanceof ProblemError &&
    failure.problem.code === "integration_in_use";
  const blocking = connections.filter(
    (c) => c.integration_id === integration.id,
  );

  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings.integrations.deleteTitle", { name: integration.name })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.integrations.deleteHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {failure !== null && (
            <Stack gap={3}>
              <InlineMessage tone="danger">
                {errorText(failure, t)}
              </InlineMessage>
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
            </Stack>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.cancel")}
          </Button>
          <Button
            tone="danger"
            loading={remove.isPending}
            onClick={() => {
              setFailure(null);
              remove
                .mutateAsync(integration.id)
                .then(onClose)
                .catch((caught: unknown) => {
                  setFailure(caught);
                });
            }}
          >
            {t("settings.integrations.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
