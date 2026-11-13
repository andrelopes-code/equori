import {
  panelArt,
  plateShape,
} from "@/features/accounts/kind-chooser/kind-art";
import styles from "@/features/accounts/kind-chooser/kind-art.module.css";
import { KindShapes } from "@/features/accounts/kind-chooser/kind-shapes";
import { classOf, type Kind } from "@/features/accounts/model/account-kinds";

interface KindSceneProps {
  kind: Kind;
  tone?: "neutral";
  heroName?: boolean;
}

// Sides of the four echoes of the plate's shape, the outermost first.
const ringSides = [400, 300, 210, 132] as const;

export function KindScene({ kind, tone, heroName }: KindSceneProps) {
  const dataTone = tone ?? classOf(kind);
  const circle = plateShape(kind) === "circle";

  return (
    <svg
      className={[styles.ill, styles.scene].join(" ")}
      data-tone={dataTone}
      data-hero-name={heroName ? "" : undefined}
      viewBox="0 0 352 140"
      aria-hidden="true"
    >
      {ringSides.map((side, index) => {
        const className = styles[`e${String(4 - index)}` as "e1"];
        const half = side / 2;

        return circle ? (
          <circle
            key={side}
            className={className}
            data-ring=""
            cx={176}
            cy={70}
            r={half}
          />
        ) : (
          <rect
            key={side}
            className={className}
            data-ring=""
            x={176 - half}
            y={70 - half}
            width={side}
            height={side}
            rx={side * 0.27}
          />
        );
      })}

      <g className={styles.hero} transform="translate(123.2 17.2) scale(2.2)">
        <KindShapes shapes={panelArt[kind]} />
      </g>
    </svg>
  );
}
