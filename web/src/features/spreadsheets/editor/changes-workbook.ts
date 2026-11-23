// Whether a mutation changes what the snapshot holds. The cell editor and the formula bar are
// documents of their own (their mutations name another unit), and the formula engine writes its
// results back through mutations of its own.
export function changesWorkbook(
  id: string,
  params: unknown,
  workbookID: string,
): boolean {
  if (id.startsWith("formula.") || id.startsWith("doc.")) return false;

  const unit =
    typeof params === "object" && params !== null && "unitId" in params
      ? params.unitId
      : undefined;

  return unit === undefined || unit === workbookID;
}
