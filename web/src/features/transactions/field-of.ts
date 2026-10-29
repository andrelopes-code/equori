import type { PostingKind } from "@/features/transactions/entry-kind";

// The request's posting field names, read back into the field that wrote them (FM-02).
export function fieldOf(kind: PostingKind, field: string): string {
  if (kind === "advanced") return field;
  if (field.startsWith("postings[0]")) return "account";
  if (field.startsWith("postings[1]"))
    return kind === "transfer" ? "to" : "category";
  if (field.startsWith("tags")) return "tags";
  return field;
}
