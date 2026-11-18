import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { useEffect, useMemo, useRef } from "react";

import type { HelpVideoMedia } from "@/features/help/media/help-media";
import type { HelpStep } from "@/features/help/model/parse-help-page";
import { HelpStepLine } from "@/features/help/steps/help-step-line";
import { shrinkTo, useGrow } from "@/features/help/steps/use-grow";
import styles from "@/features/help/styles/help.module.css";
import { HelpCanvas } from "@/features/help/video/help-canvas";
import { useT } from "@/i18n/i18n-provider";

interface HelpPlayerProps {
  video: HelpVideoMedia;
  label: string;
  // The steps the video shows, listed beside it.
  steps: readonly HelpStep[];
  // The place of the element the reader pressed; the player grows from it.
  origin: DOMRect | null;
  onClose: () => void;
}

// Families read: media-viewer (opens at once over the whole window, with no tie to the place of
// the video), dialog (a panel with a header and a footer). The video of the steps at the size of
// the window, grown from where it stood on the page, so the whole screen of the app stays
// legible (owner, 2026-11-18); this screen's form.
export function HelpPlayer({
  video,
  label,
  steps,
  origin,
  onClose,
}: HelpPlayerProps) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const close = useRef<HTMLSpanElement>(null);
  const aside = useMemo(() => [list, close], []);

  useEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;

    // jsdom has no top layer: the dialog opens in the flow.
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
  }, []);

  useGrow(panel, origin, aside);

  // The player returns to the place it grew from, then leaves the page. The page behind a modal
  // dialog is inert: the browser returns the focus to the button that opened it when it closes.
  const handleClose = () => {
    void shrinkTo(panel.current, origin, [list.current, close.current]).then(
      () => {
        const element = dialog.current;

        if (element?.open === true && typeof element.close === "function") {
          element.close();
        } else {
          onClose();
        }
      },
    );
  };

  return (
    <dialog
      ref={dialog}
      className={styles.player}
      aria-label={label}
      onClose={onClose}
      onCancel={(event) => {
        // Escape closes the dialog at once; the player travels back first.
        event.preventDefault();
        handleClose();
      }}
      onClick={(event) => {
        // A press on the dimmed ground around the player closes it.
        if (event.target === dialog.current) handleClose();
      }}
    >
      <div className={styles.playerLayout}>
        <div className={styles.playerPanel} ref={panel}>
          <HelpCanvas video={video} label={label} />
        </div>

        <ol
          ref={list}
          className={[styles.steps, styles.playerSteps].join(" ")}
          aria-label={t("help.video.steps")}
        >
          {steps.map((step, index) => (
            <li className={styles.step} key={step.markdown}>
              <span className={styles.stepLine}>
                <HelpStepLine
                  number={index + 1}
                  markdown={step.markdown}
                  links={false}
                />
              </span>
            </li>
          ))}
        </ol>

        <span className={styles.playerClose} ref={close}>
          <IconButton
            variant="solid"
            tone="secondary"
            aria-label={t("help.video.close")}
            onClick={handleClose}
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
