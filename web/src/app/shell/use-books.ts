import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { myBooksQuery, useSwitchBooks } from "@/features/session";
import type { BooksMembership } from "@/features/session";

interface Books {
  items: BooksMembership[];
  active: BooksMembership | undefined;
  switchTo: (id: number) => void;
  error: Error | null;
}

export function useBooks(): Books {
  const { data: items = [] } = useQuery(myBooksQuery(useApi()));
  const { mutate, error } = useSwitchBooks();
  const active = items.find((book) => book.active);

  return {
    items,
    active,
    switchTo: (id) => {
      if (id !== active?.id) mutate(id);
    },
    error,
  };
}
