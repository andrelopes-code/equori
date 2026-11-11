import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { BookColourRow } from "@/features/setup/colours/book-colour-row";
import { StudioField } from "@/features/setup/studio/studio-field";
import { myBooksQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";
import type { Accent } from "@/theme/accent";
import { useBookAccents, writeBookAccents } from "@/theme/book-accent";

// The accent each book wears while it is open; a member of one book has nothing to tell apart.
export function BookColourSection() {
  const t = useT();
  const { data: books = [] } = useQuery(myBooksQuery(useApi()));
  const accents = useBookAccents();

  if (books.length < 2) return null;

  const memberships = books.map((book) => book.id);

  const choose = (id: number, accent: Accent | undefined) => {
    const next = Object.fromEntries(
      Object.entries(accents).filter(([key]) => key !== String(id)),
    );
    if (accent !== undefined) next[String(id)] = accent;
    writeBookAccents(next, memberships);
  };

  return (
    <StudioField
      label={t("studio.bookColour")}
      description={t("studio.bookColour.hint")}
    >
      {books.map((book) => (
        <BookColourRow
          key={book.id}
          name={book.name}
          accent={accents[String(book.id)]}
          onChange={(accent) => {
            choose(book.id, accent);
          }}
        />
      ))}
    </StudioField>
  );
}
