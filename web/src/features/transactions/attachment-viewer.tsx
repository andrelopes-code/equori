import { ButtonLink, IconButton } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useEffect, useState } from "react";

import type { components } from "@/api/schema.gen";
import styles from "@/features/transactions/attachment-viewer.module.css";
import { useViewerGestures } from "@/features/transactions/use-viewer-gestures";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Attachment = components["schemas"]["Attachment"];

const minZoom = 1;
const maxZoom = 4;
const zoomStep = 0.25;

export function contentURL(id: string): string {
  return `/api/v1/attachments/${id}/content`;
}

const clamp = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom));

// The viewer of the image and PDF attachments of one transaction. A PDF is shown in a frame of
// the content with `disposition=inline`, the one response that admits a frame (ADR 007, C9a);
// the browser's own reader zooms and pages it, so the zoom buttons wait for an image.
export function AttachmentViewer({
  files,
  currentId,
  onChange,
  onClose,
}: {
  files: readonly Attachment[];
  currentId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [tag] = useAppLocale();
  const [zoom, setZoom] = useState(1);
  const index = files.findIndex((file) => file.id === currentId);
  const current = files[index];
  const isPdf = current?.media_type === "application/pdf";

  const step = (direction: 1 | -1) => {
    const target = files[index + direction];
    if (target === undefined) return;
    setZoom(1);
    onChange(target.id);
  };
  const zoomTo = (next: number) => {
    setZoom(clamp(next));
  };
  const stageRef = useViewerGestures({ zoom, onStep: step, onZoom: zoomTo });

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
      size="xl"
      fullscreenToggle
      onOpenChange={(open) => {
        if (open) return;
        setZoom(1);
        onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current?.file_name}</DialogTitle>
          <DialogDescription>
            {t("attachment.position", {
              index: index + 1,
              count: files.length,
            })}
          </DialogDescription>
          <DialogClose />
        </DialogHeader>
        <DialogBody>
          {current !== undefined && (
            <div ref={stageRef} className={styles.stage}>
              {isPdf ? (
                <iframe
                  className={styles.frame}
                  src={`${contentURL(current.id)}?disposition=inline`}
                  title={current.file_name}
                />
              ) : (
                <img
                  className={
                    zoom === 1
                      ? styles.image
                      : [styles.image, styles.zoomed].join(" ")
                  }
                  style={
                    zoom === 1
                      ? undefined
                      : { inlineSize: `${String(zoom * 100)}%` }
                  }
                  src={contentURL(current.id)}
                  alt={current.file_name}
                  draggable={false}
                />
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Inline gap={2} align="center" className={styles.toolbar}>
            <IconButton
              aria-label={t("attachment.previous")}
              variant="outline"
              tone="secondary"
              disabled={index <= 0}
              onClick={() => {
                step(-1);
              }}
            >
              <Icon>
                <Glyph name="arrow-left" />
              </Icon>
            </IconButton>
            <IconButton
              aria-label={t("attachment.next")}
              variant="outline"
              tone="secondary"
              disabled={index >= files.length - 1}
              onClick={() => {
                step(1);
              }}
            >
              <Icon>
                <Glyph name="arrow-right" />
              </Icon>
            </IconButton>
            <IconButton
              aria-label={t("attachment.zoomOut")}
              variant="outline"
              tone="secondary"
              disabled={isPdf || zoom <= minZoom}
              onClick={() => {
                zoomTo(zoom - zoomStep);
              }}
            >
              <Icon>
                <Glyph name="minus" />
              </Icon>
            </IconButton>
            <Text size="sm" className={styles.zoom}>
              {numberFormatter(tag, { style: "percent" }).format(zoom)}
            </Text>
            <IconButton
              aria-label={t("attachment.zoomIn")}
              variant="outline"
              tone="secondary"
              disabled={isPdf || zoom >= maxZoom}
              onClick={() => {
                zoomTo(zoom + zoomStep);
              }}
            >
              <Icon>
                <Glyph name="plus" />
              </Icon>
            </IconButton>
            <IconButton
              aria-label={t("attachment.zoomReset")}
              variant="outline"
              tone="secondary"
              disabled={isPdf || zoom === 1}
              onClick={() => {
                setZoom(1);
              }}
            >
              <Icon>
                <Glyph name="rotate-ccw" />
              </Icon>
            </IconButton>
            {current !== undefined && (
              <ButtonLink
                variant="outline"
                tone="secondary"
                href={contentURL(current.id)}
                download={current.file_name}
                start={
                  <Icon size="sm">
                    <Glyph name="arrow-down" />
                  </Icon>
                }
              >
                {t("attachment.download")}
              </ButtonLink>
            )}
          </Inline>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
