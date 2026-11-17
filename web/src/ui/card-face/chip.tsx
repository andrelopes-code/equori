import { useId } from "react";

import styles from "@/ui/card-face/card-face.module.css";

interface CardFaceChipProps {
  tone: "gold" | "silver";
}

// The chip is metal on the plastic: its stops are literals of the object. One drawing, two metals.
const metals = {
  gold: { light: "#f6e3a6", mid: "#b4862a", line: "#6f5010" },
  silver: { light: "#f2f4f6", mid: "#9ea4ad", line: "#555a63" },
};

export function CardFaceChip({ tone }: CardFaceChipProps) {
  const id = useId().replaceAll(":", "");
  const metal = metals[tone];

  return (
    <svg className={styles.chip} viewBox="0 0 63 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={metal.light} />
          <stop offset=".55" stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.light} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset=".2" stopColor="#fff" stopOpacity="0" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x=".5"
        y=".5"
        width="62"
        height="47"
        rx="8.5"
        fill={`url(#${id}m)`}
        stroke={metal.line}
        strokeOpacity=".7"
      />
      <rect
        x=".5"
        y=".5"
        width="62"
        height="47"
        rx="8.5"
        fill={`url(#${id}s)`}
        transform="skewX(-18) translate(8 0)"
        opacity=".5"
      />
      <g
        fill="none"
        stroke={metal.line}
        strokeOpacity=".8"
        strokeWidth="1.1"
        strokeLinecap="round"
      >
        <path d="M1 16.5h19.5M1 31.5h19.5M62 16.5H42.5M62 31.5H42.5M20.5 1v8q0 3.5 3.5 3.5h15q3.5 0 3.5-3.5V1M20.5 47v-8q0-3.5 3.5-3.5h15q3.5 0 3.5 3.5v8" />
        <rect x="20.5" y="12.5" width="22" height="23" rx="3.5" />
        <path d="M1 24h19.5M42.5 24H62" />
      </g>
      <rect
        x="1.5"
        y="1.5"
        width="60"
        height="45"
        rx="7.5"
        fill="none"
        stroke="#fff"
        strokeOpacity=".45"
      />
    </svg>
  );
}
