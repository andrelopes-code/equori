import { Dialog, DialogContent } from "@slotted/react/dialog";
import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/transactions/attachment-viewer.module.css";
import { useViewerGestures } from "@/features/transactions/use-viewer-gestures";
import {
  useViewerZoom,
  zoomStep,
} from "@/features/transactions/use-viewer-zoom";
import { ViewerBar } from "@/features/transactions/viewer-bar";
import { ViewerStage } from "@/features/transactions/viewer-stage";
import { ViewerZoom } from "@/features/transactions/viewer-zoom";

type Attachment = components["schemas"]["Attachment"];

export interface AttachmentViewerProps {
  files: readonly Attachment[];
  currentId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
}

// Workaround for Slotted issue #50: no family draws the viewer an attachment's trigger opens, so
// this one is the application's own until the library ships it; it and its viewer-*.tsx, viewer-fit
// and use-viewer-* files are deleted then. Families read: dialog (its plain surface keeps the layer,
// the focus and the dismissal, and paints nothing), image (it leaves zoom and preview to Dialog),
// carousel and attachment; none fits a picture to the screen, zooms and pans it.
//
// The whole screen over a dark ground, the file between a top bar and the zoom. A PDF is shown in
// a frame of the content with `disposition=inline`, the one response that admits a frame (ADR 007,
// C9a); the browser's own reader zooms and pages it, so the zoom waits for an image.
export function AttachmentViewer({
  files,
  currentId,
  onChange,
  onClose,
}: AttachmentViewerProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const { zoom, size, zoomTo, fit, reset, onLoad } = useViewerZoom(stage);

  const index = files.findIndex((file) => file.id === currentId);
  const current = files[index];

  const step = (direction: 1 | -1) => {
    const target = files[index + direction];
    if (target === undefined) return;

    reset();
    onChange(target.id);
  };

  useViewerGestures(stage, { zoom, onStep: step, onZoom: zoomTo });

  // On the window: a button that disables at the end of the list drops the focus out of the dialog.
  useEffect(() => {
    if (current === undefined) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "+" || event.key === "=") zoomTo(zoom + zoomStep);
      else if (event.key === "-") zoomTo(zoom - zoomStep);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return (
    <Dialog
      open={current !== undefined}
      size="full"
      fullScreen="always"
      surface="plain"
      onOpenChange={(open) => {
        if (open) return;
        reset();
        onClose();
      }}
    >
      <DialogContent data-slotted-scheme="dark" className={styles.viewer}>
        {current !== undefined && (
          <ViewerBar
            file={current}
            index={index}
            count={files.length}
            onClose={onClose}
          />
        )}

        {current !== undefined && (
          <ViewerStage
            file={current}
            zoom={zoom}
            size={size}
            hasPrevious={index > 0}
            hasNext={index < files.length - 1}
            stageRef={setStage}
            onLoad={onLoad}
            onStep={step}
            onClose={onClose}
          />
        )}

        {current?.media_type.startsWith("image/") === true && (
          <ViewerZoom zoom={zoom} onZoom={zoomTo} onFit={fit} />
        )}
      </DialogContent>
    </Dialog>
  );
}
