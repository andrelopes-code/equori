import { Glyph } from "@slotted/react/icon";
import { Toggle } from "@slotted/react/toggle";

import { useT } from "@/i18n/i18n-provider";

interface LockToggleProps {
  name: string;
  locked: boolean;
  onLock: (locked: boolean) => void;
}

// Families read: toggle. The lock is a mode that stays on.
export function LockToggle({ name, locked, onLock }: LockToggleProps) {
  const t = useT();

  return (
    <Toggle
      size="sm"
      variant="ghost"
      pressed={locked}
      aria-label={t("contributionPlan.lock", { name })}
      icon={<Glyph name="lock" />}
      onPressedChange={onLock}
    />
  );
}
