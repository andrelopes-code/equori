import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { useEffect, useRef } from "react";

import { useGrow } from "@/features/help/steps/use-grow";
import styles from "@/features/help/styles/help.module.css";
import { useT } from "@/i18n/i18n-provider";

interface HelpPlayerProps {
  src: string;
  label: string;
  // The place of the element the reader pressed; the player grows from it.
  origin: DOMRect | null;
  onClose: () => void;
}

// Families read: media-viewer (opens at once over the whole window, with no tie to the place of
// the video), dialog (a panel with a header and a footer). The video of the steps at the size of
// the window, grown from where it stood on the page, so the whole screen of the app stays
// legible (owner, 2026-11-18); this screen's form.
export function HelpPlayer({ src, label, origin, onClose }: HelpPlayerProps) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;

    // jsdom has no top layer: the dialog opens in the flow.
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  useGrow(panel, origin);

  return (
    <dialog
      ref={dialog}
      className={styles.player}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // A press on the dimmed ground around the player closes it.
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className={styles.playerPanel} ref={panel}>
        <video
          className={styles.playerVideo}
          src={src}
          aria-label={label}
          autoPlay
          controls
          muted
          playsInline
        />
        <span className={styles.playerClose}>
          <IconButton
            variant="solid"
            tone="secondary"
            aria-label={t("help.video.close")}
            onClick={onClose}
          >
            <Icon>
              <Glyph name="x" />
            </Icon>
          </IconButton>
        </span>
      </div>
    </dialog>
  );
}
