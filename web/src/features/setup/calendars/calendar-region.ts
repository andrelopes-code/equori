// The region a calendar serves, by its id: a case of the region's code. A calendar without a case,
// the weekend calendar included, is global. docs/contributing/regions.md, "Calendar".
export function calendarRegion(id: string): string {
  switch (id) {
    case "br_banking":
      return "BR";
    default:
      return "global";
  }
}
