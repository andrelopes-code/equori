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
import { Text } from "@slotted/react/typography";

import type { ReviewSelection } from "@/features/accounts/use-review-selection";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface DiscardLinesDialogProps {
  selection: ReviewSelection;
}

export function DiscardLinesDialog({ selection }: DiscardLinesDialogProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const { total } = selection;

  return (
    <Dialog
      open={selection.discarding}
      onOpenChange={selection.setDiscarding}
      size="sm"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("reviewSelection.discardTitle", {
              count: selection.selected.length,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("reviewSelection.discardDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {total !== undefined && scale !== null && (
            <Text>
              {t("bulk.total", {
                amount: fmt.signed(total, scale(total.currency)),
              })}
            </Text>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            tone="secondary"
            onClick={() => {
              selection.setDiscarding(false);
            }}
          >
            {t("detail.cancel")}
          </Button>
          <Button tone="danger" onClick={selection.discard}>
            {t("reviewSelection.discard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
