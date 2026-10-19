// Opens a day of the ledger: the day on the left, its net under the amount column.
export function TransactionTableBand({
  date,
  label,
  net,
  columns,
}: {
  date: string;
  label: string;
  net: string;
  columns: number;
}) {
  return (
    <tr data-own="day-band">
      <td colSpan={columns - 1}>
        <time dateTime={date}>{label}</time>
      </td>
      <td data-numeric="">{net}</td>
    </tr>
  );
}
