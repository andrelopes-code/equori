import {
  plateArt,
  plateShape,
} from "@/features/accounts/kind-chooser/kind-art";
import styles from "@/features/accounts/kind-chooser/kind-art.module.css";
import { KindShapes } from "@/features/accounts/kind-chooser/kind-shapes";
import { classOf, type Kind } from "@/features/accounts/model/account-kinds";

interface KindPlateProps {
  kind: Kind;
  tone?: "neutral";
}

export function KindPlate({ kind, tone }: KindPlateProps) {
  const dataTone = tone ?? classOf(kind);

  return (
    <svg
      className={styles.ill}
      data-tone={dataTone}
      viewBox="0 0 48 48"
      width={48}
      height={48}
      aria-hidden="true"
    >
      {plateShape(kind) === "circle" ? (
        <circle className={styles.pf} cx={24} cy={24} r={24} />
      ) : (
        <rect className={styles.pf} width={48} height={48} rx={13} />
      )}

      <KindShapes shapes={plateArt[kind]} />
    </svg>
  );
}
