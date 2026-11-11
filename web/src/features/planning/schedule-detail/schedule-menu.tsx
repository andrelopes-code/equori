import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

export type ScheduleMenuChoice =
  "rename" | "start" | "matching" | "pause" | "move" | "end";

interface ScheduleMenuProps {
  ended: boolean;
  onChoose: (choice: ScheduleMenuChoice) => void;
}

// The secondary actions of the schedule page in one menu; a schedule that has ended is renamed,
// started earlier and matched differently, and nothing more.
export function ScheduleMenu({ ended, onChoose }: ScheduleMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="outline"
            tone="secondary"
            aria-label={t("schedule.moreActions")}
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
            onChoose("rename");
          }}
        >
          {t("schedule.rename")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onChoose("start");
          }}
        >
          {t("schedule.startEarlier")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onChoose("matching");
          }}
        >
          {t("schedule.matching.edit")}
        </MenuItem>
        {!ended && (
          <MenuItem
            onSelect={() => {
              onChoose("pause");
            }}
          >
            {t("schedule.pause")}
          </MenuItem>
        )}
        {!ended && (
          <MenuItem
            onSelect={() => {
              onChoose("move");
            }}
          >
            {t("schedule.moveToAccount")}
          </MenuItem>
        )}
        {!ended && (
          <MenuItem
            tone="danger"
            onSelect={() => {
              onChoose("end");
            }}
          >
            {t("schedule.end")}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
