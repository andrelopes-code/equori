import type { CSSProperties, ReactNode } from "react";

import { useT } from "@/i18n/i18n-provider";
import styles from "@/ui/card-face/card-face.module.css";
import amex from "@/ui/card-face/network/amex.svg";
import { EloMark } from "@/ui/card-face/network/elo";
import hipercard from "@/ui/card-face/network/hipercard.svg";
import mastercard from "@/ui/card-face/network/mastercard.svg";
import { VisaMark } from "@/ui/card-face/network/visa";

interface CardFaceNetworkProps {
  network: string | undefined;
}

interface Mark {
  label:
    | "cardFace.network.visa"
    | "cardFace.network.mastercard"
    | "cardFace.network.amex"
    | "cardFace.network.elo"
    | "cardFace.network.hipercard";
  height: number;
  mark: ReactNode;
}

const marks = new Map<string, Mark>([
  ["visa", { label: "cardFace.network.visa", height: 6.6, mark: <VisaMark /> }],
  [
    "mastercard",
    {
      label: "cardFace.network.mastercard",
      height: 9.6,
      mark: <img alt="" src={mastercard} />,
    },
  ],
  [
    "amex",
    {
      label: "cardFace.network.amex",
      height: 9.6,
      mark: <img alt="" src={amex} />,
    },
  ],
  ["elo", { label: "cardFace.network.elo", height: 7.6, mark: <EloMark /> }],
  [
    "hipercard",
    {
      label: "cardFace.network.hipercard",
      height: 8,
      mark: <img alt="" src={hipercard} />,
    },
  ],
]);

export function CardFaceNetwork({ network }: CardFaceNetworkProps) {
  const t = useT();
  const entry = network === undefined ? undefined : marks.get(network);

  if (entry === undefined) {
    return null;
  }

  return (
    <span
      className={styles.mark}
      style={{ "--h": entry.height } as CSSProperties}
      role="img"
      aria-label={t(entry.label)}
    >
      {entry.mark}
    </span>
  );
}
