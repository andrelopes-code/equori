import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import type { useBooks } from "@/app/shell/use-books";
import { useT } from "@/i18n/i18n-provider";

interface AccountBooksProps {
  books: ReturnType<typeof useBooks>;
  onNew: () => void;
}

// With one book the menu offers only the creation; with two or more the books stand in a
// submenu.
export function AccountBooks({ books, onNew }: AccountBooksProps) {
  const t = useT();

  if (books.items.length < 2) {
    return <MenuItem onSelect={onNew}>{t("books.new")}</MenuItem>;
  }

  return (
    <Menu>
      <MenuTrigger>{t("books.label")}</MenuTrigger>
      <MenuContent>
        <MenuRadioGroup
          aria-label={t("books.label")}
          value={String(books.active?.id)}
          onValueChange={(next) => {
            books.switchTo(Number(next));
          }}
        >
          {books.items.map((book) => (
            <MenuRadioItem key={book.id} value={String(book.id)}>
              {book.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={onNew}>{t("books.new")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
