import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemLabel,
} from "@slotted/react/list-item";

import type { BooksMembership } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

interface MoreBooksProps {
  items: BooksMembership[];
  onSwitch: (id: number) => void;
  onNew: () => void;
}

export function MoreBooks({ items, onSwitch, onNew }: MoreBooksProps) {
  const t = useT();

  return (
    <List aria-label={t("books.label")}>
      {items.length >= 2 &&
        items.map((book) => (
          <ListItem key={book.id} size="lg" current={book.active}>
            <ListItemButton
              onClick={() => {
                onSwitch(book.id);
              }}
            >
              <ListItemBody>
                <ListItemLabel>{book.name}</ListItemLabel>
              </ListItemBody>
            </ListItemButton>
          </ListItem>
        ))}
      <ListItem size="lg">
        <ListItemButton onClick={onNew}>
          <ListItemBody>
            <ListItemLabel>{t("books.new")}</ListItemLabel>
          </ListItemBody>
        </ListItemButton>
      </ListItem>
    </List>
  );
}
