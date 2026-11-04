import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { UpgradeCompose } from "@/features/instance/upgrade-compose";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";

interface UpgradeDialogProps {
  version: string;
  distribution: components["schemas"]["VersionStatus"]["distribution"];
  onClose: () => void;
}

// A195.2: the upgrade differs per form, so the dialog shows the one of this instance.
export function UpgradeDialog({
  version,
  distribution,
  onClose,
}: UpgradeDialogProps) {
  const t = useT();

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upgrade.title", { version })}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Stack gap={4}>
            {distribution === "compose" && <UpgradeCompose version={version} />}
            {distribution === "managed" && <Text>{t("upgrade.managed")}</Text>}
            {distribution === "other" && <Text>{t("upgrade.other")}</Text>}
            <Text size="sm">
              <Link
                render={routeTo({
                  to: "/help/$page",
                  params: { page: "installation" },
                })}
              >
                {t("upgrade.help")}
              </Link>
            </Text>
          </Stack>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" tone="secondary" onClick={onClose}>
            {t("upgrade.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
