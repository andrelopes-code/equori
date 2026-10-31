import { encode } from "uqr";

import styles from "@/ui/qr-code.module.css";
import { qrPath } from "@/ui/qr-path";

interface QrCodeProps {
  value: string;
  label: string;
}

// Own element (CP-04): no family draws a QR code; the matrix comes from uqr (ADR 030).
export function QrCode({ value, label }: QrCodeProps) {
  const { size, data } = encode(value, { ecc: "M", border: 2 });

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      data-slotted-scheme="light"
      className={styles.code}
    >
      <path d={qrPath(data)} className={styles.modules} />
    </svg>
  );
}
