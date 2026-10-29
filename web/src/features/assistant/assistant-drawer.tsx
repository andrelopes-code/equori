import {
  Drawer,
  DrawerActions,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Text } from "@slotted/react/typography";
import type { ReactNode, RefObject } from "react";

import styles from "@/features/assistant/assistant-panel.module.css";
import { useT } from "@/i18n/i18n-provider";

// A phone's sheet rests at this fraction of the screen's height and cannot be pulled higher.
const SHEET_STOPS = [0.85];

interface AssistantDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: boolean;
  listing: boolean;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  returnFocus: RefObject<HTMLElement | null> | undefined;
  title: string;
  actions: ReactNode;
  body: ReactNode;
  footer: ReactNode;
}

// An overlay without a scrim from 600 px; on a phone, a bottom sheet resting at 85% of the screen
// whose composer is the sheet's footer and stays at the screen's foot while the sheet is dragged (P9).
export function AssistantDrawer({
  open,
  onOpenChange,
  phone,
  listing,
  composerRef,
  returnFocus,
  title,
  actions,
  body,
  footer,
}: AssistantDrawerProps) {
  const t = useT();

  const placement = phone
    ? ({ side: "bottom", size: "full", snapPoints: SHEET_STOPS } as const)
    : ({ side: "end", size: "xl" } as const);

  function initialFocus() {
    if (phone) return "container";
    if (listing) return "first";

    return composerRef;
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      {...placement}
      modal={phone}
      // P9: from 600 px the overlay paints no scrim and leaves the page usable.
      scrimFrom={phone ? 0 : 1}
      outsidePress="none"
      initialFocus={initialFocus()}
      {...(returnFocus === undefined ? {} : { finalFocus: returnFocus })}
    >
      <DrawerPanel className={styles.panel}>
        {phone && <DrawerResizer />}

        <DrawerHeader>
          <DrawerTitle>{t("assistant.title")}</DrawerTitle>
          <DrawerDescription>
            <Text truncate>{title}</Text>
          </DrawerDescription>
          <DrawerActions>{actions}</DrawerActions>
          {/* Workaround for Slotted issue #30: a close inside DrawerActions leaves the header's end
              column empty, and its gap widens the end inset beyond the start inset. */}
          <DrawerClose aria-label={t("detail.close")} />
        </DrawerHeader>

        <DrawerBody>{body}</DrawerBody>

        {/* Workaround for Slotted issue #34: a close by the X or the scrim jumps the sheet's scroll
            to 0 and slides the panel, and a sticky footer then rides at the panel's top. */}
        {footer !== null && (
          <DrawerFooter className={open ? undefined : styles.leaving}>
            {footer}
          </DrawerFooter>
        )}
      </DrawerPanel>
    </Drawer>
  );
}
