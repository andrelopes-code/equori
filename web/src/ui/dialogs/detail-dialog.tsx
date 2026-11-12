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
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useState } from "react";
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
// mounts only while the layer is open.
export function DetailDialog({
  title,
  description,
  summary,
  triggerLabel,
  children,
}: DetailDialogProps) {
  const t = useT();

  const [open, setOpen] = useState(false);

  return (
    <Inline align="center" gap={4} wrap="wrap">
      <Text size="sm">{summary}</Text>

      <Dialog open={open} onOpenChange={setOpen} size="full">
        <DialogTrigger
          render={(props) => (
            <Button {...props} size="sm" variant="outline" tone="secondary">
              {triggerLabel}
            </Button>
          )}
        />

        <DialogContent className={styles.layer}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogBody>{open && children}</DialogBody>

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
