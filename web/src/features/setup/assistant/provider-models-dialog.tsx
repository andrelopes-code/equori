import { Text } from "@slotted/react/typography";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemContent,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { providerModelsQuery } from "@/features/setup/api";
import type { ModelProvider } from "@/features/setup/api";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { useStableCallback } from "@/ui/use-stable-callback";

// The listing calls the provider, which also tells whether its key works.
export function ProviderModelsDialog({
  provider,
  onClose,
}: {
  provider: ModelProvider;
  onClose: () => void;
}) {
  const t = useT();
  const models = useQuery(providerModelsQuery(useApi(), provider.id));
  const change = useStableCallback((open: boolean) => {
    if (!open) onClose();
  });
  return (
    <Dialog open size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("assistant.models.title", { name: provider.name })}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {models.isPending && <SkeletonText lines={4} />}
          {models.isError && (
            <FormNotice>{errorText(models.error, t)}</FormNotice>
          )}
          {models.data !== undefined &&
            (models.data.items.length === 0 ? (
              <Text size="sm" tone="muted">
                {t("assistant.models.empty")}
              </Text>
            ) : (
              <List
                size="sm"
                variant="ruled"
                aria-label={t("assistant.models.title", {
                  name: provider.name,
                })}
              >
                {models.data.items.map((id) => (
                  <ListItem key={id}>
                    <ListItemContent>
                      <ListItemLabel>{id}</ListItemLabel>
                    </ListItemContent>
                  </ListItem>
                ))}
              </List>
            ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onClose}>
            {t("detail.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
