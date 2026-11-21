import { Checkbox } from "@slotted/react/checkbox";
import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemStart,
} from "@slotted/react/list-item";
import type { ReactNode } from "react";

import { cx } from "@/ui/cx";
import styles from "@/ui/statement/statement.module.css";

export interface StatementSelection {
  selected: boolean;
  label: string;
  onSelectedChange: (selected: boolean) => void;
}

interface StatementItemProps {
  mark: ReactNode;
  title: string;
  struck: boolean;
  // A state the reader acts on, written before the detail in its own tone.
  flag: ReactNode;
  detail: string;
  amount: ReactNode;
  // A line under the amount, such as the balance the movement left.
  note: ReactNode;
  onOpen: () => void;
  // Present in selection mode: the row is the label of its checkbox and a tap toggles it.
  selection: StatementSelection | undefined;
}

// One 64 px line of a phone statement: the mark, the title over one line of detail, the amount
// at the end (spec 2026-11-21-mobile-statement, MS4 to MS7).
export function StatementItem({
  mark,
  title,
  struck,
  flag,
  detail,
  amount,
  note,
  onOpen,
  selection,
}: StatementItemProps) {
  const text = (
    <>
      <ListItemBody className={styles.body}>
        <ListItemLabel>
          <span className={cx(styles.cut, struck ? styles.struck : undefined)}>
            {title}
          </span>
        </ListItemLabel>

        <ListItemDescription>
          <span className={styles.cut}>
            {flag}
            {Boolean(flag) && detail !== "" && " · "}
            {detail}
          </span>
        </ListItemDescription>
      </ListItemBody>

      <ListItemEnd className={styles.end}>
        <span className={styles.endStack}>
          {amount}
          {note}
        </span>
      </ListItemEnd>
    </>
  );

  if (selection !== undefined) {
    return (
      <ListItem className={styles.row} selected={selection.selected}>
        <ListItemContent render={(props) => <label {...props} />}>
          <ListItemStart>
            <Checkbox
              checked={selection.selected}
              aria-label={selection.label}
              onCheckedChange={selection.onSelectedChange}
            />
          </ListItemStart>
          {text}
        </ListItemContent>
      </ListItem>
    );
  }

  return (
    <ListItem className={styles.row}>
      <ListItemButton onClick={onOpen}>
        <ListItemStart>{mark}</ListItemStart>
        {text}
      </ListItemButton>
    </ListItem>
  );
}
