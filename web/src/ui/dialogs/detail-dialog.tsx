import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@slotted/react/dialog";
import type { DialogChangeRequest } from "@slotted/react/dialog";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/dialogs/detail-dialog.module.css";

export interface DetailDialogProps {
  title: string;
  // The one sentence the layer announces: what it lists.
  description: string;
  // The line beside the trigger: what the layer holds, readable without opening it.
  summary: ReactNode;
  triggerLabel: string;
  children: ReactNode;
}

// A layer for the detail of a block: the summary line and its trigger sit in the page, the body
// mounts when the layer opens and unmounts after its exit ends.
export function DetailDialog({
  title,
  description,
  summary,
  triggerLabel,
  children,
}: DetailDialogProps) {
  const t = useT();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function handleOpenChange(next: boolean, request: DialogChangeRequest) {
    // Workaround for Slotted issue #96: a press on the backdrop of a dialog stacked on this one
    // also reaches this dialog; only a press on this dialog's own backdrop closes it.
    if (!next && request.reason === "outsidePress" && pressedAbove(request)) {
      request.cancel();
      return;
    }

    setOpen(next);
    if (next) setMounted(true);
  }

  function handleOpenChangeComplete(settled: boolean) {
    if (!settled) setMounted(false);
  }

  function pressedAbove(request: DialogChangeRequest): boolean {
    const source = request.source;
    const target = source instanceof Event ? source.target : null;
    const own = contentRef.current?.closest('[data-ui="dialog"]');
    const pressed =
      target instanceof Element ? target.closest('[data-ui="dialog"]') : null;

    return pressed !== null && pressed !== own;
  }

  return (
    <Inline align="center" gap={4} wrap="wrap">
      {summary !== null && <Text size="sm">{summary}</Text>}

      <Dialog
        open={open}
        size="full"
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={handleOpenChangeComplete}
      >
        <DialogTrigger
          render={(props) => (
            <Button {...props} size="sm" variant="outline" tone="secondary">
              {triggerLabel}
            </Button>
          )}
        />

        <DialogContent ref={contentRef} className={styles.layer}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogBody>{mounted && children}</DialogBody>

          <DialogFooter>
            <DialogClose
              render={(props) => (
                <Button {...props} variant="outline" tone="secondary">
                  {t("detail.layer.close")}
                </Button>
              )}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Inline>
  );
}
