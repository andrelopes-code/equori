import type { Entity, EntitySource } from "@slotted/core/entity-picker";

function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export const pageSize = 20;

// One page of the records whose name, legal name or code holds the query, accents ignored.
export function searchEntities(
  entities: readonly Entity[],
  query: string,
  page: number,
  size = pageSize,
): { items: Entity[]; hasMore: boolean } {
  const needle = plain(query.trim());
  const found =
    needle === ""
      ? entities
      : entities.filter((e) =>
          [e.label, e.description ?? "", e.meta ?? ""].some((text) =>
            plain(text).includes(needle),
          ),
        );
  const start = page * size;
  return {
    items: found.slice(start, start + size),
    hasMore: found.length > start + size,
  };
}

// The bank catalogue holds about 500 institutions with a logo: the picker asks for a page at a
// time instead of drawing every row and its image on each key.
export function catalogueSource(entities: readonly Entity[]): EntitySource {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return {
    search: ({ query, page }) =>
      Promise.resolve(searchEntities(entities, query, page)),
    resolve: (ids) =>
      Promise.resolve(
        ids.flatMap((id) => {
          const entity = byId.get(id);
          return entity === undefined ? [] : [entity];
        }),
      ),
  };
}
