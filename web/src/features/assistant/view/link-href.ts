import type { ViewPayload } from "@/features/assistant/view/view-types";

// The path of the screen a view opens, with its filters as the query.
export function linkHref(link: NonNullable<ViewPayload["open"]>): string {
  const query = new URLSearchParams(link.params ?? {}).toString();

  return query === "" ? link.screen : `${link.screen}?${query}`;
}
