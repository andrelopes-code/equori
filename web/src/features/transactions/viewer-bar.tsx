import { ButtonLink, IconButton } from "@slotted/react/button";
import { DialogDescription, DialogTitle } from "@slotted/react/dialog";
import { Glyph, Icon } from "@slotted/react/icon";

import type { components } from "@/api/schema.gen";
import { contentURL } from "@/features/transactions/attachment-meta";
import styles from "@/features/transactions/attachment-viewer.module.css";
import { useT } from "@/i18n/i18n-provider";

type Attachment = components["schemas"]["Attachment"];

export interface ViewerBarProps {
  file: Attachment;
  index: number;
  count: number;
  onClose: () => void;
}

// The viewer's top bar: the file's name and place, the download and, at the end, the way out.
export function ViewerBar({ file, index, count, onClose }: ViewerBarProps) {
  const t = useT();

  return (
    <header className={styles.bar}>
      <div className={styles.heading}>
        <DialogTitle className={styles.title}>{file.file_name}</DialogTitle>
        <DialogDescription className={styles.place}>
          {t("attachment.position", { index: index + 1, count })}
        </DialogDescription>
      </div>

      <ButtonLink
        variant="outline"
        tone="secondary"
        href={contentURL(file.id)}
        download={file.file_name}
        start={
          <Icon size="sm">
            <Glyph name="arrow-down" />
          </Icon>
        }
      >
        {t("attachment.download")}
      </ButtonLink>

      <IconButton aria-label={t("attachment.close")} onClick={onClose}>
        <Icon>
          <Glyph name="x" />
        </Icon>
      </IconButton>
    </header>
  );
}
