import {
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
} from "@slotted/react/menu";

import type { useBooks } from "@/app/shell/use-books";
import { useT } from "@/i18n/i18n-provider";

interface AccountBooksProps {
  books: ReturnType<typeof useBooks>;
  onNew: () => void;
}

export function AccountBooks({ books, onNew }: AccountBooksProps) {
  const t = useT();

  return (
    <MenuGroup label={t("books.label")}>
      {books.items.length >= 2 && (
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
      )}
      <MenuItem onSelect={onNew}>{t("books.new")}</MenuItem>
    </MenuGroup>
  );
}
