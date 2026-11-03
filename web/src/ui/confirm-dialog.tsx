import { Button } from "@slotted/react/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogIcon,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Children } from "react";
import type { ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

interface ConfirmDialogProps {
  title: string;
  // The one sentence the dialog announces: what the action does to what.
  description: string;
  confirmLabel: string;
  tone?: "danger" | "warning" | "accent";
  pending?: boolean;
  confirmDisabled?: boolean;
  // The answer of a failed action, shown above the buttons.
  error?: string | null;
  // What the reader reads or chooses before confirming; omitted when the description says it all.
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

// The app's confirmation of an action that is hard to undo: the library's alert dialog with its
// mark, its description, a cancel and the action. The action answers through onConfirm and leaves
// the dialog open, so a failure can be shown in it; the caller closes it when the action is done.
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  tone = "danger",
  pending = false,
  confirmDisabled = false,
  error = null,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const change = useStableCallback(
    (open: boolean, request: { reason: string; cancel: () => void }) => {
      if (request.reason === "submit") {
        request.cancel();
        return;
      }
      if (!open) onCancel();
    },
  );

  const hasBody = Children.toArray(children).length > 0 || error !== null;

  return (
    <AlertDialog open={overlayOpen} tone={tone} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <AlertDialogIcon />
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {hasBody && (
          <DialogBody>
            <Stack gap={4}>
              {children}
              {error !== null && (
                <InlineMessage tone="danger">{error}</InlineMessage>
              )}
            </Stack>
          </DialogBody>
        )}

        {/* Workaround for Slotted issue #60: render props type children as optional, so each Button
            repeats them. */}
        <DialogFooter>
          <AlertDialogCancel
            render={(props) => (
              <Button {...props} variant="outline" tone="secondary">
                {props.children}
              </Button>
            )}
          >
            {t("detail.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            render={(props) => (
              <Button
                {...props}
                tone={tone}
                loading={pending}
                disabled={confirmDisabled}
                onClick={onConfirm}
              >
                {props.children}
              </Button>
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  );
}
