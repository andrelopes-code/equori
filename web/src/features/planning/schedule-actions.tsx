import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { EndDialog } from "@/features/planning/end-dialog";
import { PauseDialog } from "@/features/planning/pause-dialog";
import { useT } from "@/i18n/i18n-provider";

type Schedule = components["schemas"]["Schedule"];

// Pause and end from a schedule's row, with the dialogs of the schedule's page.
export function ScheduleActions({
  schedule,
  name,
}: {
  schedule: Schedule;
  name: string;
}) {
  const t = useT();
  const [open, setOpen] = useState<"pause" | "end" | null>(null);
  const close = () => {
    setOpen(null);
  };
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
              aria-label={t("subscriptions.actions", { name })}
            >
              <Icon>
                <Glyph name="ellipsis" />
              </Icon>
            </IconButton>
          )}
        />
        <MenuContent>
          <MenuItem
            onSelect={() => {
              setOpen("pause");
            }}
          >
            {t("schedule.pause")}
          </MenuItem>
          <MenuItem
            tone="danger"
            onSelect={() => {
              setOpen("end");
            }}
          >
            {t("schedule.end")}
          </MenuItem>
        </MenuContent>
      </Menu>
      {open === "pause" && (
        <PauseDialog
          schedule={schedule}
          name={name}
          onDone={close}
          onCancel={close}
        />
      )}
      {open === "end" && (
        <EndDialog
          schedule={schedule}
          name={name}
          onDone={close}
          onCancel={close}
        />
      )}
    </>
  );
}
