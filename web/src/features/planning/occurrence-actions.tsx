import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";

import type { OccurrenceRef } from "@/features/planning/agenda";
import { scheduleQuery } from "@/features/planning/api";
import { OccurrenceDialog } from "@/features/planning/occurrence-dialog";
import type { OccurrenceChange } from "@/features/planning/occurrence-dialog";
import { RealizeDialog } from "@/features/planning/realize-dialog";
import { useT } from "@/i18n/i18n-provider";

// The row actions of an occurrence wherever it is listed: an open one is realized, skipped or
// moved; a realized one is released; a skipped one takes none.
export function OccurrenceActions({
  occurrence,
  name,
}: {
  occurrence: OccurrenceRef;
  // What the occurrence is called in the menu's and the dialogs' words: its schedule's
  // description, read from the schedule when the list does not hold it.
  name?: string | undefined;
}) {
  const t = useT();
  const schedule = useQuery({
    ...scheduleQuery(useApi(), occurrence.schedule_id),
    enabled: name === undefined,
  });
  const words =
    name ??
    (schedule.data === undefined || schedule.data.description === ""
      ? t("ledger.untitled")
      : schedule.data.description);
  const [open, setOpen] = useState<OccurrenceChange | "realize" | null>(null);
  const close = () => {
    setOpen(null);
  };
  const actions: (OccurrenceChange | "realize")[] =
    occurrence.state === "realized"
      ? ["unrealize"]
      : occurrence.state === "skipped"
        ? []
        : ["realize", "skip", "move"];
  if (actions.length === 0) return null;
  return (
    <>
      <Menu>
        <MenuTrigger
          render={(props) => (
            <IconButton
              {...props}
              size="sm"
              variant="ghost"
              tone="secondary"
              aria-label={t("occurrence.actions", { name: words })}
            >
              <Icon>
                <Glyph name="ellipsis" />
              </Icon>
            </IconButton>
          )}
        />
        <MenuContent>
          {actions.map((action) => (
            <MenuItem
              key={action}
              onSelect={() => {
                setOpen(action);
              }}
            >
              {t(`occurrence.${action}`)}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {open === "realize" && (
        <RealizeDialog
          occurrence={occurrence}
          name={words}
          onDone={close}
          onCancel={close}
        />
      )}
      {open !== null && open !== "realize" && (
        <OccurrenceDialog
          change={open}
          occurrence={occurrence}
          name={words}
          onDone={close}
          onCancel={close}
        />
      )}
    </>
  );
}
