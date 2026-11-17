import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

const cx = 348;
const cy = 306;
const radii = [92, 132, 172, 212, 252, 292];
const dots = [
  { r: 212, deg: 250 },
  { r: 292, deg: 235 },
  { r: 132, deg: 262 },
].map(({ r, deg }) => ({
  x: (cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(1),
  y: (cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(1),
}));

export function Orbits() {
  return (
    <ArtCanvas>
      <circle cx={cx} cy={cy} r="92" fill="currentColor" fillOpacity=".07" />

      <g fill="none" stroke="currentColor" strokeWidth="1">
        {radii.map((r, k) => (
          <circle
            key={r}
            vectorEffect="non-scaling-stroke"
            cx={cx}
            cy={cy}
            r={r}
            strokeOpacity={(0.24 - k * 0.028).toFixed(3)}
          />
        ))}
      </g>

      {dots.map((dot) => (
        <circle
          key={`${dot.x} ${dot.y}`}
          cx={dot.x}
          cy={dot.y}
          r="3.2"
          fill="currentColor"
          fillOpacity=".55"
        />
      ))}
    </ArtCanvas>
  );
}
