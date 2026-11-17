import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

const lines = Array.from({ length: 12 }, (_, k) => {
  const y = 88 + k * 15;

  return {
    opacity: (0.06 + k * 0.016).toFixed(3),
    d: [
      "M-20",
      y,
      "C60",
      y - 58,
      120,
      y + 58,
      210,
      y,
      "S340",
      y - 68,
      420,
      y - 8,
    ].join(" "),
  };
});

export function Waves() {
  return (
    <ArtCanvas>
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {lines.map((line) => (
          <path
            key={line.d}
            vectorEffect="non-scaling-stroke"
            strokeOpacity={line.opacity}
            d={line.d}
          />
        ))}
      </g>
    </ArtCanvas>
  );
}
