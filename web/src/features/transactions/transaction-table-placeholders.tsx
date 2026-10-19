import { Skeleton } from "@slotted/react/skeleton";

const rows = 5;
const widths = ["60%", "50%", "40%", "70%"];

export function TransactionTablePlaceholders({ columns }: { columns: number }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} aria-hidden="true">
      {widths.slice(0, columns - 1).map((width, j) => (
        <td key={j}>
          <Skeleton shape="text" inlineSize={width} />
        </td>
      ))}
      <td data-numeric="">
        <Skeleton shape="text" inlineSize="4rem" />
      </td>
    </tr>
  ));
}
