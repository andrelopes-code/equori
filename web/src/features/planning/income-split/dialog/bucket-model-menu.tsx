import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { presetNames } from "@/features/planning/income-split/bucket-draft";
import type { PresetName } from "@/features/planning/income-split/bucket-draft";
import { useT } from "@/i18n/i18n-provider";

interface BucketModelMenuProps {
  onPreset: (name: PresetName) => void;
}

// The presets of A232 as a menu beside the title of the buckets (dialog spec A249).
export function BucketModelMenu({ onPreset }: BucketModelMenuProps) {
  const t = useT();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <Button
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            end={<Glyph name="chevron-down" />}
          >
            {t("buckets.model")}
          </Button>
        )}
      />
      <MenuContent>
        {presetNames.map((name) => (
          <MenuItem
            key={name}
            onSelect={() => {
              onPreset(name);
            }}
          >
            {t(`buckets.preset.${name}`)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
