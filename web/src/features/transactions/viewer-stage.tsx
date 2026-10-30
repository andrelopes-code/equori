import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import type { MouseEvent } from "react";
import { useRef } from "react";

import type { components } from "@/api/schema.gen";
import { contentURL } from "@/features/transactions/attachment-meta";
import styles from "@/features/transactions/attachment-viewer.module.css";
import type { Point, Size } from "@/features/transactions/viewer-fit";
import { useT } from "@/i18n/i18n-provider";

type Attachment = components["schemas"]["Attachment"];

// A press that moves farther than this is a drag or a swipe, not a click on the ground.
const clickSlop = 6;

export interface ViewerStageProps {
  file: Attachment;
  zoom: number;
  // The picture's drawn size; null until the picture and the stage are measured.
  size: Size | null;
  hasPrevious: boolean;
  hasNext: boolean;
  stageRef: (stage: HTMLDivElement | null) => void;
  onLoad: (image: HTMLImageElement) => void;
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}

// The picture or the PDF between the viewer's bars, with the steps at its sides. The stage keeps
// its size and scrolls a zoomed picture; a click on the ground around the picture closes the viewer.
export function ViewerStage({
  file,
  zoom,
  size,
  hasPrevious,
  hasNext,
  stageRef,
  onLoad,
  onStep,
  onClose,
}: ViewerStageProps) {
  const t = useT();
  const press = useRef<Point | null>(null);

  const isPdf = file.media_type === "application/pdf";

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const from = press.current;
    press.current = null;
    if (from === null || event.target !== event.currentTarget) return;

    const moved = Math.hypot(event.clientX - from.x, event.clientY - from.y);
    if (moved <= clickSlop) onClose();
  }

  return (
    <div className={styles.area}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-zoomed={zoom > 1 || undefined}
        onPointerDown={(event) => {
          press.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={handleClick}
      >
        {isPdf && (
          <iframe
            className={styles.frame}
            src={`${contentURL(file.id)}?disposition=inline`}
            title={file.file_name}
          />
        )}
        {!isPdf && (
          <img
            key={file.id}
            className={styles.image}
            style={size === null ? undefined : drawnAt(size)}
            src={contentURL(file.id)}
            alt={file.file_name}
            draggable={false}
            onLoad={(event) => {
              onLoad(event.currentTarget);
            }}
          />
        )}
      </div>

      <IconButton
        className={[styles.side, styles.previous].join(" ")}
        aria-label={t("attachment.previous")}
        variant="solid"
        shape="circle"
        size="lg"
        disabled={!hasPrevious}
        onClick={() => {
          onStep(-1);
        }}
      >
        <Icon>
          <Glyph name="arrow-left" />
        </Icon>
      </IconButton>
      <IconButton
        className={[styles.side, styles.next].join(" ")}
        aria-label={t("attachment.next")}
        variant="solid"
        shape="circle"
        size="lg"
        disabled={!hasNext}
        onClick={() => {
          onStep(1);
        }}
      >
        <Icon>
          <Glyph name="arrow-right" />
        </Icon>
      </IconButton>
    </div>
  );
}

function drawnAt(size: Size) {
  return {
    inlineSize: `${String(size.width)}px`,
    blockSize: `${String(size.height)}px`,
    maxInlineSize: "none",
    maxBlockSize: "none",
  };
}
