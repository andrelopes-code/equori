import { Button, IconButton } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { Shortcut } from "@slotted/react/kbd";

import styles from "@/app/shell/desktop-nav/desktop-nav.module.css";
import { ShellIcon } from "@/app/shell/destinations/shell-icon";
import type { ShellIconName } from "@/app/shell/destinations/shell-icon";

interface NavCommandProps {
  // The column is open: the command is a labelled button. Narrowed, it is its icon.
  open: boolean;
  icon: ShellIconName;
  label: string;
  // The name of the icon alone, when it differs from the label.
  railLabel?: string;
  // The key as aria-keyshortcuts names it.
  shortcut: string;
  // The key as Shortcut draws it. It is decoration: aria-keyshortcuts names the key.
  legend: string;
  // The command the reader reaches for first takes the accent.
  primary?: boolean;
  onClick: () => void;
}

// A command of the desktop column, above the destinations.
export function NavCommand({
  open,
  icon,
  label,
  railLabel,
  shortcut,
  legend,
  primary = false,
  onClick,
}: NavCommandProps) {
  if (!open) {
    return (
      <IconButton
        aria-label={railLabel ?? label}
        aria-keyshortcuts={shortcut}
        tone={primary ? "accent" : undefined}
        variant={primary ? "solid" : undefined}
        onClick={onClick}
      >
        <Icon>
          <ShellIcon name={icon} />
        </Icon>
      </IconButton>
    );
  }

  return (
    <Button
      fullWidth
      justify="between"
      tone={primary ? undefined : "secondary"}
      variant={primary ? undefined : "outline"}
      aria-keyshortcuts={shortcut}
      start={
        <Icon size="sm">
          <ShellIcon name={icon} />
        </Icon>
      }
      end={
        <Shortcut
          className={styles.keys}
          keys={legend}
          size="xs"
          variant="soft"
          aria-hidden="true"
        />
      }
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
