import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";

import type { components } from "@/api/schema.gen";
import { CardDialogFields } from "@/features/cards/plastic-cards-tab/card-dialog-fields";
import type { FaceBase } from "@/features/cards/plastic-cards-tab/plastic-card-faces";
import { useCardForm } from "@/features/cards/plastic-cards-tab/use-card-form";
import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/dialogs/use-overlay-open";
import { useStableCallback } from "@/ui/runtime/use-stable-callback";

type Card = components["schemas"]["Card"];

interface AddCardDialogProps {
  accountId: string;
  base: FaceBase;
  card?: Card;
  onDone: () => void;
  onCancel: () => void;
}

// Adds a card to the account; given a card, edits its holder, last four digits and network.
export function AddCardDialog({
  accountId,
  base,
  card,
  onDone,
  onCancel,
}: AddCardDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const form = useCardForm(accountId, card, onDone);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const label = t(card === undefined ? "card.addCard" : "card.editCard");

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <form noValidate onSubmit={form.submit}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <CardDialogFields form={form} card={card} base={base} />
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" tone="secondary" onClick={onCancel}>
              {t("detail.cancel")}
            </Button>
            <Button type="submit" loading={form.pending}>
              {card === undefined ? label : t("detail.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
