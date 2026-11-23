// The number formats every XLSX reader knows by number (ECMA-376, 18.8.30). A format outside
// the table is declared in the file with a number from 164.
export const builtinFormats: Readonly<Record<number, string>> = {
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  12: "# ?/?",
  13: "# ??/??",
  14: "m/d/yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  18: "h:mm AM/PM",
  19: "h:mm:ss AM/PM",
  20: "h:mm",
  21: "h:mm:ss",
  22: "m/d/yyyy h:mm",
  37: "#,##0;(#,##0)",
  38: "#,##0;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  45: "mm:ss",
  46: "[h]:mm:ss",
  47: "mm:ss.0",
  48: "##0.0E+0",
  49: "@",
};

export const firstCustomFormat = 164;

// The edge styles of a border: the name of XLSX for each BorderStyleTypes of Univer.
export const borderStyles: Readonly<Record<number, string>> = {
  1: "thin",
  2: "hair",
  3: "dotted",
  4: "dashed",
  5: "dashDot",
  6: "dashDotDot",
  7: "double",
  8: "medium",
  9: "mediumDashed",
  10: "mediumDashDot",
  11: "mediumDashDotDot",
  12: "slantDashDot",
  13: "thick",
};

// "FF1B1C1F" for "#1b1c1f", "#abc" and "rgb(27, 28, 31)"; undefined for a colour no file holds.
export function toArgb(color: string | null | undefined): string | undefined {
  if (color === null || color === undefined) return undefined;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    return `FF${full.toUpperCase()}`;
  }

  const parts = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color.trim());
  if (parts === null) return undefined;

  return `FF${parts
    .slice(1, 4)
    .map((p) => Math.min(255, Number(p)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

// "#1B1C1F" for "FF1B1C1F" and "1B1C1F".
export function fromArgb(argb: string | null): string | undefined {
  if (argb === null || !/^([0-9a-f]{2})?[0-9a-f]{6}$/i.test(argb))
    return undefined;

  return `#${argb.slice(-6).toUpperCase()}`;
}

export function escapeXml(text: string): string {
  return (
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      // A control character other than tab, line feed and carriage return is not XML 1.0.
      // eslint-disable-next-line no-control-regex -- the range names the characters to drop.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  );
}
