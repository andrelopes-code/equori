import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import styles from "@/features/transactions/attachment-viewer.module.css";
import {
  maxZoom,
  minZoom,
  zoomStep,
} from "@/features/transactions/use-viewer-zoom";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface ViewerZoomProps {
  zoom: number;
  onZoom: (next: number) => void;
  onFit: () => void;
}

// The zoom of a picture, floating under it: out, the level, in, and back to the fitted picture.
export function ViewerZoom({ zoom, onZoom, onFit }: ViewerZoomProps) {
  const t = useT();
  const [tag] = useAppLocale();

  return (
    <div className={styles.zoom}>
      <IconButton
        shape="circle"
        aria-label={t("attachment.zoomOut")}
        disabled={zoom <= minZoom}
        onClick={() => {
          onZoom(zoom - zoomStep);
        }}
      >
        <Icon>
          <Glyph name="minus" />
        </Icon>
      </IconButton>
      <Text size="sm" className={styles.level}>
        {numberFormatter(tag, { style: "percent" }).format(zoom)}
      </Text>
      <IconButton
        shape="circle"
        aria-label={t("attachment.zoomIn")}
        disabled={zoom >= maxZoom}
        onClick={() => {
          onZoom(zoom + zoomStep);
        }}
      >
        <Icon>
          <Glyph name="plus" />
        </Icon>
      </IconButton>
      <IconButton
        shape="circle"
        aria-label={t("attachment.zoomReset")}
        disabled={zoom === minZoom}
        onClick={onFit}
      >
        <Icon>
          <Glyph name="rotate-ccw" />
        </Icon>
      </IconButton>
    </div>
  );
}
